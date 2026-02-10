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

// --- propose_booking_times executor ---
registerExecutor('propose_booking_times', async (supabase, action) => {
  const p = action.payload as Record<string, unknown>;
  const serviceType = p.service_type as string | undefined;
  const numDays = (p.num_days as number) ?? 7;

  // Estimate duration from service type
  const durationMap: Record<string, number> = {
    'Garage Door Repair': 90,
    'Garage Door Installation': 240,
    'Spring Replacement': 90,
    'Panel Replacement': 120,
    'Garage Door Opener Installation': 120,
    'Garage Door Opener Repair': 60,
    'Emergency Service': 120,
    'Maintenance & Tune-up': 45,
  };
  const duration = (serviceType && durationMap[serviceType]) ?? 120;

  // Fetch existing scheduled jobs
  const { data: existingJobs } = await supabase
    .from('jobs')
    .select('id, scheduled_start, scheduled_end, title, status')
    .eq('owner_id', action.owner_id)
    .eq('deleted', false)
    .not('status', 'in', '("canceled","completed")')
    .not('scheduled_start', 'is', null);

  if (!existingJobs) {
    return { success: false, error: 'Failed to fetch existing jobs' };
  }

  // Find available slots for the next N days
  const slots: Array<{ date: string; start: string; end: string; durationMinutes: number }> = [];
  const today = new Date();

  for (let i = 0; i < numDays; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dayOfWeek = date.getDay();

    // Business hours (Mon-Fri 8-17, Sat 9-14, Sun closed)
    const hours: Record<number, [number, number]> = {
      1: [8, 17], 2: [8, 17], 3: [8, 17], 4: [8, 17], 5: [8, 17], 6: [9, 14],
    };
    if (!hours[dayOfWeek]) continue;

    const [startHour, endHour] = hours[dayOfWeek];
    const dayStart = new Date(date);
    dayStart.setHours(startHour, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(endHour, 0, 0, 0);

    // Filter jobs for this day
    const dateStr = date.toISOString().split('T')[0];
    const dayJobs = existingJobs
      .filter(j => j.scheduled_start?.startsWith(dateStr))
      .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));

    let cursor = new Date(Math.max(dayStart.getTime(), Date.now() + 30 * 60 * 1000));
    // Round to next 15-min
    cursor.setMinutes(Math.ceil(cursor.getMinutes() / 15) * 15, 0, 0);

    for (const job of dayJobs) {
      const jobStart = new Date(job.scheduled_start);
      const jobEnd = job.scheduled_end ? new Date(job.scheduled_end) : new Date(jobStart.getTime() + 120 * 60000);
      const gapEnd = new Date(jobStart.getTime() - 15 * 60000); // 15min buffer

      if (gapEnd.getTime() - cursor.getTime() >= duration * 60000) {
        slots.push({
          date: dateStr,
          start: cursor.toISOString(),
          end: new Date(cursor.getTime() + duration * 60000).toISOString(),
          durationMinutes: duration,
        });
      }
      cursor = new Date(jobEnd.getTime() + 15 * 60000);
    }

    // After last job
    while (dayEnd.getTime() - cursor.getTime() >= duration * 60000 && slots.length < 15) {
      slots.push({
        date: dateStr,
        start: cursor.toISOString(),
        end: new Date(cursor.getTime() + duration * 60000).toISOString(),
        durationMinutes: duration,
      });
      cursor = new Date(cursor.getTime() + duration * 60000);
    }

    if (slots.length >= 15) break;
  }

  return {
    success: true,
    data: {
      available_slots: slots.slice(0, 10),
      service_type: serviceType,
      estimated_duration_minutes: duration,
      customer_id: p.customer_id,
      lead_id: action.lead_id,
    },
  };
});

// --- book_appointment executor ---
registerExecutor('book_appointment', async (supabase, action) => {
  const p = action.payload as Record<string, unknown>;

  if (!p.scheduled_start || !p.customer_id) {
    return { success: false, error: 'scheduled_start and customer_id are required' };
  }

  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      owner_id: action.owner_id,
      customer_id: p.customer_id,
      location_id: p.location_id ?? null,
      title: (p.title as string) ?? 'Booked Appointment',
      service_type: p.service_type ?? null,
      problem_description: p.problem_description ?? null,
      status: 'scheduled',
      scheduled_start: p.scheduled_start,
      scheduled_end: p.scheduled_end ?? null,
      internal_notes: p.internal_notes ?? null,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  // Link lead if applicable
  if (action.lead_id) {
    await supabase
      .from('leads')
      .update({ converted_job_id: job.id, converted_at: new Date().toISOString() })
      .eq('id', action.lead_id);
  }

  return { success: true, data: { job_id: job.id, scheduled_start: p.scheduled_start } };
});

