// Murray's FSM - Recurring Jobs Service
// =======================================
// RRULE parsing, occurrence generation, and job creation from recurring templates

import type { RecurringJob } from '@murray-fsm/shared';
import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfDay,
  setHours,
  setMinutes,
  getDay,
} from 'date-fns';

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

export interface RRuleOptions {
  freq: string;
  interval?: number;
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
  scheduled_end: string;
  duration_minutes: number;
  assigned_technician_id: string | null;
  line_items: Array<{ name: string; qty: number; unit_price_cents: number }>;
  source: string;
  recurring_job_id: string;
}

// ============================================================================
// Day Mapping
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

/** Reverse mapping: day-of-week number to abbreviation. */
const REVERSE_DAY_MAP: Record<number, string> = {
  0: 'SU',
  1: 'MO',
  2: 'TU',
  3: 'WE',
  4: 'TH',
  5: 'FR',
  6: 'SA',
};

// ============================================================================
// RRULE Parsing
// ============================================================================

/**
 * Parse an RRULE string into its components.
 *
 * Supports: FREQ (DAILY, WEEKLY, MONTHLY, YEARLY), INTERVAL, BYDAY, UNTIL, COUNT.
 *
 * @param rruleString - RRULE string, optionally prefixed with "RRULE:"
 * @returns Parsed components
 *
 * @example
 *   parseRRule("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR;COUNT=10")
 *   // => { freq: 'WEEKLY', interval: 2, byDay: ['MO','WE','FR'], count: 10 }
 */
