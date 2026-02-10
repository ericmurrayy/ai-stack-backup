// Murray's FSM - Action Queue Service
// =====================================
// Approval-gated automation engine. Every customer-facing action
// flows through this queue. Nothing sends without approval.

import { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActionKind =
  | 'create_job'
  | 'schedule_job'
  | 'reschedule_job'
  | 'create_estimate'
  | 'send_estimate'
  | 'send_invoice'
  | 'send_sms'
  | 'send_email'
  | 'request_review'
  | 'propose_booking_times'
  | 'book_appointment'
  | 'create_lead';

export type ActionStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';

export interface EnqueueActionInput {
  ownerId: string;
  kind: ActionKind;
  payload: Record<string, unknown>;
  sourceType: string;           // 'sms_inbound', 'call_inbound', 'manual', 'system', 'mcp'
  sourceId?: string;            // external ID (message ID, call ID, etc.)
  requiresApproval?: boolean;   // default true
  leadId?: string;
  jobId?: string;
  idempotencyKey?: string;      // caller-provided dedup key
}

export interface ActionRecord {
  id: string;
  owner_id: string;
  kind: ActionKind;
  payload: Record<string, unknown>;
  status: ActionStatus;
  source_type: string;
  source_id: string | null;
  requires_approval: boolean;
  lead_id: string | null;
  job_id: string | null;
  idempotency_key: string | null;
  result: Record<string, unknown>;
  retry_count: number;
  max_retries: number;
  approved_at: string | null;
  approved_by: string | null;
  executed_at: string | null;
  error: string | null;
  created_at: string;
}

export interface ExecutionResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

// Map of action kinds to their executor functions
type ActionExecutor = (
  supabase: SupabaseClient,
  action: ActionRecord
) => Promise<ExecutionResult>;

const executors: Partial<Record<ActionKind, ActionExecutor>> = {};

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Enqueue a new action into the approval gate.
 * If requiresApproval is false AND it's a safe action, auto-execute.
 */
export async function enqueueAction(
  supabase: SupabaseClient,
  input: EnqueueActionInput
): Promise<{ action: ActionRecord | null; error: string | null }> {
  const idempotencyKey = input.idempotencyKey ?? `${input.kind}:${input.sourceType}:${input.sourceId ?? randomUUID()}`;

  // Idempotency check: if this exact action already exists, return it
  const { data: existing } = await supabase
    .from('action_queue')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (existing) {
    return { action: existing as ActionRecord, error: null };
  }

  const requiresApproval = input.requiresApproval ?? true;

  const { data, error } = await supabase
    .from('action_queue')
    .insert({
      owner_id: input.ownerId,
      kind: input.kind,
      payload: input.payload,
      source_type: input.sourceType,
      source_id: input.sourceId ?? null,
      requires_approval: requiresApproval,
      lead_id: input.leadId ?? null,
      job_id: input.jobId ?? null,
      idempotency_key: idempotencyKey,
      status: 'pending',
      result: {},
      retry_count: 0,
      max_retries: 3,
    })
    .select()
    .single();

  if (error) {
    return { action: null, error: error.message };
  }

  const action = data as ActionRecord;

  // Audit
  await writeAudit(supabase, {
    ownerId: input.ownerId,
    actor: 'system',
    action: 'create',
    entityType: 'action',
    entityId: action.id,
    diff: { after: action },
  });

  // Auto-execute if no approval needed
  if (!requiresApproval) {
    return executeAction(supabase, action.id);
  }

  return { action, error: null };
}

/**
 * Approve an action. Optionally override the payload before execution.
 */
export async function approveAction(
  supabase: SupabaseClient,
  actionId: string,
  approvedBy: string,
  payloadOverrides?: Record<string, unknown>
): Promise<{ action: ActionRecord | null; error: string | null }> {
  // Fetch the action
  const { data: action, error: fetchError } = await supabase
    .from('action_queue')
    .select('*')
    .eq('id', actionId)
    .single();

  if (fetchError || !action) {
    return { action: null, error: fetchError?.message ?? 'Action not found' };
  }

  if (action.status !== 'pending') {
    return { action: null, error: `Cannot approve action in '${action.status}' status` };
  }

  const updatedPayload = payloadOverrides
    ? { ...action.payload, ...payloadOverrides }
    : action.payload;

  const { data: updated, error: updateError } = await supabase
    .from('action_queue')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: approvedBy,
      payload: updatedPayload,
    })
    .eq('id', actionId)
    .select()
    .single();

  if (updateError) {
    return { action: null, error: updateError.message };
  }

  await writeAudit(supabase, {
    ownerId: action.owner_id,
    actor: approvedBy,
    action: 'approve',
    entityType: 'action',
    entityId: actionId,
    diff: {
      before: { status: 'pending' },
      after: { status: 'approved', payload: updatedPayload },
    },
  });

  // Execute immediately after approval
  return executeAction(supabase, actionId);
}

