// Murray FSM - Zod Validation Schemas
// ====================================
// Comprehensive input validation for all API endpoints

import { z } from 'zod';

// ============================================================================
// COMMON SCHEMAS & HELPERS
// ============================================================================

// Phone number validation (E.164 format or common US formats)
const phoneRegex = /^(\+?1?[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/;

export const PhoneSchema = z.string()
  .regex(phoneRegex, 'Invalid phone number format')
  .transform((val) => {
    // Normalize to E.164
    const digits = val.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    // Fallback: prepend +1 if we got here with valid regex match
    return `+1${digits.slice(-10)}`;
  });

export const EmailSchema = z.string().email('Invalid email address').max(254);

export const UUIDSchema = z.string().uuid('Invalid UUID format');

export const DateTimeSchema = z.string().datetime({ message: 'Invalid ISO 8601 datetime' });

export const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)');

export const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)');

export const MoneySchema = z.number().int().min(0, 'Amount must be positive');

export const PercentageSchema = z.number().min(0).max(100);

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ============================================================================
// CUSTOMER SCHEMAS
// ============================================================================

export const CustomerCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  phone: PhoneSchema.optional().nullable(),
  email: EmailSchema.optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  source: z.string().max(100).optional(),
  referral_code: z.string().max(50).optional(),
  communication_preferences: z.object({
    email_marketing: z.boolean().default(true),
    sms_marketing: z.boolean().default(true),
    appointment_reminders: z.boolean().default(true),
    review_requests: z.boolean().default(true),
  }).optional(),
});

export const CustomerUpdateSchema = CustomerCreateSchema.partial();

export const CustomerSearchSchema = z.object({
  query: z.string().max(200).optional(),
  tags: z.array(z.string()).optional(),
  hasEmail: z.coerce.boolean().optional(),
  hasPhone: z.coerce.boolean().optional(),
  minLifetimeValue: z.coerce.number().int().optional(),
  source: z.string().optional(),
}).merge(PaginationSchema);

// ============================================================================
// LOCATION SCHEMAS
// ============================================================================

const LocationBaseSchema = z.object({
  customer_id: UUIDSchema,
  address1: z.string().min(1, 'Address is required').max(200),
  address2: z.string().max(200).optional().nullable(),
  city: z.string().min(1, 'City is required').max(100),
  state: z.string().min(1, 'State is required').max(50),
  postal_code: z.string().min(1, 'Postal code is required').max(20),
  access_notes: z.string().max(1000).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
});

export const LocationCreateSchema = LocationBaseSchema.refine(
  (data) => {
    const hasLat = data.lat != null;
    const hasLng = data.lng != null;
    return hasLat === hasLng;
  },
  { message: 'Both latitude and longitude must be provided together', path: ['lat'] }
);

export const LocationUpdateSchema = LocationBaseSchema.omit({ customer_id: true }).partial().refine(
  (data) => {
    const hasLat = data.lat != null;
    const hasLng = data.lng != null;
    return hasLat === hasLng;
  },
  { message: 'Both latitude and longitude must be provided together', path: ['lat'] }
);

// ============================================================================
// JOB SCHEMAS
// ============================================================================

export const JobStatusSchema = z.enum([
  'scheduled',
  'in_progress',
  'completed',
  'canceled',
]);

export const JobPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']).default('medium');

const JobBaseSchema = z.object({
  customer_id: UUIDSchema,
  location_id: UUIDSchema.optional().nullable(),
  title: z.string().min(1, 'Title is required').max(200),
  service_type: z.string().max(100).optional().nullable(),
  problem_description: z.string().max(5000).optional().nullable(),
  scheduled_start: DateTimeSchema.optional().nullable(),
  scheduled_end: DateTimeSchema.optional().nullable(),
  internal_notes: z.string().max(5000).optional().nullable(),
  customer_notes: z.string().max(2000).optional().nullable(),
  assigned_to: UUIDSchema.optional().nullable(),
  priority: z.coerce.number().int().min(0).max(10).default(0),
  tags: z.array(z.string().max(50)).max(20).optional(),
  custom_fields: z.record(z.unknown()).optional(),
  estimated_duration_minutes: z.coerce.number().int().min(0).max(1440).optional(),
  contract_id: UUIDSchema.optional().nullable(),
  is_recurring: z.boolean().default(false),
});

