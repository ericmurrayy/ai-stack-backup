// Murray's FSM - Database Types (Web)
// =====================================

export type JobStatus = 'new' | 'contacted' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'spam';
export type ServiceCategory = 'plumbing' | 'electrical' | 'hvac' | 'general' | 'landscaping' | 'cleaning' | 'painting' | 'roofing' | 'other';
export type Urgency = 'low' | 'medium' | 'high' | 'emergency';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type PhotoKind = 'before' | 'after' | 'other';
export type LineItemKind = 'estimate' | 'invoice';
export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'refunded';
export type CallDirection = 'inbound' | 'outbound';
export type MessageDirection = 'inbound' | 'outbound';
export type ActionStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
export type ActionKind = 'create_job' | 'schedule_job' | 'reschedule_job' | 'create_estimate' | 'send_estimate' | 'send_sms';
export type CalendarProvider = 'google' | 'outlook' | 'icloud';

export interface Profile {
  id: string;
  owner_id: string;
  full_name: string | null;
  phone: string | null;
  company_name: string | null;
  timezone: string;
  settings: Record<string, unknown>;
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
  job_number: string | null;
  phone_number: string | null;
  phone_e164: string | null;
  customer_name: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
  zip_code: string | null;
  service_category: ServiceCategory | null;
  urgency: Urgency | null;
  issue_description: string | null;
  preferred_time: string | null;
  scheduled_at: string | null;
  status: JobStatus;
  is_spam: boolean;
  spam_reason: string | null;
  extraction_confidence: number | null;
  recommended_action: string | null;
  source_event_id: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  assigned_technician_id: string | null;
  priority: Priority | null;
  source: string | null;
  recurring_job_id: string | null;
  estimate_id: string | null;
}

export interface Technician {
  id: string;
  owner_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: string | null;
  specialties: string[];
  hourly_rate_cents: number | null;
  is_active: boolean;
  color: string | null;
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
  metadata: Record<string, unknown>;
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
  action_items: unknown[];
  ai_extraction: Record<string, unknown>;
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
