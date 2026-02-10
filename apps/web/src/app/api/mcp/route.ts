// Murray's FSM - MCP Endpoint
// =============================
// Thin shim exposing Murray's FSM as tools for AI agents via MCP-compatible JSON-RPC.
// All mutating actions flow through the approval queue. Read operations are direct.
//
// Tools exposed:
//   list_action_queue  - List pending/recent actions
//   approve_action     - Approve a pending action (via queue)
//   get_job            - Get job details
//   get_customer       - Get customer details
//   create_lead        - Create a new lead (via queue, approval-gated)
//   create_invoice_draft - Create invoice draft for a job
//   send_message       - Send SMS (via queue, approval-gated)
//   list_jobs          - List jobs with filters
//   check_schedule     - Check schedule availability

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// Tool definitions for discovery
const TOOLS = [
  {
    name: 'list_action_queue',
    description: 'List pending approval-gated actions. Returns actions waiting for human approval.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['pending', 'approved', 'rejected', 'executed', 'failed'], description: 'Filter by status (default: pending)' },
        limit: { type: 'number', description: 'Max results (default: 20)' },
      },
    },
  },
  {
    name: 'approve_action',
    description: 'Approve a pending action for execution. All customer-facing actions require approval.',
    inputSchema: {
      type: 'object',
      properties: {
        action_id: { type: 'string', description: 'The action queue ID to approve' },
        payload_overrides: { type: 'object', description: 'Optional payload modifications before approval' },
      },
      required: ['action_id'],
    },
  },
  {
    name: 'get_job',
    description: 'Get details of a specific job including customer, location, and line items.',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: 'Job UUID' },
      },
      required: ['job_id'],
    },
  },
  {
    name: 'get_customer',
    description: 'Get customer details by ID or phone number.',
    inputSchema: {
      type: 'object',
      properties: {
        customer_id: { type: 'string', description: 'Customer UUID' },
        phone: { type: 'string', description: 'Phone number to look up' },
      },
    },
  },
  {
    name: 'create_lead',
    description: 'Create a new lead from an inbound inquiry. Enqueued as an approval-gated action.',
    inputSchema: {
      type: 'object',
      properties: {
        customer_name: { type: 'string' },
        phone: { type: 'string' },
        issue_summary: { type: 'string', description: 'What the customer needs' },
        urgency: { type: 'string', enum: ['emergency', 'urgent', 'normal', 'flexible'] },
        source: { type: 'string', description: 'Lead source (phone, sms, web, referral)' },
      },
      required: ['phone', 'issue_summary'],
    },
  },
  {
    name: 'create_invoice_draft',
    description: 'Create an invoice draft from a job\'s line items. Optionally enqueue for sending.',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: 'Job UUID to invoice' },
        auto_send: { type: 'boolean', description: 'Enqueue send_invoice action (approval-gated)' },
      },
      required: ['job_id'],
    },
  },
  {
    name: 'send_message',
    description: 'Queue an SMS message to a customer. Always requires approval before sending.',
    inputSchema: {
      type: 'object',
      properties: {
        to_phone: { type: 'string', description: 'Recipient phone number' },
        message: { type: 'string', description: 'Message body' },
        customer_id: { type: 'string', description: 'Optional customer UUID' },
        job_id: { type: 'string', description: 'Optional related job UUID' },
      },
      required: ['to_phone', 'message'],
    },
  },
  {
    name: 'list_jobs',
    description: 'List jobs with optional filters.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['scheduled', 'in_progress', 'completed', 'canceled'] },
        limit: { type: 'number', description: 'Max results (default: 20)' },
        date_from: { type: 'string', description: 'ISO date string' },
        date_to: { type: 'string', description: 'ISO date string' },
      },
    },
  },
  {
    name: 'check_schedule',
    description: 'Check schedule availability for a given date range.',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'ISO date string to check' },
        duration_minutes: { type: 'number', description: 'How long the job would take (default: 120)' },
      },
      required: ['date'],
    },
  },
];

