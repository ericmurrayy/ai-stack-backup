// Murray's FSM - Database Types
// ==============================

export type JobStatus = 'new' | 'contacted' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'spam';
export type ServiceCategory = 'plumbing' | 'electrical' | 'hvac' | 'general' | 'landscaping' | 'cleaning' | 'painting' | 'roofing' | 'other';
export type Urgency = 'low' | 'medium' | 'high' | 'emergency';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type EstimateStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired';
export type PhotoKind = 'before' | 'after' | 'other';
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
  job_number: string | null;
  phone_number: string | null;
  phone_e164: string | null;
  customer_name: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
  zip_code: string | null;
  title: string | null;
  service_type: string | null;
  service_category: ServiceCategory | null;
  urgency: Urgency | null;
  issue_description: string | null;
  problem_description: string | null;
  preferred_time: string | null;
  scheduled_at: string | null;
  scheduled_start: string | null;
  status: JobStatus;
  is_spam: boolean | null;
  spam_reason: string | null;
  extraction_confidence: number | null;
  recommended_action: string | null;
  source_event_id: string | null;
  assigned_technician_id: string | null;
  customer_id: string | null;
  location_id: string | null;
  priority: Priority | null;
  source: string | null;
  recurring_job_id: string | null;
  estimate_id: string | null;
  internal_notes: string | null;
  arrived_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  deleted: boolean;
}

export interface LineItem {
  id: string;
  owner_id: string;
  job_id: string;
  kind: 'estimate' | 'invoice';
  name?: string;
  description: string;
  qty: number;
  quantity: number;
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
  amount_cents: number;
  status: string;
  payment_method: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobWithRelations extends Job {
  customer?: Customer | null;
  location?: Location | null;
  line_items?: LineItem[];
  photos?: JobPhoto[];
  signatures?: JobSignature[];
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

export interface Technician {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  color: string | null;
  role: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  category: string | null;
  unit_cost_cents: number | null;
  sell_price_cents: number | null;
  quantity_on_hand: number;
  reorder_point: number | null;
  supplier: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string | null;
  title: string;
  body: string | null;
  type: string | null;
  is_read: boolean;
  data: Record<string, any> | null;
  created_at: string;
}

export interface Estimate {
  id: string;
  job_id: string | null;
  estimate_number: string | null;
  status: EstimateStatus | null;
  total_cents: number | null;
  notes: string | null;
  valid_until: string | null;
  approved_at: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
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