/**
 * Reject an action with a reason.
 */
export async function rejectAction(
  supabase: SupabaseClient,
  actionId: string,
  rejectedBy: string,
  reason?: string
): Promise<{ action: ActionRecord | null; error: string | null }> {
  const { data, error } = await supabase
    .from('action_queue')
    .update({
      status: 'rejected',
      error: reason ?? 'Rejected by user',
    })
    .eq('id', actionId)
    .eq('status', 'pending')
    .select()
    .single();

  if (error) {
    return { action: null, error: error.message };
  }

  await writeAudit(supabase, {
    ownerId: data.owner_id,
    actor: rejectedBy,
    action: 'reject',
    entityType: 'action',
    entityId: actionId,
    diff: { before: { status: 'pending' }, after: { status: 'rejected', reason } },
  });

  return { action: data as ActionRecord, error: null };
}

/**
 * Execute an approved (or auto-approved) action.
 * Idempotent: if already executed, returns the existing result.
 */
export async function executeAction(
  supabase: SupabaseClient,
  actionId: string
): Promise<{ action: ActionRecord | null; error: string | null }> {
  const { data: action, error: fetchError } = await supabase
    .from('action_queue')
    .select('*')
    .eq('id', actionId)
    .single();

  if (fetchError || !action) {
    return { action: null, error: fetchError?.message ?? 'Action not found' };
  }

  // Already executed - idempotent return
  if (action.status === 'executed') {
    return { action: action as ActionRecord, error: null };
  }

  // Must be approved or pending (auto-approve)
  if (action.status !== 'approved' && action.status !== 'pending') {
    return { action: null, error: `Cannot execute action in '${action.status}' status` };
  }

  // If pending and requires approval, block
  if (action.status === 'pending' && action.requires_approval) {
    return { action: null, error: 'Action requires approval before execution' };
  }

  const executor = executors[action.kind as ActionKind];
  if (!executor) {
    // No built-in executor - mark as approved and let n8n handle it
    // This is the bridge: new action types get executors, legacy types use n8n
    const { data: updated } = await supabase
      .from('action_queue')
      .update({
        status: 'approved',
        result: { handler: 'n8n', note: 'No built-in executor, delegating to n8n' },
      })
      .eq('id', actionId)
      .select()
      .single();

    return { action: updated as ActionRecord, error: null };
  }

  try {
    const result = await executor(supabase, action as ActionRecord);

    if (result.success) {
      const { data: updated } = await supabase
        .from('action_queue')
        .update({
          status: 'executed',
          executed_at: new Date().toISOString(),
          result: result.data ?? {},
        })
        .eq('id', actionId)
        .select()
        .single();

      await writeAudit(supabase, {
        ownerId: action.owner_id,
        actor: 'system',
        action: 'execute',
        entityType: 'action',
        entityId: actionId,
        diff: { after: { status: 'executed', result: result.data } },
      });

      return { action: updated as ActionRecord, error: null };
    } else {
      // Execution failed - increment retry
      const retryCount = (action.retry_count ?? 0) + 1;
      const maxRetries = action.max_retries ?? 3;
      const isFinal = retryCount >= maxRetries;

      const { data: updated } = await supabase
        .from('action_queue')
        .update({
          status: isFinal ? 'failed' : action.status,
          error: result.error,
          retry_count: retryCount,
          result: { lastError: result.error, retryCount },
          next_retry_at: isFinal
            ? null
            : new Date(Date.now() + Math.pow(2, retryCount) * 1000).toISOString(),
        })
        .eq('id', actionId)
        .select()
        .single();

      await writeAudit(supabase, {
        ownerId: action.owner_id,
        actor: 'system',
        action: isFinal ? 'fail' : 'retry',
        entityType: 'action',
        entityId: actionId,
        diff: { error: result.error, retryCount },
      });

      return { action: updated as ActionRecord, error: result.error };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown execution error';

    await supabase
      .from('action_queue')
      .update({
        status: 'failed',
        error: message,
        result: { exception: message },
      })
      .eq('id', actionId);

    return { action: null, error: message };
  }
}

/**
 * List pending actions for an owner.
 */
export async function listPendingActions(
  supabase: SupabaseClient,
  ownerId: string,
  limit = 50
): Promise<ActionRecord[]> {
  const { data } = await supabase
    .from('action_queue')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as ActionRecord[];
}

/**
 * List recent actions (all statuses) for an owner.
 */
export async function listRecentActions(
  supabase: SupabaseClient,
  ownerId: string,
  limit = 100
): Promise<ActionRecord[]> {
  const { data } = await supabase
    .from('action_queue')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []) as ActionRecord[];
}

