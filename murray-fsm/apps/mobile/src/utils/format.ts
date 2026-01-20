// Murray's FSM - Formatting Utilities
// =====================================

import { format, formatDistanceToNow, isToday, isTomorrow, parseISO } from 'date-fns';

// Currency formatting
export const formatCents = (cents: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
};

// Phone number formatting
export const formatPhone = (phone: string | null): string => {
  if (!phone) return '';

  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  // Format US numbers
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }

  return phone;
};

// Date formatting
export const formatDate = (dateString: string | null, formatStr = 'MMM d, yyyy'): string => {
  if (!dateString) return '';
  try {
    return format(parseISO(dateString), formatStr);
  } catch {
    return dateString;
  }
};

export const formatTime = (dateString: string | null): string => {
  if (!dateString) return '';
  try {
    return format(parseISO(dateString), 'h:mm a');
  } catch {
    return '';
  }
};

export const formatDateTime = (dateString: string | null): string => {
  if (!dateString) return '';
  try {
    return format(parseISO(dateString), 'MMM d, yyyy h:mm a');
  } catch {
    return dateString;
  }
};

export const formatRelativeTime = (dateString: string | null): string => {
  if (!dateString) return '';
  try {
    return formatDistanceToNow(parseISO(dateString), { addSuffix: true });
  } catch {
    return '';
  }
};

export const formatScheduleLabel = (dateString: string | null): string => {
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
};

// Address formatting
export const formatAddress = (
  address1: string,
  address2: string | null,
  city: string,
  state: string,
  postalCode: string
): string => {
  const parts = [
    address1,
    address2,
    `${city}, ${state} ${postalCode}`,
  ].filter(Boolean);
  return parts.join('\n');
};

export const formatAddressOneLine = (
  address1: string,
  city: string,
  state: string
): string => {
  return `${address1}, ${city}, ${state}`;
};

// Job status formatting
export const formatJobStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    scheduled: 'Scheduled',
    in_progress: 'In Progress',
    completed: 'Completed',
    canceled: 'Canceled',
  };
  return statusMap[status] || status;
};

// Duration formatting
export const formatDuration = (seconds: number | null): string => {
  if (!seconds) return '';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
};

// Name formatting
export const formatInitials = (name: string | null): string => {
  if (!name) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
};
