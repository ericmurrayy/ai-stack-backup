// packages/shared/src/types.ts
// Murray's FSM - Shared Types
// ============================

// === Technicians ===
export type TechnicianRole = 'technician' | 'dispatcher' | 'admin';

export interface Technician {
  id: string;
  owner_id: string;
  profile_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  role: TechnicianRole;
  skills: string[];
  hourly_rate_cents: number | null;
  color: string;
  is_active: boolean;
  availability: Record<string, { start: string; end: string } | null>;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

// === Inventory ===
export type InventoryTxType = 'purchase' | 'use' | 'adjustment' | 'return';

export interface InventoryItem {
  id: string;
  owner_id: string;
  name: string;
  sku: string | null;
  description: string | null;
  category: string | null;
  unit_of_measure: string;
  cost_cents: number;
  price_cents: number;
  qty_on_hand: number;
  qty_reserved: number;
  reorder_point: number;
  reorder_qty: number;
  vendor: string | null;
  vendor_part_number: string | null;
  location_in_shop: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

export interface InventoryTransaction {
  id: string;
  owner_id: string;
  item_id: string;
  transaction_type: InventoryTxType;
  qty_change: number;
  job_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

// === Recurring Jobs ===
export interface RecurringJob {
  id: string;
  owner_id: string;
  customer_id: string | null;
  location_id: string | null;
  title: string;
  service_type: string | null;
  description: string | null;
  rrule: string;
  duration_minutes: number;
  assigned_technician_id: string | null;
  line_items_template: Array<{ name: string; qty: number; unit_price_cents: number }>;
  next_occurrence_at: string | null;
  last_generated_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

// === Reviews ===
export type ReviewPlatform = 'google' | 'yelp' | 'facebook' | 'direct' | 'other';

export interface Review {
  id: string;
  owner_id: string;
  customer_id: string | null;
  job_id: string | null;
  platform: ReviewPlatform;
  reviewer_name: string | null;
  rating: number;
  review_text: string | null;
  response_text: string | null;
  responded_at: string | null;
  external_review_id: string | null;
  review_url: string | null;
  reviewed_at: string;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

// === Campaigns ===
export type CampaignType = 'email' | 'sms' | 'both';
export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed';
export type CampaignChannel = 'email' | 'sms';
export type CampaignRecipientStatus = 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';

export interface Campaign {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  type: CampaignType;
  status: CampaignStatus;
  template_subject: string | null;
  template_body: string | null;
  target_filter: Record<string, unknown>;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  stats: { sent: number; delivered: number; opened: number; clicked: number; converted: number };
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

export interface CampaignRecipient {
  id: string;
  owner_id: string;
  campaign_id: string;
  customer_id: string;
  channel: CampaignChannel;
  destination: string;
  status: CampaignRecipientStatus;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  created_at: string;
}

// === Pipeline ===
export interface PipelineStage {
  id: string;
  owner_id: string;
  name: string;
  color: string;
  sort_order: number;
  is_won: boolean;
  is_lost: boolean;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

export interface Lead {
  id: string;
  owner_id: string;
  customer_id: string | null;
  stage_id: string | null;
  title: string;
  description: string | null;
  source: string | null;
  estimated_value_cents: number;
  probability: number;
  assigned_technician_id: string | null;
  expected_close_date: string | null;
  won_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

// === Time Entries ===
export type TimeEntryType = 'travel' | 'work' | 'break';

export interface TimeEntry {
  id: string;
  owner_id: string;
  technician_id: string;
  job_id: string | null;
  entry_type: TimeEntryType;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

// === Estimates ===
export type EstimateStatus = 'draft' | 'sent' | 'viewed' | 'approved' | 'rejected' | 'expired';

export interface Estimate {
  id: string;
  owner_id: string;
  customer_id: string | null;
  location_id: string | null;
  estimate_number: string | null;
  status: EstimateStatus;
  title: string;
  notes: string | null;
  valid_until: string | null;
  total_cents: number;
  sent_at: string | null;
  approved_at: string | null;
  converted_job_id: string | null;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

export interface EstimateItem {
  id: string;
  owner_id: string;
  estimate_id: string;
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

// === Notifications ===
export interface Notification {
  id: string;
  owner_id: string;
  title: string;
  body: string | null;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

// === Service Agreements ===
export type AgreementType = 'maintenance' | 'warranty' | 'membership';
export type AgreementStatus = 'active' | 'expired' | 'canceled';
export type BillingCycle = 'monthly' | 'quarterly' | 'annual';

export interface ServiceAgreement {
  id: string;
  owner_id: string;
  customer_id: string;
  location_id: string | null;
  name: string;
  description: string | null;
  type: AgreementType;
  status: AgreementStatus;
  start_date: string;
  end_date: string | null;
  recurring_job_id: string | null;
  price_cents: number;
  billing_cycle: BillingCycle;
  terms: string | null;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

// === Tags ===
export interface Tag {
  id: string;
  owner_id: string;
  entity_type: string;
  entity_id: string;
  tag: string;
  created_at: string;
}

// === Job Priority ===
export type JobPriority = 'low' | 'normal' | 'high' | 'emergency';
