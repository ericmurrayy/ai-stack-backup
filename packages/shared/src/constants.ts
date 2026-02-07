// Murray's FSM - Shared Constants
// =================================
// Status configurations, service types, and default values shared across web and mobile.

// ============================================================================
// Job Status Configuration
// ============================================================================

/** Valid job statuses matching the job_status enum in schema.sql (plus UI-only extended statuses) */
export type JobStatus =
  | 'lead'
  | 'quoted'
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'invoiced'
  | 'canceled';

/** Display configuration for each job status — colors, labels, and descriptions for UI rendering */
export const JOB_STATUS_CONFIG: Record<JobStatus, {
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
  description: string;
}> = {
  lead: {
    label: 'Lead',
    color: '#6366f1',
    bgColor: 'bg-indigo-100',
    textColor: 'text-indigo-800',
    description: 'New lead, not yet quoted',
  },
  quoted: {
    label: 'Quoted',
    color: '#8b5cf6',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-800',
    description: 'Estimate sent, waiting for approval',
  },
  scheduled: {
    label: 'Scheduled',
    color: '#3b82f6',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
    description: 'Job scheduled for future date',
  },
  confirmed: {
    label: 'Confirmed',
    color: '#06b6d4',
    bgColor: 'bg-cyan-100',
    textColor: 'text-cyan-800',
    description: 'Customer confirmed the appointment',
  },
  in_progress: {
    label: 'In Progress',
    color: '#f59e0b',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
    description: 'Work currently being performed',
  },
  completed: {
    label: 'Completed',
    color: '#22c55e',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    description: 'Work finished successfully',
  },
  invoiced: {
    label: 'Invoiced',
    color: '#10b981',
    bgColor: 'bg-emerald-100',
    textColor: 'text-emerald-800',
    description: 'Invoice sent to customer',
  },
  canceled: {
    label: 'Canceled',
    color: '#ef4444',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
    description: 'Job was canceled',
  },
};

// ============================================================================
// Payment Status Configuration
// ============================================================================

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'refunded';

/** Display configuration for each payment status — matches payment_status enum in schema.sql */
export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, {
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
}> = {
  pending: {
    label: 'Pending',
    color: '#f59e0b',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
  },
  processing: {
    label: 'Processing',
    color: '#3b82f6',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
  },
  succeeded: {
    label: 'Paid',
    color: '#22c55e',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
  },
  failed: {
    label: 'Failed',
    color: '#ef4444',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
  },
  canceled: {
    label: 'Canceled',
    color: '#6b7280',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
  },
  refunded: {
    label: 'Refunded',
    color: '#a855f7',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-800',
  },
};

// ============================================================================
// Action Status Configuration
// ============================================================================

export type ActionStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'failed';

/** Display configuration for action queue statuses — matches action_status enum in schema.sql */
export const ACTION_STATUS_CONFIG: Record<ActionStatus, {
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
}> = {
  pending: {
    label: 'Pending',
    color: '#f59e0b',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
  },
  approved: {
    label: 'Approved',
    color: '#3b82f6',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
  },
  rejected: {
    label: 'Rejected',
    color: '#ef4444',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
  },
  executed: {
    label: 'Executed',
    color: '#22c55e',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
  },
  failed: {
    label: 'Failed',
    color: '#ef4444',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
  },
};

// ============================================================================
// Action Kind Configuration
// ============================================================================

export type ActionKind =
  | 'create_job'
  | 'schedule_job'
  | 'reschedule_job'
  | 'create_estimate'
  | 'send_estimate'
  | 'send_invoice'
  | 'send_sms'
  | 'send_email';

/** Configuration for action queue kinds — used in AI-generated action proposals */
export const ACTION_KIND_CONFIG: Record<ActionKind, {
  label: string;
  icon: string;
  description: string;
}> = {
  create_job: {
    label: 'Create Job',
    icon: 'briefcase',
    description: 'Create a new job with customer and location',
  },
  schedule_job: {
    label: 'Schedule Job',
    icon: 'calendar',
    description: 'Set the scheduled date and time for a job',
  },
  reschedule_job: {
    label: 'Reschedule Job',
    icon: 'calendar-clock',
    description: 'Change the scheduled date and time',
  },
  create_estimate: {
    label: 'Create Estimate',
    icon: 'file-text',
    description: 'Create an estimate with line items',
  },
  send_estimate: {
    label: 'Send Estimate',
    icon: 'send',
    description: 'Send estimate to customer via SMS/email',
  },
  send_invoice: {
    label: 'Send Invoice',
    icon: 'receipt',
    description: 'Send invoice to customer for payment',
  },
  send_sms: {
    label: 'Send SMS',
    icon: 'message-square',
    description: 'Send an SMS message to customer',
  },
  send_email: {
    label: 'Send Email',
    icon: 'mail',
    description: 'Send an email to customer',
  },
};

// ============================================================================
// Service Type Configuration
// ============================================================================

/** Available garage door service types — used for job categorization and scheduling estimates */
export const SERVICE_TYPES = [
  'Garage Door Repair',
  'Garage Door Installation',
  'Garage Door Opener Repair',
  'Garage Door Opener Installation',
  'Spring Replacement',
  'Panel Replacement',
  'Track Repair',
  'Roller Replacement',
  'Weatherstripping',
  'Maintenance & Tune-up',
  'Emergency Service',
  'Other',
] as const;

export type ServiceType = typeof SERVICE_TYPES[number];

// ============================================================================
// US States
// ============================================================================

/** All 50 US states with 2-letter codes — used in address forms and location validation */
export const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
] as const;

// ============================================================================
// Default Values
// ============================================================================

/** Application-wide default values for pagination, scheduling, currency, and timezone */
export const DEFAULTS = {
  // Pagination
  PAGE_SIZE: 25,
  MAX_PAGE_SIZE: 100,

  // Job duration in minutes
  DEFAULT_JOB_DURATION: 120,

  // Reminder times in minutes before job
  REMINDER_TIMES: [1440, 60], // 24 hours, 1 hour

  // Tax rate (percentage)
  DEFAULT_TAX_RATE: 0,

  // Currency
  CURRENCY: 'USD',

  // Timezone
  TIMEZONE: 'America/Chicago',
} as const;