export function parseRRule(rruleString: string): ParsedRRule {
  const cleaned = rruleString.replace(/^RRULE:/, '');
  const parts = cleaned.split(';');

  const result: ParsedRRule = {
    freq: 'WEEKLY',
    interval: 1,
  };

  for (const part of parts) {
    const eqIndex = part.indexOf('=');
    if (eqIndex === -1) continue;

    const key = part.substring(0, eqIndex).toUpperCase();
    const value = part.substring(eqIndex + 1);

    switch (key) {
      case 'FREQ':
        result.freq = value.toUpperCase();
        break;
      case 'INTERVAL':
        result.interval = parseInt(value, 10) || 1;
        break;
      case 'BYDAY':
        result.byDay = value.split(',').map((d) => d.trim().toUpperCase());
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
 * Build an RRULE string from options.
 *
 * @param options - Rule components
 * @returns RRULE string (e.g., "FREQ=MONTHLY;INTERVAL=1")
 *
 * @example
 *   buildRRule({ freq: 'WEEKLY', interval: 2, byDay: ['MO', 'FR'] })
 *   // => "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR"
 */
export function buildRRule(options: RRuleOptions): string {
  const parts: string[] = [`FREQ=${options.freq.toUpperCase()}`];

  if (options.interval != null && options.interval > 1) {
    parts.push(`INTERVAL=${options.interval}`);
  }

  if (options.byDay && options.byDay.length > 0) {
    parts.push(`BYDAY=${options.byDay.map((d) => d.toUpperCase()).join(',')}`);
  }

  if (options.count != null) {
    parts.push(`COUNT=${options.count}`);
  }

  if (options.until) {
    parts.push(`UNTIL=${options.until}`);
  }

  return parts.join(';');
}

// ============================================================================
// Occurrence Calculation
// ============================================================================

/**
 * Advance a date by one interval of the given frequency.
 */
function advanceByFreq(date: Date, freq: string, interval: number): Date {
  switch (freq.toUpperCase()) {
    case 'DAILY':
      return addDays(date, interval);
    case 'WEEKLY':
      return addWeeks(date, interval);
    case 'MONTHLY':
      return addMonths(date, interval);
    case 'YEARLY':
      return addYears(date, interval);
    default:
      return addWeeks(date, interval);
  }
}

/**
 * Get the next occurrence of a recurring rule after a given date.
 *
 * @param rrule     - RRULE string
 * @param afterDate - Date after which to find the next occurrence (defaults to now)
 * @returns The next occurrence date, or null if the rule has expired (UNTIL passed)
 */
export function getNextOccurrence(rrule: string, afterDate?: Date): Date | null {
  const parsed = parseRRule(rrule);
  const after = afterDate ?? new Date();

  // Check UNTIL constraint
  if (parsed.until) {
    const untilDate = parseISO(parsed.until);
    if (isAfter(after, untilDate)) {
      return null;
    }
  }

  // For BYDAY rules, find the next matching day of week
  if (parsed.byDay && parsed.byDay.length > 0) {
    const targetDays = parsed.byDay
      .map((d) => DAY_MAP[d.toUpperCase()])
      .filter((d) => d !== undefined);

    if (targetDays.length > 0) {
      // Look ahead up to interval * 7 + 7 days to handle multi-week intervals
      const maxLookahead = parsed.interval * 7 + 7;
      for (let i = 1; i <= maxLookahead; i++) {
        const candidate = addDays(after, i);
        if (targetDays.includes(getDay(candidate))) {
          // Check UNTIL for this candidate
          if (parsed.until) {
            const untilDate = parseISO(parsed.until);
            if (isAfter(candidate, untilDate)) return null;
          }
          return startOfDay(candidate);
        }
      }
      return null;
    }
  }

  // Simple frequency-based next occurrence
  const next = advanceByFreq(after, parsed.freq, parsed.interval);

  // Check UNTIL for the computed date
  if (parsed.until) {
    const untilDate = parseISO(parsed.until);
    if (isAfter(next, untilDate)) return null;
  }

  return next;
}

/**
 * Get the next N occurrences of a recurring rule.
 *
 * @param rrule    - RRULE string
 * @param fromDate - Start searching after this date
 * @param count    - Number of occurrences to generate
 * @returns Array of occurrence dates
 */
export function getUpcomingOccurrences(
  rrule: string,
  fromDate: Date,
  count: number
): Date[] {
  const parsed = parseRRule(rrule);
  const occurrences: Date[] = [];
  let cursor = fromDate;

  // Cap iterations to prevent infinite loops
  const maxIterations = count * 50;
  let iterations = 0;

  while (occurrences.length < count && iterations < maxIterations) {
    iterations++;

    const next = getNextOccurrence(rrule, cursor);
    if (!next) break;

    // Respect COUNT limit from the rule itself
    if (parsed.count != null && occurrences.length >= parsed.count) break;

    occurrences.push(next);
    cursor = next;
  }

  return occurrences;
}

// ============================================================================
// Job Generation
// ============================================================================

/**
 * Generate a job data object from a recurring job template and an occurrence date.
 *
 * @param recurringJob    - The recurring job template
 * @param occurrenceDate  - The date for this occurrence
 * @returns A job data object ready to be inserted (without id/timestamps)
 */
export function generateJobFromRecurring(
  recurringJob: RecurringJob,
  occurrenceDate: Date
): GeneratedJobData {
  // Preserve the time from the next_occurrence_at if available, otherwise use 9 AM
  let scheduledDate = occurrenceDate;
  if (recurringJob.next_occurrence_at) {
    const nextOcc = parseISO(recurringJob.next_occurrence_at);
    const hours = nextOcc.getHours();
    const minutes = nextOcc.getMinutes();
    scheduledDate = setMinutes(setHours(startOfDay(occurrenceDate), hours), minutes);
  } else {
    scheduledDate = setHours(startOfDay(occurrenceDate), 9);
  }

  const scheduledEnd = addDays(scheduledDate, 0); // clone
  const endDate = new Date(
    scheduledDate.getTime() + recurringJob.duration_minutes * 60 * 1000
  );

  return {
    title: recurringJob.title,
    customer_id: recurringJob.customer_id ?? '',
    location_id: recurringJob.location_id,
    service_type: recurringJob.service_type,
    description: recurringJob.description,
    scheduled_at: format(scheduledDate, "yyyy-MM-dd'T'HH:mm:ssxxx"),
    scheduled_end: format(endDate, "yyyy-MM-dd'T'HH:mm:ssxxx"),
    duration_minutes: recurringJob.duration_minutes,
    assigned_technician_id: recurringJob.assigned_technician_id,
    line_items: recurringJob.line_items_template.map((li) => ({
      name: li.name,
      qty: li.qty,
      unit_price_cents: li.unit_price_cents,
    })),
    source: 'recurring',
    recurring_job_id: recurringJob.id,
  };
}

// ============================================================================
// Due Check
// ============================================================================

/**
 * Check if a recurring job is due for generation.
 *
 * A recurring job is due when:
 *   1. It is active and not deleted
 *   2. It has a next_occurrence_at that is at or before `now`
 *   3. It has not already been generated for this occurrence
 *      (last_generated_at is before next_occurrence_at)
 *
 * @param recurringJob - The recurring job to check
 * @param now          - Current date/time (defaults to new Date())
 * @returns true if the job needs a new occurrence generated
 */
export function isRecurringJobDue(
  recurringJob: RecurringJob,
  now?: Date
): boolean {
  const currentTime = now ?? new Date();

  // Must be active
  if (!recurringJob.is_active || recurringJob.deleted) return false;

  // Must have a next_occurrence_at
  if (!recurringJob.next_occurrence_at) return false;

  const nextOccurrence = parseISO(recurringJob.next_occurrence_at);

  // Next occurrence must be at or before now
  if (isAfter(nextOccurrence, currentTime)) return false;

  // Check that we haven't already generated for this occurrence
  if (recurringJob.last_generated_at) {
    const lastGenerated = parseISO(recurringJob.last_generated_at);
    // If last_generated_at >= next_occurrence_at, we already generated it
    if (
      !isBefore(lastGenerated, nextOccurrence)
    ) {
      return false;
    }
  }

  // Check UNTIL in the RRULE
  if (recurringJob.rrule) {
    const parsed = parseRRule(recurringJob.rrule);
    if (parsed.until) {
      const untilDate = parseISO(parsed.until);
      if (isAfter(nextOccurrence, untilDate)) return false;
    }
  }

  return true;
}
