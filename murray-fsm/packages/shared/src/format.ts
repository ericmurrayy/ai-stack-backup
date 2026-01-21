// Murray's FSM - Shared Formatting Utilities
// ===========================================
// Consolidated formatting functions for mobile and web

import { format, formatDistanceToNow, isToday, isTomorrow, parseISO } from 'date-fns';

// ============================================================================
// Currency Formatting
// ============================================================================

/**
 * Format cents to USD currency string
 * @param cents - Amount in cents
 * @returns Formatted currency string (e.g., "$123.45")
 */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

/**
 * Format cents to compact currency (for large amounts)
 * @param cents - Amount in cents
 * @returns Compact formatted string (e.g., "$1.2K")
 */
export function formatCentsCompact(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000000) {
    return `$${(dollars / 1000000).toFixed(1)}M`;
  }
  if (dollars >= 1000) {
    return `$${(dollars / 1000).toFixed(1)}K`;
  }
  return formatCents(cents);
}

// ============================================================================
// Phone Number Formatting
// ============================================================================

/**
 * Format phone number to US format
 * @param phone - Raw phone number string
 * @returns Formatted phone number (e.g., "(555) 123-4567")
 */
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

/**
 * Normalize phone number to E.164 format
 * @param phone - Raw phone number string
 * @returns E.164 formatted phone number (e.g., "+15551234567")
 */
export function normalizePhone(phone: string | null): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+${cleaned}`;
  }
  return phone;
}

// ============================================================================
// Date/Time Formatting
// ============================================================================

/**
 * Format ISO date string to readable date
 * @param dateString - ISO date string
 * @param formatStr - date-fns format string
 * @returns Formatted date string
 */
export function formatDate(dateString: string | null, formatStr = 'MMM d, yyyy'): string {
  if (!dateString) return '';
  try {
    return format(parseISO(dateString), formatStr);
  } catch {
    return dateString;
  }
}

/**
 * Format ISO date string to time only
 * @param dateString - ISO date string
 * @returns Formatted time string (e.g., "2:30 PM")
 */
export function formatTime(dateString: string | null): string {
  if (!dateString) return '';
  try {
    return format(parseISO(dateString), 'h:mm a');
  } catch {
    return '';
  }
}

/**
 * Format ISO date string to date and time
 * @param dateString - ISO date string
 * @returns Formatted date/time string (e.g., "Jan 15, 2024 2:30 PM")
 */
export function formatDateTime(dateString: string | null): string {
  if (!dateString) return '';
  try {
    return format(parseISO(dateString), 'MMM d, yyyy h:mm a');
  } catch {
    return dateString;
  }
}

/**
 * Format ISO date string to relative time
 * @param dateString - ISO date string
 * @returns Relative time string (e.g., "2 hours ago")
 */
export function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return '';
  try {
    return formatDistanceToNow(parseISO(dateString), { addSuffix: true });
  } catch {
    return '';
  }
}

/**
 * Format schedule date with smart labels (Today, Tomorrow, etc.)
 * @param dateString - ISO date string
 * @returns Smart schedule label
 */
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

// ============================================================================
// Duration Formatting
// ============================================================================

/**
 * Format seconds to human-readable duration
 * @param seconds - Duration in seconds
 * @returns Formatted duration string (e.g., "2h 30m")
 */
export function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

/**
 * Format minutes to human-readable duration
 * @param minutes - Duration in minutes
 * @returns Formatted duration string (e.g., "2h 30m")
 */
export function formatMinutes(minutes: number | null): string {
  if (!minutes) return '';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

// ============================================================================
// Address Formatting
// ============================================================================

/**
 * Format address to multi-line string
 * @returns Multi-line address string
 */
export function formatAddress(
  address1: string,
  address2: string | null,
  city: string,
  state: string,
  postalCode: string
): string {
  const parts = [
    address1,
    address2,
    `${city}, ${state} ${postalCode}`,
  ].filter(Boolean);
  return parts.join('\n');
}

/**
 * Format address to single line
 * @returns Single-line address string
 */
export function formatAddressOneLine(
  address1: string,
  city: string,
  state: string
): string {
  return `${address1}, ${city}, ${state}`;
}

// ============================================================================
// Name Formatting
// ============================================================================

/**
 * Get initials from a name
 * @param name - Full name
 * @returns Initials (e.g., "JD" for "John Doe")
 */
export function formatInitials(name: string | null): string {
  if (!name) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

/**
 * Truncate text with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text with ellipsis if needed
 */
export function truncate(text: string | null, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}
