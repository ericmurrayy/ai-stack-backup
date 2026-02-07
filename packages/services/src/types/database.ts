/**
 * Database Types for Murray's FSM — Services Package
 * ====================================================
 * Aligned with supabase/schema.sql (authoritative source)
 *
 * These types are used by service-layer code that interacts with Supabase.
 * For the web app, see apps/web/src/types/database.ts
 */

// ── Enums (matching schema.sql CREATE TYPE statements) ──

export type JobStatus = 'scheduled' | 'in_progress' | 'completed' | 'canceled';
export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'canceled' | 'refunded';
export type CallDirection = 'inbound' | 'outbound';
export type MessageDirection = 'inbound' | 'outbound';
export type ActionStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
export type ActionKind = 'create_job' | 'schedule_job' | 'reschedule_job' | 'create_estimate' | 'send_estimate' | 'send_sms';
export type LineItemKind = 'estimate' | 'invoice';
export type PhotoKind = 'before' | 'after' | 'other';

// ── Core Tables ──

export interface Customer {
  id: string;
  owner_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

export interface Job {
  id: string;
  owner_id: string;
  customer_id: string;
  location_id: string | null;
  title: string;
  service_type: string | null;
  problem_description: string | null;
  status: JobStatus;
  scheduled_start: string | null;
  scheduled_end: string | null;
  arrived_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  internal_notes: string | null;
  customer_notes: string | null;
  diagnostics: Record<string, unknown>;
  total_estimate_cents: number;
  total_invoice_cents: number;
  paid_cents: number;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

export interface Location {
  id: string;
  owner_id: string;
  customer_id: string;
  address1: string;
  address2: string | null;
  city: string;
  state: string;
  postal_code: string;
  access_notes: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

export interface LineItem {
  id: string;
  owner_id: string;
  job_id: string;
  kind: LineItemKind;
  name: string;
  description: string | null;
  qty: number;
  unit_price_cents: number;
  total_cents: number; // generated column
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

export interface Payment {
  id: string;
  owner_id: string;
  job_id: string;
  provider: string;
  stripe_payment_intent_id: string | null;
  amount_cents: number;
  status: PaymentStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

// ── Communication Tables ──

export interface CallLog {
  id: string;
  owner_id: string;
  external_call_id: string;
  thread_id: string | null;
  direction: CallDirection;
  from_phone: string;
  to_phone: string;
  duration_seconds: number;
  started_at: string | null;
  answered_at: string | null;
  ended_at: string | null;
  recording_url: string | null;
  transcript: string | null;
  summary: string | null;
  action_items: unknown[];
  ai_extraction: Record<string, unknown> | null;
  related_job_id: string | null;
  raw_event: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

export interface MessageLog {
  id: string;
  owner_id: string;
  external_message_id: string;
  thread_id: string | null;
  direction: MessageDirection;
  from_phone: string;
  to_phone: string;
  body: string | null;
  media: unknown[];
  status: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  received_at: string | null;
  ai_extraction: Record<string, unknown>;
  related_job_id: string | null;
  raw_event: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

export interface ActionQueueItem {
  id: string;
  owner_id: string;
  source_type: string;
  source_id: string | null;
  kind: ActionKind;
  payload: Record<string, unknown>;
  status: ActionStatus;
  requires_approval: boolean;
  approved_at: string | null;
  approved_by: string | null;
  executed_at: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}
