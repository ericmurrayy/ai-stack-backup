// Murray's FSM - Time Entries Service
// =====================================
// Duration calculations, technician hours, and time formatting

import type { TimeEntry } from '@murray-fsm/shared';
import { differenceInMinutes, parseISO } from 'date-fns';

// ============================================================================
// Duration Calculation
// ============================================================================

/**
 * Calculate the duration of a time entry in minutes.
 * Returns 0 if the entry has no ended_at timestamp.
 */
export function calculateDuration(entry: TimeEntry): number {
  if (!entry.ended_at) return 0;

  const started = parseISO(entry.started_at);
  const ended = parseISO(entry.ended_at);

  return Math.max(0, differenceInMinutes(ended, started));
}

// ============================================================================
// Technician Hours Aggregation
// ============================================================================

/**
 * Aggregate time entry hours for a specific technician by entry type.
 *
 * @param entries - All time entries
 * @param techId - Technician ID to filter by
 * @returns Hours (as decimals) broken down by work, travel, break, and total
 */
export function getTechnicianHours(
  entries: TimeEntry[],
  techId: string
): { work: number; travel: number; break: number; total: number } {
  const result = { work: 0, travel: 0, break: 0, total: 0 };

  const techEntries = entries.filter(
    (entry) => entry.technician_id === techId
  );

  for (const entry of techEntries) {
    const minutes = calculateDuration(entry);
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
 * Format a time entry duration as a human-readable string (e.g., "2h 30m").
 * Returns "0m" for entries with no ended_at.
 */
export function formatTimeEntry(entry: TimeEntry): string {
  const minutes = calculateDuration(entry);

  if (minutes === 0) return '0m';

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes}m`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}
