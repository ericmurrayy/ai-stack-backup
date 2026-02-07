// Murray's FSM - Database Types
// ==============================

export type JobStatus = 'scheduled' | 'in_progress' | 'completed' | 'canceled';
export type PhotoKind = 'before' | 'after' | 'other';
export type LineItemKind = 'estimate' | 'invoice';
export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'canceled' | 'refunded';
export type CallDirection = 'inbound' | 'outbound';
export type MessageDirection = 'inbound' | 'outbound';
export type ActionStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
export type CalendarProvider = 'google' | 'outlook' | 'icloud';

export interface Profile {
  id: string;
  owner_id: string;
  full_name: string | null;
  phone: string | null;
  company_name: string | null;
  timezone: string;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

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
  diagnostics: Record<string, any>;
  total_estimate_cents: number;
  total_invoice_cents: number;
  paid_cents: number;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

export interface JobEvent {
  id: string;
  owner_id: string;
  job_id: string;
  event_type: string;
  payload: Record<string, any>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

export interface JobPhoto {
  id: string;
  owner_id: string;
  job_id: string;
  kind: PhotoKind;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  captured_at: string;
  caption: string | null;
  created_at: string;
  updated_at: string;
  deleted: boolean;
  // Local-only fields for offline support
  local_uri?: string;
  pending_upload?: boolean;
}

export interface JobSignature {
  id: string;
  owner_id: string;
  job_id: string;
  signer_name: string;
  signed_at: string;
  storage_bucket: string;
  storage_path: string;
  created_at: string;
  updated_at: string;
  deleted: boolean;
  // Local-only fields for offline support
  local_uri?: string;
  pending_upload?: boolean;
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
  total_cents: number;
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
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

export interface CommThread {
  id: string;
  owner_id: string;
  external_provider: string;
  external_phone_number_id: string | null;
  contact_phone: string;
  customer_id: string | null;
  last_activity_at: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

export interface CallLog {
  id: string;
  owner_id: string;
  external_call_id: string;
  thread_id: string | null;
  direction: CallDirection;
  from_phone: string;
  to_phone: string;
  started_at: string | null;
  ended_at: string | null;
  answered_at: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  transcript: string | null;
  summary: string | null;
  action_items: any[];
  ai_extraction: Record<string, any>;
  related_job_id: string | null;
  raw_event: Record<string, any> | null;
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
  media: any[];
  status: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  received_at: string | null;
  ai_extraction: Record<string, any>;
  related_job_id: string | null;
  raw_event: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

export interface ActionQueueItem {
  id: string;
  owner_id: string;
  source_type: string;
  source_id: string | null;
  kind: string;
  payload: Record<string, any>;
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

export interface CalendarEvent {
  id: string;
  owner_id: string;
  job_id: string;
  provider: CalendarProvider;
  external_event_id: string | null;
  calendar_id: string | null;
  last_synced_at: string;
  status: string;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

// Joined types for convenience
export interface JobWithRelations extends Job {
  customer?: Customer;
  location?: Location;
  line_items?: LineItem[];
  photos?: JobPhoto[];
  signatures?: JobSignature[];
  payments?: Payment[];
}