export async function POST(request: Request) {
  const body: MCPRequest = await request.json();

  // Handle tool listing
  if (body.method === 'tools/list') {
    return json({ jsonrpc: '2.0', id: body.id, result: { tools: TOOLS } });
  }

  // Handle tool calls
  if (body.method === 'tools/call') {
    const toolName = (body.params?.name as string) ?? '';
    const args = (body.params?.arguments as Record<string, unknown>) ?? {};

    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return json({
        jsonrpc: '2.0',
        id: body.id,
        error: { code: -32000, message: 'Unauthorized' },
      });
    }

    try {
      const result = await handleTool(supabase, user.id, toolName, args);
      return json({ jsonrpc: '2.0', id: body.id, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return json({
        jsonrpc: '2.0',
        id: body.id,
        error: { code: -32603, message },
      });
    }
  }

  return json({
    jsonrpc: '2.0',
    id: body.id,
    error: { code: -32601, message: `Unknown method: ${body.method}` },
  });
}

// GET for tool discovery
export async function GET() {
  return json({ tools: TOOLS });
}

async function handleTool(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  tool: string,
  args: Record<string, unknown>
) {
  switch (tool) {
    case 'list_action_queue': {
      const status = (args.status as string) || 'pending';
      const limit = (args.limit as number) || 20;
      const { data } = await supabase
        .from('action_queue')
        .select('id, kind, status, payload, source_type, created_at, error')
        .eq('owner_id', userId)
        .eq('status', status)
        .eq('deleted', false)
        .order('created_at', { ascending: false })
        .limit(limit);
      return { content: [{ type: 'text', text: JSON.stringify(data ?? [], null, 2) }] };
    }

    case 'approve_action': {
      const actionId = args.action_id as string;
      const overrides = args.payload_overrides as Record<string, unknown> | undefined;

      const updatePayload: Record<string, unknown> = {
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: userId,
      };

      if (overrides) {
        const { data: existing } = await supabase
          .from('action_queue')
          .select('payload')
          .eq('id', actionId)
          .single();
        if (existing) {
          updatePayload.payload = { ...existing.payload, ...overrides };
        }
      }

      const { data, error } = await supabase
        .from('action_queue')
        .update(updatePayload)
        .eq('id', actionId)
        .eq('owner_id', userId)
        .eq('status', 'pending')
        .select()
        .single();

      if (error) return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };

      await supabase.from('audit_log').insert({
        owner_id: userId,
        actor: 'mcp',
        action: 'approve',
        entity_type: 'action',
        entity_id: actionId,
      });

      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'get_job': {
      const { data } = await supabase
        .from('jobs')
        .select('*, customers(name, phone, email), locations(address1, city, state, postal_code)')
        .eq('id', args.job_id)
        .eq('owner_id', userId)
        .single();

      if (!data) return { content: [{ type: 'text', text: 'Job not found' }], isError: true };

      // Also fetch line items
      const { data: items } = await supabase
        .from('line_items')
        .select('name, kind, qty, unit_price_cents, total_cents')
        .eq('job_id', args.job_id)
        .eq('deleted', false);

      return { content: [{ type: 'text', text: JSON.stringify({ ...data, line_items: items }, null, 2) }] };
    }

    case 'get_customer': {
      let query = supabase.from('customers').select('*').eq('owner_id', userId);
      if (args.customer_id) query = query.eq('id', args.customer_id);
      else if (args.phone) query = query.eq('phone', args.phone);
      else return { content: [{ type: 'text', text: 'Provide customer_id or phone' }], isError: true };

      const { data } = await query.maybeSingle();
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'create_lead': {
      const idempotencyKey = `mcp:create_lead:${args.phone}:${Date.now()}`;
      const { data } = await supabase
        .from('action_queue')
        .insert({
          owner_id: userId,
          kind: 'create_lead',
          payload: {
            name: args.customer_name,
            phone: args.phone,
            issue_summary: args.issue_summary,
            urgency: args.urgency ?? 'normal',
            source: args.source ?? 'mcp',
            inbound_channel: 'mcp',
          },
          source_type: 'mcp',
          requires_approval: true,
          idempotency_key: idempotencyKey,
          status: 'pending',
          result: {},
          retry_count: 0,
          max_retries: 3,
        })
        .select()
        .single();

      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }

    case 'create_invoice_draft': {
      // Delegate to the /api/invoices endpoint logic inline
      const jobId = args.job_id as string;
      const { data: job } = await supabase
        .from('jobs')
        .select('total_invoice_cents, paid_cents')
        .eq('id', jobId)
        .eq('owner_id', userId)
        .single();

      if (!job) return { content: [{ type: 'text', text: 'Job not found' }], isError: true };

      const balance = (job.total_invoice_cents ?? 0) - (job.paid_cents ?? 0);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            job_id: jobId,
            total_invoice_cents: job.total_invoice_cents,
            paid_cents: job.paid_cents,
            balance_due_cents: balance,
          }, null, 2),
        }],
      };
    }

    case 'send_message': {
      const idempotencyKey = `mcp:send_sms:${args.to_phone}:${Date.now()}`;
      const { data } = await supabase
        .from('action_queue')
        .insert({
          owner_id: userId,
          kind: 'send_sms',
          payload: {
            to_phone: args.to_phone,
            message: args.message,
            customer_id: args.customer_id ?? null,
          },
          source_type: 'mcp',
          requires_approval: true,
          job_id: (args.job_id as string) ?? null,
          idempotency_key: idempotencyKey,
          status: 'pending',
          result: {},
          retry_count: 0,
          max_retries: 3,
        })
        .select()
        .single();

      return { content: [{ type: 'text', text: `Message queued for approval: ${JSON.stringify(data, null, 2)}` }] };
    }

    case 'list_jobs': {
      let query = supabase
        .from('jobs')
        .select('id, title, status, scheduled_start, scheduled_end, total_invoice_cents, paid_cents, customers(name)')
        .eq('owner_id', userId)
        .eq('deleted', false)
        .order('scheduled_start', { ascending: false })
        .limit((args.limit as number) || 20);

      if (args.status) query = query.eq('status', args.status);
      if (args.date_from) query = query.gte('scheduled_start', args.date_from);
      if (args.date_to) query = query.lte('scheduled_start', args.date_to);

      const { data } = await query;
      return { content: [{ type: 'text', text: JSON.stringify(data ?? [], null, 2) }] };
    }

    case 'check_schedule': {
      const date = args.date as string;
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id, title, scheduled_start, scheduled_end, status')
        .eq('owner_id', userId)
        .eq('deleted', false)
        .gte('scheduled_start', `${date}T00:00:00`)
        .lte('scheduled_start', `${date}T23:59:59`)
        .order('scheduled_start');

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            date,
            existing_jobs: jobs ?? [],
            job_count: jobs?.length ?? 0,
          }, null, 2),
        }],
      };
    }

    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}

function json(data: MCPResponse | Record<string, unknown>) {
  return NextResponse.json(data);
}
