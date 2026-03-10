// Murray's FSM - Recurring Jobs Service
// =======================================
// RRULE parsing, occurrence generation, and job creation from recurring templates

import type { RecurringJob } from '@murray-fsm/shared';
import { addDays, addWeeks, addMonths, addYears, format, isAfter, parseISO } from 'date-fns';

// ============================================================================
// Types
// ============================================================================

export interface ParsedRRule {
  freq: string;
  interval: number;
  byDay?: string[];
  count?: number;
  until?: string;
}

export interface GeneratedJobData {
  title: string;
  customer_id: string;
  location_id: string | null;
  service_type: string | null;
  description: string | null;
  scheduled_at: string;
  source: string;
  recurring_job_id: string;
}

// ============================================================================
// RRULE Parsing
// ============================================================================

/**
 * Parse an RRULE string into its components.
 *
 * Example input: "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR;COUNT=10"
 */
export function parseRRule(rrule: string): ParsedRRule {
  const cleaned = rrule.replace(/^RRULE:/, '');
  const parts = cleaned.split(';');

  const result: ParsedRRule = {
    freq: 'WEEKLY',
    interval: 1,
  };

  for (const part of parts) {
    const [key, value] = part.split('=');
    switch (key) {
      case 'FREQ':
        result.freq = value;
        break;
      case 'INTERVAL':
        result.interval = parseInt(value, 10) || 1;
        break;
      case 'BYDAY':
        result.byDay = value.split(',');
        break;
      case 'COUNT':
        result.count = parseInt(value, 10);
        break;
      case 'UNTIL':
        result.until = value;
        break;
    }
  }

  return result;
}

// ============================================================================
// RRULE Building
// ============================================================================

/**
 * Build an RRULE string from parameters.
 *
 * @returns RRULE string (e.g., "FREQ=MONTHLY;INTERVAL=1")
 */
export function buildRRule(params: {
  freq: string;
  interval?: number;
  byDay?: string[];
  count?: number;
  until?: string;
}): string {
  const parts: string[] = [`FREQ=${params.freq.toUpperCase()}`];

  if (params.interval && params.interval > 1) {
    parts.push(`INTERVAL=${params.interval}`);
  }

  if (params.byDay && params.byDay.length > 0) {
    parts.push(`BYDAY=${params.byDay.join(',')}`);
  }

  if (params.count != null) {
    parts.push(`COUNT=${params.count}`);
  }

  if (params.until) {
    parts.push(`UNTIL=${params.until}`);
  }

  return parts.join(';');
}

// ============================================================================
// Occurrence Calculation
// ============================================================================

/**
 * Day abbreviation to day-of-week number (0 = Sunday).
 */
const DAY_MAP: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

/**
 * Get the next occurrence of a recurring rule after a given date.
 *
 * @param rrule - RRULE string
 * @param after - Date after which to find the next occurrence (defaults to now)
 * @returns The next occurrence date, or null if the rule has expired
 */
export function getNextOccurrence(rrule: string, after?: Date): Date | null {
  const parsed = parseRRule(rrule);
  const startDate = after || new Date();

  // Check UNTIL constraint
  if (parsed.until) {
    const untilDate = parseISO(parsed.until);
    if (isAfter(startDate, untilDate)) {
      return null;
    }
  }

  // For BYDAY rules, find the next matching day
  if (parsed.byDay && parsed.byDay.length > 0) {
    const targetDays = parsed.byDay
      .map((d) => DAY_MAP[d.toUpperCase()])
      .filter((d) => d !== undefined);

    if (targetDays.length > 0) {
      // Look ahead up to 7 days for the next matching day
      for (let i = 1; i <= 7; i++) {
        const candidate = addDays(startDate, i);
        if (targetDays.includes(candidate.getDay())) {
          return candidate;
        }
      }
    }
  }

  // Simple frequency-based next occurrence
  switch (parsed.freq.toUpperCase()) {
    case 'DAILY':
      return addDays(startDate, parsed.interval);
    case 'WEEKLY':
      return addWeeks(startDate, parsed.interval);
    case 'MONTHLY':
      return addMonths(startDate, parsed.interval);
    case 'YEARLY':
      return addYears(startDate, parsed.interval);
    default:
      return addWeeks(startDate, parsed.interval);
  }
}

// ============================================================================
// Job Generation
// ============================================================================

/**
 * Generate a job data object from a recurring job template and an occurrence date.
 */
export function generateJobFromRecurring(
  recurring: RecurringJob,
  occurrenceDate: Date
): GeneratedJobData {
  return {
    title: recurring.title,
    customer_id: recurring.customer_id || '',
    location_id: recurring.location_id,
    service_type: recurring.service_type,
    description: recurring.description,
    scheduled_at: format(occurrenceDate, "yyyy-MM-dd'T'HH:mm:ssxxx"),
    source: 'recurring',
    recurring_job_id: recurring.id,
  };
}
