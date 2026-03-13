// Murray's FSM - Time Entries Service
// =====================================
// Duration calculations, technician hours, overtime, and time formatting

import type { TimeEntry, TimeEntryType } from '@murray-fsm/shared';
import {
  parseISO,
  differenceInMinutes,
  format,
  startOfDay,
  isWithinInterval,
  startOfWeek,
  addWeeks,
  isBefore,
} from 'date-fns';

// ============================================================================
// Types
// ============================================================================

export interface TechnicianHoursResult {
  work: number;
  travel: number;
  break: number;
  total: number;
}

export interface DailyBreakdown {
  date: string;
  entries: TimeEntry[];
  totalMinutes: number;
  totalHours: number;
}

// ============================================================================
// Duration Calculation
// ============================================================================

/**
 * Calculate the duration between two timestamps in minutes.
 *
 * @param startedAt - ISO timestamp for the start time
 * @param endedAt - ISO timestamp for the end time (null/undefined returns 0)
 * @returns Duration in minutes (floored, minimum 0)
 */
export function calculateDuration(
  startedAt: string,
  endedAt: string | null | undefined
): number {
  if (!endedAt) return 0;

  const started = parseISO(startedAt);
  const ended = parseISO(endedAt);

  return Math.max(0, differenceInMinutes(ended, started));
}

// ============================================================================
// Technician Hours Aggregation
// ============================================================================

/**
 * Aggregate time entry hours within a period, broken down by entry type.
 *
 * Only includes entries whose started_at falls within the given period.
 * Hours are returned as decimal values rounded to two decimal places.
 *
 * @param entries - All time entries to consider
 * @param periodStart - ISO timestamp for the period start
 * @param periodEnd - ISO timestamp for the period end
 * @returns Hours broken down by work, travel, break, and total
 */
export function getTechnicianHours(
  entries: TimeEntry[],
  periodStart: string,
  periodEnd: string
): TechnicianHoursResult {
  const result: TechnicianHoursResult = { work: 0, travel: 0, break: 0, total: 0 };

  const start = parseISO(periodStart);
  const end = parseISO(periodEnd);

  const filtered = entries.filter((entry) => {
    const entryStart = parseISO(entry.started_at);
    return isWithinInterval(entryStart, { start, end });
  });

  for (const entry of filtered) {
    const minutes = calculateDuration(entry.started_at, entry.ended_at);
    const hours = minutes / 60;

    switch (entry.entry_type) {
      case 'work':
        result.work += hours;
        break;
      case 'travel':
        result.travel += hours;
        break;
      case 'break':
        result.break += hours;
        break;
    }
    result.total += hours;
  }

  // Round to 2 decimal places
  result.work = Math.round(result.work * 100) / 100;
  result.travel = Math.round(result.travel * 100) / 100;
  result.break = Math.round(result.break * 100) / 100;
  result.total = Math.round(result.total * 100) / 100;

  return result;
}

// ============================================================================
// Time Formatting
// ============================================================================

/**
 * Format a time entry as a human-readable string.
 *
 * Produces output like "2h 30m travel" or "45m work".
 * Returns "running" for entries with no ended_at (active timers).
 *
 * @param entry - The time entry to format
 * @returns Human-readable duration string with entry type
 */
export function formatTimeEntry(entry: TimeEntry): string {
  if (!entry.ended_at) return 'running';

  const minutes = calculateDuration(entry.started_at, entry.ended_at);

  if (minutes === 0) return `0m ${entry.entry_type}`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  let duration: string;
  if (hours === 0) {
    duration = `${remainingMinutes}m`;
  } else if (remainingMinutes === 0) {
    duration = `${hours}h`;
  } else {
    duration = `${hours}h ${remainingMinutes}m`;
  }

  return `${duration} ${entry.entry_type}`;
}

// ============================================================================
// Daily Breakdown
// ============================================================================