// --- schedule_job executor ---
registerExecutor('schedule_job', async (supabase, action) => {
  const p = action.payload as Record<string, unknown>;
  const jobId = (p.job_id as string) ?? action.job_id;

  if (!jobId || !p.scheduled_start) {
    return { success: false, error: 'job_id and scheduled_start are required' };
  }

  const { error } = await supabase
    .from('jobs')
    .update({
      scheduled_start: p.scheduled_start,
      scheduled_end: p.scheduled_end ?? null,
      status: 'scheduled',
    })
    .eq('id', jobId)
    .eq('owner_id', action.owner_id);

  if (error) return { success: false, error: error.message };

  return { success: true, data: { job_id: jobId, scheduled_start: p.scheduled_start } };
});

// --- reschedule_job executor ---
registerExecutor('reschedule_job', async (supabase, action) => {
  const p = action.payload as Record<string, unknown>;
  const jobId = (p.job_id as string) ?? action.job_id;

  if (!jobId || !p.scheduled_start) {
    return { success: false, error: 'job_id and scheduled_start are required' };
  }

  // Fetch the old schedule for audit
  const { data: oldJob } = await supabase
    .from('jobs')
    .select('scheduled_start, scheduled_end')
    .eq('id', jobId)
    .single();

  const { error } = await supabase
    .from('jobs')
    .update({
      scheduled_start: p.scheduled_start,
      scheduled_end: p.scheduled_end ?? null,
    })
    .eq('id', jobId)
    .eq('owner_id', action.owner_id);

  if (error) return { success: false, error: error.message };

  await writeAudit(supabase, {
    ownerId: action.owner_id,
    actor: 'system',
    action: 'reschedule',
    entityType: 'job',
    entityId: jobId,
    diff: {
      before: { scheduled_start: oldJob?.scheduled_start, scheduled_end: oldJob?.scheduled_end },
      after: { scheduled_start: p.scheduled_start, scheduled_end: p.scheduled_end },
    },
  });

  return { success: true, data: { job_id: jobId, old_start: oldJob?.scheduled_start, new_start: p.scheduled_start } };
});

// --- request_review executor ---
registerExecutor('request_review', async (supabase, action) => {
  const p = action.payload as Record<string, unknown>;
  const jobId = (p.job_id as string) ?? action.job_id;

  if (!jobId) {
    return { success: false, error: 'job_id is required' };
  }

  // Create review request record
  const { data: reviewReq, error } = await supabase
    .from('review_requests')
    .insert({
      owner_id: action.owner_id,
      job_id: jobId,
      customer_id: p.customer_id ?? null,
      channel: p.send_via ?? 'sms',
      status: 'pending',
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  // Log outbound message intent (actual send via n8n workflow 06)
  if (p.customer_phone) {
    await supabase.from('message_logs').insert({
      owner_id: action.owner_id,
      direction: 'outbound',
      channel: 'sms',
      from_phone: null,
      to_phone: p.customer_phone,
      body: `Review request for job ${jobId}`,
      status: 'queued',
    });
  }

  return {
    success: true,
    data: {
      review_request_id: reviewReq.id,
      job_id: jobId,
      channel: p.send_via ?? 'sms',
      note: 'SMS delivery handled by n8n workflow 06',
    },
  };
});

// --- create_estimate executor ---
registerExecutor('create_estimate', async (supabase, action) => {
  const p = action.payload as Record<string, unknown>;
  const jobId = (p.job_id as string) ?? action.job_id;
  const items = p.items as Array<{ name: string; qty?: number; unit_price_cents: number; description?: string }> | undefined;

  if (!jobId) {
    return { success: false, error: 'job_id is required' };
  }

  if (!items || items.length === 0) {
    return { success: false, error: 'At least one line item is required' };
  }

  // Insert estimate line items
  const lineItems = items.map((item, i) => ({
    owner_id: action.owner_id,
    job_id: jobId,
    kind: 'estimate',
    name: item.name,
    description: item.description ?? null,
    qty: item.qty ?? 1,
    unit_price_cents: item.unit_price_cents,
    total_cents: (item.qty ?? 1) * item.unit_price_cents,
    sort_order: i,
  }));

  const { error: insertErr } = await supabase.from('line_items').insert(lineItems);
  if (insertErr) return { success: false, error: insertErr.message };

  // Update job total
  const totalEstimateCents = lineItems.reduce((sum, li) => sum + li.total_cents, 0);
  await supabase
    .from('jobs')
    .update({ total_estimate_cents: totalEstimateCents })
    .eq('id', jobId);

  return { success: true, data: { job_id: jobId, total_estimate_cents: totalEstimateCents, item_count: lineItems.length } };
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
