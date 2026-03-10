// Murray's FSM - Utilities
// ==========================

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, parseISO, isToday, isTomorrow } from 'date-fns';

// Class name utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Currency formatting
export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

// Phone number formatting
export function formatPhone(phone: string | null): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

// Date formatting
export function formatDate(dateString: string | null, formatStr = 'MMM d, yyyy'): string {
  if (!dateString) return '';
  try {
    return format(parseISO(dateString), formatStr);
  } catch {
    return dateString;
  }
}

export function formatTime(dateString: string | null): string {
  if (!dateString) return '';
  try {
    return format(parseISO(dateString), 'h:mm a');
  } catch {
    return '';
  }
}

export function formatDateTime(dateString: string | null): string {
  if (!dateString) return '';
  try {
    return format(parseISO(dateString), 'MMM d, yyyy h:mm a');
  } catch {
    return dateString;
  }
}

export function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return '';
  try {
    return formatDistanceToNow(parseISO(dateString), { addSuffix: true });
  } catch {
    return '';
  }
}

export function formatScheduleLabel(dateString: string | null): string {
  if (!dateString) return 'Unscheduled';
  try {
    const date = parseISO(dateString);
    if (isToday(date)) {
      return `Today at ${format(date, 'h:mm a')}`;
    }
    if (isTomorrow(date)) {
      return `Tomorrow at ${format(date, 'h:mm a')}`;
    }
    return format(date, 'EEE, MMM d at h:mm a');
  } catch {
    return dateString;
  }
}

// Duration formatting
export function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

// Job status config
export const jobStatusConfig: Record<string, { label: string; color: string }> = {
  new: { label: 'New', color: 'bg-blue-100 text-blue-800' },
  contacted: { label: 'Contacted', color: 'bg-indigo-100 text-indigo-800' },
  scheduled: { label: 'Scheduled', color: 'bg-cyan-100 text-cyan-800' },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-800' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
  spam: { label: 'Spam', color: 'bg-gray-100 text-gray-800' },
};

// Service category config
export const serviceCategoryConfig: Record<string, { label: string; color: string }> = {
  plumbing: { label: 'Plumbing', color: 'bg-blue-100 text-blue-800' },
  electrical: { label: 'Electrical', color: 'bg-yellow-100 text-yellow-800' },
  hvac: { label: 'HVAC', color: 'bg-cyan-100 text-cyan-800' },
  general: { label: 'General', color: 'bg-slate-100 text-slate-800' },
  landscaping: { label: 'Landscaping', color: 'bg-green-100 text-green-800' },
  cleaning: { label: 'Cleaning', color: 'bg-purple-100 text-purple-800' },
  painting: { label: 'Painting', color: 'bg-orange-100 text-orange-800' },
  roofing: { label: 'Roofing', color: 'bg-amber-100 text-amber-800' },
  other: { label: 'Other', color: 'bg-gray-100 text-gray-800' },
};

// Urgency config
export const urgencyConfig: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-slate-100 text-slate-800' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-800' },
  emergency: { label: 'Emergency', color: 'bg-red-100 text-red-800' },
};

// Action status config
export const actionStatusConfig = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Approved', color: 'bg-blue-100 text-blue-800' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
  executed: { label: 'Executed', color: 'bg-green-100 text-green-800' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-800' },
};

// Payment status config
export const paymentStatusConfig = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  processing: { label: 'Processing', color: 'bg-blue-100 text-blue-800' },
  succeeded: { label: 'Paid', color: 'bg-green-100 text-green-800' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-800' },
  canceled: { label: 'Canceled', color: 'bg-gray-100 text-gray-800' },
  refunded: { label: 'Refunded', color: 'bg-purple-100 text-purple-800' },
};

// Action kind config
export const actionKindConfig = {
  create_job: { label: 'Create Job', icon: 'briefcase' },
  schedule_job: { label: 'Schedule Job', icon: 'calendar' },
  reschedule_job: { label: 'Reschedule Job', icon: 'calendar' },
  create_estimate: { label: 'Create Estimate', icon: 'file-text' },
  send_estimate: { label: 'Send Estimate', icon: 'send' },
  send_sms: { label: 'Send SMS', icon: 'message-square' },
};