/**
 * Group time entries by date and calculate daily totals.
 *
 * Entries are grouped by their started_at date (formatted as yyyy-MM-dd).
 * Each group includes the raw entries, total minutes, and total hours
 * (rounded to two decimal places). Results are sorted by date descending.
 *
 * @param entries - Array of time entries to group
 * @returns Array of daily breakdown objects sorted newest first
 */
export function getDailyBreakdown(entries: TimeEntry[]): DailyBreakdown[] {
  const grouped = new Map<string, TimeEntry[]>();

  for (const entry of entries) {
    const date = format(parseISO(entry.started_at), 'yyyy-MM-dd');
    const existing = grouped.get(date) ?? [];
    existing.push(entry);
    grouped.set(date, existing);
  }

  const breakdowns: DailyBreakdown[] = [];

  for (const [date, dateEntries] of Array.from(grouped)) {
    const totalMinutes = dateEntries.reduce(
      (sum: number, entry: TimeEntry) => sum + calculateDuration(entry.started_at, entry.ended_at),
      0
    );

    breakdowns.push({
      date,
      entries: dateEntries,
      totalMinutes,
      totalHours: Math.round((totalMinutes / 60) * 100) / 100,
    });
  }

  // Sort by date descending (newest first)
  breakdowns.sort((a, b) => b.date.localeCompare(a.date));

  return breakdowns;
}

// ============================================================================
// Overtime Calculation
// ============================================================================

/**
 * Calculate overtime hours within a period based on a weekly hour limit.
 *
 * Breaks the period into calendar weeks (starting Monday) and sums work + travel
 * hours per week. Any hours exceeding the weekly limit are counted as overtime.
 *
 * @param entries - All time entries to consider
 * @param periodStart - ISO timestamp for the period start
 * @param periodEnd - ISO timestamp for the period end
 * @param weeklyLimit - Maximum regular hours per week (default: 40)
 * @returns Total overtime hours across all weeks in the period (rounded to 2 decimals)
 */
export function calculateOvertimeHours(
  entries: TimeEntry[],
  periodStart: string,
  periodEnd: string,
  weeklyLimit: number = 40
): number {
  const start = parseISO(periodStart);
  const end = parseISO(periodEnd);

  // Filter entries within the period (exclude breaks from overtime calc)
  const filtered = entries.filter((entry) => {
    const entryStart = parseISO(entry.started_at);
    return (
      isWithinInterval(entryStart, { start, end }) &&
      entry.entry_type !== 'break'
    );
  });

  // Group by week (Monday start)
  const weeklyHours = new Map<string, number>();

  for (const entry of filtered) {
    const entryDate = parseISO(entry.started_at);
    const weekStart = startOfWeek(entryDate, { weekStartsOn: 1 });
    const weekKey = format(weekStart, 'yyyy-MM-dd');

    const minutes = calculateDuration(entry.started_at, entry.ended_at);
    const hours = minutes / 60;

    weeklyHours.set(weekKey, (weeklyHours.get(weekKey) ?? 0) + hours);
  }

  // Sum overtime across weeks
  let totalOvertime = 0;
  for (const hours of Array.from(weeklyHours.values())) {
    if (hours > weeklyLimit) {
      totalOvertime += hours - weeklyLimit;
    }
  }

  return Math.round(totalOvertime * 100) / 100;
}

// ============================================================================
// Active Timer
// ============================================================================

/**
 * Find the currently running time entry (one with no ended_at timestamp).
 *
 * If multiple entries are running (which should not normally happen),
 * the most recently started one is returned.
 *
 * @param entries - Array of time entries to search
 * @returns The active time entry, or null if none is running
 */
export function getActiveTimer(entries: TimeEntry[]): TimeEntry | null {
  const active = entries.filter((entry) => !entry.ended_at);

  if (active.length === 0) return null;

  // Return the most recently started active entry
  active.sort((a, b) => {
    const aStart = parseISO(a.started_at).getTime();
    const bStart = parseISO(b.started_at).getTime();
    return bStart - aStart;
  });

  return active[0];
}
