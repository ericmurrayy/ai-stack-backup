/**
 * Event Logging Helpers
 * =====================
 * Append-only event logging for jobs and actions.
 * Used by webhook handlers and approval routes to record
 * every state transition for audit and debugging.
 *
 * These functions NEVER throw — they log errors and return silently.
 * A failed event log should never block the primary operation.
 */

import { SupabaseClient } from '@supabase/supabase-js'

// ── Types ──────────────────────────────────────────────────────────

export interface JobEventInput {
  job_id: string
  owner_id: string
  event_type: string        // 'created' | 'status_changed' | 'assigned' | 'field_updated' | 'photo_added' | 'synced'
  actor_type?: string       // 'user' | 'system' | 'webhook' | 'n8n' | 'mobile'
  actor_id?: string
  old_value?: Record<string, unknown> | null
  new_value?: Record<string, unknown> | null
  metadata?: Record<string, unknown>
}

export interface ActionEventInput {
  action_id: string
  owner_id: string
  event_type: string        // 'created' | 'approved' | 'rejected' | 'executed' | 'failed' | 'webhook_sent' | 'webhook_failed'
  actor_type?: string       // 'user' | 'system' | 'webhook' | 'n8n'
  actor_id?: string
  old_status?: string | null
  new_status?: string | null
  metadata?: Record<string, unknown>
}

// ── Job Events ─────────────────────────────────────────────────────

/**
 * Log a job lifecycle event. Never throws.
 */
export async function logJobEvent(
  supabase: SupabaseClient,
  input: JobEventInput
): Promise<void> {
  try {
    const { error } = await supabase.from('job_events').insert({
      job_id: input.job_id,
      owner_id: input.owner_id,
      event_type: input.event_type,
      actor_type: input.actor_type || 'system',
      actor_id: input.actor_id || null,
      old_value: input.old_value || null,
      new_value: input.new_value || null,
      metadata: input.metadata || {},
    })
    if (error) {
      console.error('[EventLog] Failed to log job event:', error.message)
    }
  } catch (err: any) {
    console.error('[EventLog] Job event logging error:', err.message)
  }
}

// ── Action Events ──────────────────────────────────────────────────

/**
 * Log an action queue state transition event. Never throws.
 */
export async function logActionEvent(
  supabase: SupabaseClient,
  input: ActionEventInput
): Promise<void> {
  try {
    const { error } = await supabase.from('action_events').insert({
      action_id: input.action_id,
      owner_id: input.owner_id,
      event_type: input.event_type,
      actor_type: input.actor_type || 'system',
      actor_id: input.actor_id || null,
      old_status: input.old_status || null,
      new_status: input.new_status || null,
      metadata: input.metadata || {},
    })
    if (error) {
      console.error('[EventLog] Failed to log action event:', error.message)
    }
  } catch (err: any) {
    console.error('[EventLog] Action event logging error:', err.message)
  }
}