export const JobCreateSchema = JobBaseSchema.refine(
  (data) => {
    if (data.scheduled_start && data.scheduled_end) {
      return new Date(data.scheduled_end) > new Date(data.scheduled_start);
    }
    return true;
  },
  { message: 'End time must be after start time', path: ['scheduled_end'] }
);

export const JobUpdateSchema = JobBaseSchema.partial().extend({
  status: JobStatusSchema.optional(),
  arrived_at: DateTimeSchema.optional().nullable(),
  started_at: DateTimeSchema.optional().nullable(),
  completed_at: DateTimeSchema.optional().nullable(),
  actual_duration_minutes: z.coerce.number().int().min(0).optional().nullable(),
  drive_time_minutes: z.coerce.number().int().min(0).optional().nullable(),
  customer_rating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  customer_feedback: z.string().max(2000).optional().nullable(),
}).refine(
  (data) => {
    if (data.scheduled_start && data.scheduled_end) {
      return new Date(data.scheduled_end) > new Date(data.scheduled_start);
    }
    return true;
  },
  { message: 'End time must be after start time', path: ['scheduled_end'] }
);

export const JobListSchema = z.object({
  status: z.union([JobStatusSchema, z.array(JobStatusSchema)]).optional(),
  customer_id: UUIDSchema.optional(),
  assigned_to: UUIDSchema.optional(),
  scheduled_after: DateTimeSchema.optional(),
  scheduled_before: DateTimeSchema.optional(),
  service_type: z.string().optional(),
  tags: z.array(z.string()).optional(),
}).merge(PaginationSchema);

// ============================================================================
// QUOTE SCHEMAS
// ============================================================================

export const QuoteStatusSchema = z.enum(['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired']);

export const QuoteLineItemSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  quantity: z.coerce.number().min(0.01).max(99999),
  unit_price_cents: MoneySchema,
  sort_order: z.coerce.number().int().default(0),
});

export const QuoteCreateSchema = z.object({
  customer_id: UUIDSchema,
  job_id: UUIDSchema.optional().nullable(),
  title: z.string().min(1).max(200).optional(),
  notes: z.string().max(5000).optional().nullable(),
  terms: z.string().max(5000).optional().nullable(),
  valid_until: DateTimeSchema.optional().nullable(),
  line_items: z.array(QuoteLineItemSchema).min(1, 'At least one line item is required'),
  tax_rate: PercentageSchema.default(0),
  discount_cents: MoneySchema.default(0),
  discount_percent: PercentageSchema.default(0),
});

export const QuoteUpdateSchema = QuoteCreateSchema.partial().extend({
  status: QuoteStatusSchema.optional(),
});

// ============================================================================
// INVOICE SCHEMAS
// ============================================================================

export const InvoiceStatusSchema = z.enum(['draft', 'sent', 'viewed', 'paid', 'partial', 'overdue', 'void']);

export const InvoiceLineItemSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  quantity: z.coerce.number().min(0.01).max(99999),
  unit_price_cents: MoneySchema,
  sort_order: z.coerce.number().int().default(0),
});

export const InvoiceCreateSchema = z.object({
  customer_id: UUIDSchema,
  job_id: UUIDSchema.optional().nullable(),
  quote_id: UUIDSchema.optional().nullable(),
  title: z.string().min(1).max(200).optional(),
  notes: z.string().max(5000).optional().nullable(),
  terms: z.string().max(5000).optional().nullable(),
  due_date: DateSchema.optional().nullable(),
  line_items: z.array(InvoiceLineItemSchema).min(1, 'At least one line item is required'),
  tax_rate: PercentageSchema.default(0),
  discount_cents: MoneySchema.default(0),
  discount_percent: PercentageSchema.default(0),
});

export const InvoiceUpdateSchema = InvoiceCreateSchema.partial().extend({
  status: InvoiceStatusSchema.optional(),
});

// ============================================================================
// PAYMENT SCHEMAS
// ============================================================================