// ---------------------------------------------------------------------------
// Built-in Executors
// ---------------------------------------------------------------------------

/**
 * Register a built-in executor for an action kind.
 */
export function registerExecutor(kind: ActionKind, executor: ActionExecutor): void {
  executors[kind] = executor;
}

// --- create_job executor ---
registerExecutor('create_job', async (supabase, action) => {
  const p = action.payload as Record<string, unknown>;

  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      owner_id: action.owner_id,
      customer_id: p.customer_id,
      location_id: p.location_id ?? null,
      title: p.title ?? 'New Job',
      service_type: p.service_type ?? null,
      problem_description: p.problem_description ?? null,
      status: 'scheduled',
      scheduled_start: p.scheduled_start ?? null,
      scheduled_end: p.scheduled_end ?? null,
      internal_notes: p.internal_notes ?? null,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  // Link lead to job if applicable
  if (action.lead_id) {
    await supabase
      .from('leads')
      .update({ converted_job_id: job.id, converted_at: new Date().toISOString() })
      .eq('id', action.lead_id);
  }

  return { success: true, data: { job_id: job.id } };
});

// --- create_lead executor ---
registerExecutor('create_lead', async (supabase, action) => {
  const p = action.payload as Record<string, unknown>;

  // Upsert customer by phone
  let customerId = p.customer_id as string | undefined;
  if (!customerId && p.phone) {
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('owner_id', action.owner_id)
      .eq('phone', p.phone)
      .maybeSingle();

    if (existing) {
      customerId = existing.id;
    } else {
      const { data: newCust, error: custErr } = await supabase
        .from('customers')
        .insert({
          owner_id: action.owner_id,
          name: (p.name as string) ?? 'Unknown',
          phone: p.phone,
          email: p.email ?? null,
        })
        .select()
        .single();

      if (custErr) return { success: false, error: custErr.message };
      customerId = newCust.id;
    }
  }

  // Get the first pipeline stage
  const { data: firstStage } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('owner_id', action.owner_id)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      owner_id: action.owner_id,
      customer_id: customerId ?? null,
      stage_id: firstStage?.id ?? null,
      title: (p.title as string) ?? 'Inbound Lead',
      description: p.description ?? null,
      issue_summary: p.issue_summary ?? null,
      source: p.source ?? 'phone',
      inbound_channel: p.inbound_channel ?? 'sms',
      urgency: p.urgency ?? 'normal',
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  return { success: true, data: { lead_id: lead.id, customer_id: customerId } };
});

// ---------------------------------------------------------------------------
// Audit Log
// ---------------------------------------------------------------------------

interface AuditInput {
  ownerId: string;
  actor: string;
  action: string;
  entityType: string;
  entityId?: string;
  diff?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export async function writeAudit(
  supabase: SupabaseClient,
  input: AuditInput
): Promise<void> {
  await supabase.from('audit_log').insert({
    owner_id: input.ownerId,
    actor: input.actor,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    diff: input.diff ?? {},
    metadata: input.metadata ?? {},
  });
}