export const PaymentStatusSchema = z.enum([
  'pending',
  'processing',
  'succeeded',
  'failed',
  'canceled',
  'refunded',
]);

export const PaymentMethodSchema = z.enum(['card', 'cash', 'check', 'bank_transfer', 'other']);

export const PaymentCreateSchema = z.object({
  job_id: UUIDSchema,
  invoice_id: UUIDSchema.optional().nullable(),
  amount_cents: MoneySchema.refine((val) => val > 0, 'Amount must be greater than zero'),
  method: PaymentMethodSchema.default('card'),
  provider: z.enum(['stripe', 'square', 'manual']).default('manual'),
  notes: z.string().max(500).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

export const PaymentUpdateSchema = z.object({
  status: PaymentStatusSchema.optional(),
  notes: z.string().max(500).optional().nullable(),
});

// ============================================================================
// TEAM MEMBER SCHEMAS
// ============================================================================

export const TeamRoleSchema = z.enum(['owner', 'admin', 'dispatcher', 'technician', 'office']);

export const TeamMemberCreateSchema = z.object({
  email: EmailSchema,
  full_name: z.string().min(1).max(200),
  phone: PhoneSchema.optional().nullable(),
  role: TeamRoleSchema.default('technician'),
  hourly_rate_cents: MoneySchema.default(0),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').default('#3b82f6'),
  avatar_url: z.string().url().max(500).optional().nullable(),
  skills: z.array(z.string().max(50)).max(50).optional(),
  service_areas: z.array(z.string().max(20)).max(100).optional(),
  can_login: z.boolean().default(true),
  permissions: z.record(z.boolean()).optional(),
});

export const TeamMemberUpdateSchema = TeamMemberCreateSchema.partial().extend({
  is_active: z.boolean().optional(),
});

// ============================================================================
// TIME ENTRY SCHEMAS
// ============================================================================

const TimeEntryBaseSchema = z.object({
  team_member_id: UUIDSchema,
  job_id: UUIDSchema.optional().nullable(),
  clock_in: DateTimeSchema,
  clock_out: DateTimeSchema.optional().nullable(),
  break_minutes: z.coerce.number().int().min(0).max(480).default(0),
  notes: z.string().max(1000).optional().nullable(),
});

export const TimeEntryCreateSchema = TimeEntryBaseSchema.refine(
  (data) => {
    if (data.clock_in && data.clock_out) {
      return new Date(data.clock_out) > new Date(data.clock_in);
    }
    return true;
  },
  { message: 'Clock out must be after clock in', path: ['clock_out'] }
);

export const TimeEntryUpdateSchema = TimeEntryBaseSchema.partial().extend({
  approved: z.boolean().optional(),
  approved_by: UUIDSchema.optional().nullable(),
}).refine(
  (data) => {
    if (data.clock_in && data.clock_out) {
      return new Date(data.clock_out) > new Date(data.clock_in);
    }
    return true;
  },
  { message: 'Clock out must be after clock in', path: ['clock_out'] }
);

// ============================================================================
// LEAD SCHEMAS
// ============================================================================

export const LeadSourceSchema = z.enum([
  'website',
  'referral',
  'google',
  'facebook',
  'phone',
  'walk-in',
  'other',
]);

export const LeadCreateSchema = z.object({
  customer_id: UUIDSchema.optional().nullable(),
  stage_id: UUIDSchema.optional().nullable(),
  assigned_to: UUIDSchema.optional().nullable(),
  source: LeadSourceSchema.optional(),
  source_detail: z.string().max(200).optional().nullable(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  estimated_value_cents: MoneySchema.default(0),
  probability: PercentageSchema.default(50),
  expected_close_date: DateSchema.optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  custom_fields: z.record(z.unknown()).optional(),
});

export const LeadUpdateSchema = LeadCreateSchema.partial().extend({
  next_follow_up_at: DateTimeSchema.optional().nullable(),
  lost_reason: z.string().max(500).optional().nullable(),
});

export const LeadActivityCreateSchema = z.object({
  lead_id: UUIDSchema,
  activity_type: z.enum(['note', 'call', 'email', 'sms', 'meeting', 'stage_change']),
  description: z.string().max(5000).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

// ============================================================================
// INVENTORY SCHEMAS
// ============================================================================

export const InventoryItemCreateSchema = z.object({
  sku: z.string().max(100).optional().nullable(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  unit: z.string().max(20).default('each'),
  cost_cents: MoneySchema.default(0),
  price_cents: MoneySchema.default(0),
  quantity_on_hand: z.coerce.number().min(0).default(0),
  reorder_point: z.coerce.number().min(0).default(5),
  reorder_quantity: z.coerce.number().min(0).default(10),
  supplier: z.string().max(200).optional().nullable(),
  supplier_sku: z.string().max(100).optional().nullable(),
  location: z.string().max(100).optional().nullable(),
  image_url: z.string().url().max(500).optional().nullable(),
});

export const InventoryItemUpdateSchema = InventoryItemCreateSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const InventoryTransactionSchema = z.object({
  inventory_item_id: UUIDSchema,
  transaction_type: z.enum(['purchase', 'sale', 'adjustment', 'return', 'job_use']),
  quantity: z.number().refine((val) => val !== 0, 'Quantity cannot be zero'),
  unit_cost_cents: MoneySchema.optional(),
  reference_type: z.enum(['job', 'purchase_order', 'manual']).optional(),
  reference_id: UUIDSchema.optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const JobPartSchema = z.object({
  job_id: UUIDSchema,
  inventory_item_id: UUIDSchema.optional().nullable(),
  name: z.string().min(1).max(200),
  quantity: z.coerce.number().min(0.01).max(9999),
  cost_cents: MoneySchema.default(0),
  price_cents: MoneySchema.default(0),
  notes: z.string().max(500).optional().nullable(),
});

// ============================================================================
// MAINTENANCE CONTRACT SCHEMAS
// ============================================================================

export const RecurrenceFrequencySchema = z.enum([
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'biannual',
  'annual',
]);

export const MaintenanceContractCreateSchema = z.object({
  customer_id: UUIDSchema,
  location_id: UUIDSchema.optional().nullable(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  service_type: z.string().max(100).optional().nullable(),
  frequency: RecurrenceFrequencySchema,
  day_of_week: z.coerce.number().int().min(0).max(6).optional().nullable(),
  day_of_month: z.coerce.number().int().min(1).max(31).optional().nullable(),
  month_of_year: z.coerce.number().int().min(1).max(12).optional().nullable(),
  preferred_time_start: TimeSchema.optional().nullable(),
  preferred_time_end: TimeSchema.optional().nullable(),
  duration_minutes: z.coerce.number().int().min(15).max(480).default(60),
  base_price_cents: MoneySchema.default(0),
  auto_generate_invoice: z.boolean().default(true),
  auto_send_reminder: z.boolean().default(true),
  reminder_days_before: z.coerce.number().int().min(0).max(30).default(3),
  start_date: DateSchema,
  end_date: DateSchema.optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const MaintenanceContractUpdateSchema = MaintenanceContractCreateSchema.partial().extend({
  is_active: z.boolean().optional(),
});

// ============================================================================
// REVIEW SCHEMAS
// ============================================================================

export const ReviewPlatformSchema = z.enum([
  'google',
  'yelp',
  'facebook',
  'homeadvisor',
  'angieslist',
  'bbb',
  'internal',
]);

export const ReviewCreateSchema = z.object({
  customer_id: UUIDSchema.optional().nullable(),
  job_id: UUIDSchema.optional().nullable(),
  platform: ReviewPlatformSchema,
  external_review_id: z.string().max(200).optional().nullable(),
  reviewer_name: z.string().max(200).optional().nullable(),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().max(200).optional().nullable(),
  content: z.string().max(5000).optional().nullable(),
  review_date: DateTimeSchema.optional().nullable(),
  review_url: z.string().url().max(500).optional().nullable(),
});

export const ReviewResponseSchema = z.object({
  review_id: UUIDSchema,
  response: z.string().min(1).max(2000),
});

export const ReviewRequestCreateSchema = z.object({
  customer_id: UUIDSchema,
  job_id: UUIDSchema.optional().nullable(),
  sent_via: z.enum(['sms', 'email']),
});

// ============================================================================
// MARKETING CAMPAIGN SCHEMAS
// ============================================================================

export const CampaignTypeSchema = z.enum(['email', 'sms', 'both']);
export const CampaignStatusSchema = z.enum(['draft', 'scheduled', 'active', 'paused', 'completed']);

export const CampaignCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  campaign_type: CampaignTypeSchema,
  target_audience: z.object({
    tags: z.array(z.string()).optional(),
    service_types: z.array(z.string()).optional(),
    min_lifetime_value: z.number().optional(),
    last_service_before: z.string().optional(),
    last_service_after: z.string().optional(),
    zip_codes: z.array(z.string()).optional(),
  }).optional(),
  email_subject: z.string().max(200).optional().nullable(),
  email_content: z.string().max(50000).optional().nullable(),
  sms_content: z.string().max(1600).optional().nullable(),
  scheduled_at: DateTimeSchema.optional().nullable(),
});

export const CampaignUpdateSchema = CampaignCreateSchema.partial().extend({
  status: CampaignStatusSchema.optional(),
});

// ============================================================================
// REFERRAL SCHEMAS
// ============================================================================

export const ReferralCreateSchema = z.object({
  referrer_customer_id: UUIDSchema,
  referred_name: z.string().min(1).max(200),
  referred_phone: PhoneSchema.optional().nullable(),
  referred_email: EmailSchema.optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
}).refine(
  (data) => data.referred_phone || data.referred_email,
  { message: 'Either phone or email is required', path: ['referred_phone'] }
);

export const ReferralUpdateSchema = z.object({
  status: z.enum(['pending', 'contacted', 'converted', 'expired']).optional(),
  referred_customer_id: UUIDSchema.optional().nullable(),
  converted_job_id: UUIDSchema.optional().nullable(),
  referrer_reward_cents: MoneySchema.optional(),
  referrer_reward_paid: z.boolean().optional(),
  referred_discount_cents: MoneySchema.optional(),
  notes: z.string().max(1000).optional().nullable(),
});

// ============================================================================
// SURVEY SCHEMAS
// ============================================================================

export const SurveyCreateSchema = z.object({
  customer_id: UUIDSchema,
  job_id: UUIDSchema.optional().nullable(),
  template_id: UUIDSchema.optional().nullable(),
  sent_via: z.enum(['sms', 'email']),
});

export const SurveyResponseSchema = z.object({
  survey_id: UUIDSchema,
  responses: z.array(z.object({
    question_id: z.string(),
    answer: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  })),
  overall_rating: z.coerce.number().int().min(1).max(5).optional(),
  comments: z.string().max(2000).optional().nullable(),
});

// ============================================================================
// WORK ORDER SCHEMAS
// ============================================================================

export const WorkOrderCreateSchema = z.object({
  job_id: UUIDSchema,
  template_id: UUIDSchema.optional().nullable(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  checklist_items: z.array(z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(500).optional(),
    is_required: z.boolean().default(false),
    sort_order: z.number().int().default(0),
  })).optional(),
});

export const WorkOrderItemUpdateSchema = z.object({
  work_order_item_id: UUIDSchema,
  status: z.enum(['pending', 'passed', 'failed', 'na']),
  notes: z.string().max(1000).optional().nullable(),
  photo_url: z.string().url().max(500).optional().nullable(),
});

// ============================================================================
// EXPENSE SCHEMAS
// ============================================================================

export const ExpenseCreateSchema = z.object({
  category: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  amount_cents: MoneySchema.refine((val) => val > 0, 'Amount must be greater than zero'),
  date: DateSchema,
  vendor: z.string().max(200).optional().nullable(),
  job_id: UUIDSchema.optional().nullable(),
  team_member_id: UUIDSchema.optional().nullable(),
  receipt_url: z.string().url().max(500).optional().nullable(),
  is_billable: z.boolean().default(false),
  is_reimbursable: z.boolean().default(false),
  reimbursed: z.boolean().default(false),
  notes: z.string().max(1000).optional().nullable(),
});

export const ExpenseUpdateSchema = ExpenseCreateSchema.partial();

// ============================================================================
// EQUIPMENT SCHEMAS
// ============================================================================

export const EquipmentTypeSchema = z.enum(['vehicle', 'tool', 'equipment']);
export const EquipmentStatusSchema = z.enum(['available', 'in_use', 'maintenance', 'retired']);

export const EquipmentCreateSchema = z.object({
  name: z.string().min(1).max(200),
  type: EquipmentTypeSchema,
  make: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  year: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  serial_number: z.string().max(100).optional().nullable(),
  license_plate: z.string().max(20).optional().nullable(),
  vin: z.string().max(20).optional().nullable(),
  assigned_to: UUIDSchema.optional().nullable(),
  purchase_date: DateSchema.optional().nullable(),
  purchase_price_cents: MoneySchema.optional().nullable(),
  current_value_cents: MoneySchema.optional().nullable(),
  odometer: z.coerce.number().int().min(0).optional().nullable(),
  last_service_date: DateSchema.optional().nullable(),
  next_service_date: DateSchema.optional().nullable(),
  service_interval_miles: z.coerce.number().int().min(0).optional().nullable(),
  warranty_expiry: DateSchema.optional().nullable(),
  insurance_expiry: DateSchema.optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const EquipmentUpdateSchema = EquipmentCreateSchema.partial().extend({
  status: EquipmentStatusSchema.optional(),
  fuel_level: z.coerce.number().int().min(0).max(100).optional().nullable(),
});

// ============================================================================
// FOLLOW-UP SCHEMAS
// ============================================================================

export const FollowUpCreateSchema = z.object({
  customer_id: UUIDSchema,
  job_id: UUIDSchema.optional().nullable(),
  lead_id: UUIDSchema.optional().nullable(),
  type: z.enum(['call', 'email', 'sms', 'visit']),
  scheduled_at: DateTimeSchema,
  assigned_to: UUIDSchema.optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  priority: z.coerce.number().int().min(0).max(10).default(0),
});

export const FollowUpUpdateSchema = FollowUpCreateSchema.partial().extend({
  status: z.enum(['pending', 'completed', 'skipped', 'rescheduled']).optional(),
  completed_at: DateTimeSchema.optional().nullable(),
  outcome: z.string().max(1000).optional().nullable(),
});

// ============================================================================
// ANALYTICS SCHEMAS
// ============================================================================

export const AnalyticsQuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d', '365d', 'custom']).default('30d'),
  start_date: DateSchema.optional(),
  end_date: DateSchema.optional(),
  group_by: z.enum(['day', 'week', 'month']).default('day'),
  metrics: z.array(z.string()).optional(),
}).refine(
  (data) => {
    if (data.range === 'custom') {
      return data.start_date && data.end_date;
    }
    return true;
  },
  { message: 'Start and end dates are required for custom range', path: ['start_date'] }
);

// ============================================================================
// SETTINGS SCHEMAS
// ============================================================================

export const BusinessSettingsSchema = z.object({
  business_name: z.string().max(200).optional(),
  business_phone: PhoneSchema.optional().nullable(),
  business_email: EmailSchema.optional().nullable(),
  business_website: z.string().url().max(200).optional().nullable(),
  business_address: z.string().max(200).optional().nullable(),
  business_city: z.string().max(100).optional().nullable(),
  business_state: z.string().max(50).optional().nullable(),
  business_zip: z.string().max(20).optional().nullable(),
  license_number: z.string().max(100).optional().nullable(),
  tax_id: z.string().max(50).optional().nullable(),
  hourly_rate_cents: MoneySchema.optional(),
  service_call_fee_cents: MoneySchema.optional(),
  emergency_fee_cents: MoneySchema.optional(),
  tax_rate: z.coerce.number().min(0).max(30).optional(),
  payment_terms_days: z.coerce.number().int().min(0).max(90).optional(),
  accept_cash: z.boolean().optional(),
  accept_check: z.boolean().optional(),
  accept_card: z.boolean().optional(),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  estimate_terms: z.string().max(5000).optional().nullable(),
  invoice_terms: z.string().max(5000).optional().nullable(),
  warranty_terms: z.string().max(5000).optional().nullable(),
});

// ============================================================================
// WEBHOOK SCHEMAS
// ============================================================================

export const WebhookEndpointCreateSchema = z.object({
  url: z.string().url().max(500),
  events: z.array(z.string()).min(1, 'At least one event is required'),
  description: z.string().max(500).optional().nullable(),
  is_active: z.boolean().default(true),
});

export const WebhookEndpointUpdateSchema = WebhookEndpointCreateSchema.partial();

// ============================================================================
// API KEY SCHEMAS
// ============================================================================

export const ApiKeyCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  scopes: z.array(z.string()).min(1, 'At least one scope is required'),
  expires_at: DateTimeSchema.optional().nullable(),
  rate_limit_per_minute: z.coerce.number().int().min(1).max(10000).default(100),
  allowed_ips: z.array(z.string().ip()).optional(),
});

// ============================================================================
// COMMUNICATION SCHEMAS
// ============================================================================

export const SendSmsSchema = z.object({
  to: PhoneSchema,
  body: z.string().min(1).max(1600),
  customer_id: UUIDSchema.optional().nullable(),
  job_id: UUIDSchema.optional().nullable(),
});

export const SendEmailSchema = z.object({
  to: EmailSchema,
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(100000),
  html: z.string().max(500000).optional(),
  customer_id: UUIDSchema.optional().nullable(),
  job_id: UUIDSchema.optional().nullable(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CustomerCreate = z.infer<typeof CustomerCreateSchema>;
export type CustomerUpdate = z.infer<typeof CustomerUpdateSchema>;
export type LocationCreate = z.infer<typeof LocationCreateSchema>;
export type LocationUpdate = z.infer<typeof LocationUpdateSchema>;
export type JobCreate = z.infer<typeof JobCreateSchema>;
export type JobUpdate = z.infer<typeof JobUpdateSchema>;
export type QuoteCreate = z.infer<typeof QuoteCreateSchema>;
export type QuoteUpdate = z.infer<typeof QuoteUpdateSchema>;
export type InvoiceCreate = z.infer<typeof InvoiceCreateSchema>;
export type InvoiceUpdate = z.infer<typeof InvoiceUpdateSchema>;
export type PaymentCreate = z.infer<typeof PaymentCreateSchema>;
export type PaymentUpdate = z.infer<typeof PaymentUpdateSchema>;
export type TeamMemberCreate = z.infer<typeof TeamMemberCreateSchema>;
export type TeamMemberUpdate = z.infer<typeof TeamMemberUpdateSchema>;
export type TimeEntryCreate = z.infer<typeof TimeEntryCreateSchema>;
export type TimeEntryUpdate = z.infer<typeof TimeEntryUpdateSchema>;
export type LeadCreate = z.infer<typeof LeadCreateSchema>;
export type LeadUpdate = z.infer<typeof LeadUpdateSchema>;
export type InventoryItemCreate = z.infer<typeof InventoryItemCreateSchema>;
export type InventoryItemUpdate = z.infer<typeof InventoryItemUpdateSchema>;
export type MaintenanceContractCreate = z.infer<typeof MaintenanceContractCreateSchema>;
export type MaintenanceContractUpdate = z.infer<typeof MaintenanceContractUpdateSchema>;
export type ReviewCreate = z.infer<typeof ReviewCreateSchema>;
export type CampaignCreate = z.infer<typeof CampaignCreateSchema>;
export type CampaignUpdate = z.infer<typeof CampaignUpdateSchema>;
export type ReferralCreate = z.infer<typeof ReferralCreateSchema>;
export type ReferralUpdate = z.infer<typeof ReferralUpdateSchema>;
export type ExpenseCreate = z.infer<typeof ExpenseCreateSchema>;
export type ExpenseUpdate = z.infer<typeof ExpenseUpdateSchema>;
export type EquipmentCreate = z.infer<typeof EquipmentCreateSchema>;
export type EquipmentUpdate = z.infer<typeof EquipmentUpdateSchema>;
export type FollowUpCreate = z.infer<typeof FollowUpCreateSchema>;
export type FollowUpUpdate = z.infer<typeof FollowUpUpdateSchema>;
export type BusinessSettings = z.infer<typeof BusinessSettingsSchema>;
