// Murray's FSM - Scheduling Service
// ==================================
// Schedule conflict detection, time slot management, and availability

import {
  addMinutes,
  addDays,
  startOfDay,
  endOfDay,
  parseISO,
  isWithinInterval,
  areIntervalsOverlapping,
  format,
  setHours,
  setMinutes,
  isBefore,
  isAfter,
  differenceInMinutes,
} from 'date-fns';
import { DEFAULTS } from '@murray-fsm/shared';

// ============================================================================
// Types
// ============================================================================

export interface TimeSlot {
  start: Date;
  end: Date;
}

export interface ScheduledJob {
  id: string;
  scheduled_start: string;
  scheduled_end?: string;
  title?: string;
  status?: string;
}

export interface BusinessHours {
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  isOpen: boolean;
}

export interface ScheduleConflict {
  type: 'overlap' | 'outside_hours' | 'too_short' | 'in_past';
  message: string;
  conflictingJob?: ScheduledJob;
}

export interface AvailableSlot {
  start: Date;
  end: Date;
  durationMinutes: number;
}

// ============================================================================
// Default Business Hours
// ============================================================================

export const DEFAULT_BUSINESS_HOURS: BusinessHours[] = [
  { dayOfWeek: 0, startHour: 0, startMinute: 0, endHour: 0, endMinute: 0, isOpen: false }, // Sunday
  { dayOfWeek: 1, startHour: 8, startMinute: 0, endHour: 17, endMinute: 0, isOpen: true },  // Monday
  { dayOfWeek: 2, startHour: 8, startMinute: 0, endHour: 17, endMinute: 0, isOpen: true },  // Tuesday
  { dayOfWeek: 3, startHour: 8, startMinute: 0, endHour: 17, endMinute: 0, isOpen: true },  // Wednesday
  { dayOfWeek: 4, startHour: 8, startMinute: 0, endHour: 17, endMinute: 0, isOpen: true },  // Thursday
  { dayOfWeek: 5, startHour: 8, startMinute: 0, endHour: 17, endMinute: 0, isOpen: true },  // Friday
  { dayOfWeek: 6, startHour: 9, startMinute: 0, endHour: 14, endMinute: 0, isOpen: true },  // Saturday
];

// ============================================================================
// Schedule Conflict Detection
// ============================================================================

/**
 * Check if a proposed time slot conflicts with existing scheduled jobs
 * @param proposedStart - Start time of proposed job
 * @param proposedEnd - End time of proposed job (optional, defaults to +2 hours)
 * @param existingJobs - Array of existing scheduled jobs
 * @param bufferMinutes - Buffer time between jobs (default: 15 minutes)
 * @returns Array of conflicts, empty if no conflicts
 */
export function detectScheduleConflicts(
  proposedStart: Date | string,
  proposedEnd: Date | string | null,
  existingJobs: ScheduledJob[],
  bufferMinutes: number = 15
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  const start = typeof proposedStart === 'string' ? parseISO(proposedStart) : proposedStart;
  const end = proposedEnd
    ? (typeof proposedEnd === 'string' ? parseISO(proposedEnd) : proposedEnd)
    : addMinutes(start, DEFAULTS.DEFAULT_JOB_DURATION);

  // Check if in the past
  if (isBefore(start, new Date())) {
    conflicts.push({
      type: 'in_past',
      message: 'Cannot schedule jobs in the past',
    });
  }

  // Check if duration is reasonable (at least 15 minutes)
  const durationMinutes = differenceInMinutes(end, start);
  if (durationMinutes < 15) {
    conflicts.push({
      type: 'too_short',
      message: 'Job duration must be at least 15 minutes',
    });
  }

  // Check for overlaps with existing jobs
  const proposedInterval = {
    start: addMinutes(start, -bufferMinutes),
    end: addMinutes(end, bufferMinutes),
  };

  for (const job of existingJobs) {
    // Skip non-active jobs
    if (job.status === 'cancelled' || job.status === 'completed') {
      continue;
    }

    if (!job.scheduled_start) continue;

    const jobStart = parseISO(job.scheduled_start);
    const jobEnd = job.scheduled_end
      ? parseISO(job.scheduled_end)
      : addMinutes(jobStart, DEFAULTS.DEFAULT_JOB_DURATION);

    const jobInterval = { start: jobStart, end: jobEnd };

    if (areIntervalsOverlapping(proposedInterval, jobInterval)) {
      conflicts.push({
        type: 'overlap',
        message: `Conflicts with "${job.title || 'existing job'}" scheduled for ${format(jobStart, 'MMM d at h:mm a')}`,
        conflictingJob: job,
      });
    }
  }

  return conflicts;
}

/**
 * Check if a time slot is within business hours
 * @param start - Start time to check
 * @param end - End time to check
 * @param businessHours - Business hours configuration
 * @returns Conflict if outside business hours, null if OK
 */
export function checkBusinessHours(
  start: Date | string,
  end: Date | string,
  businessHours: BusinessHours[] = DEFAULT_BUSINESS_HOURS
): ScheduleConflict | null {
  const startDate = typeof start === 'string' ? parseISO(start) : start;
  const endDate = typeof end === 'string' ? parseISO(end) : end;

  const dayOfWeek = startDate.getDay();
  const hours = businessHours.find((h) => h.dayOfWeek === dayOfWeek);

  if (!hours || !hours.isOpen) {
    return {
      type: 'outside_hours',
      message: 'Business is closed on this day',
    };
  }

  const dayStart = setMinutes(setHours(startDate, hours.startHour), hours.startMinute);
  const dayEnd = setMinutes(setHours(startDate, hours.endHour), hours.endMinute);

  if (isBefore(startDate, dayStart) || isAfter(endDate, dayEnd)) {
    return {
      type: 'outside_hours',
      message: `Business hours are ${format(dayStart, 'h:mm a')} - ${format(dayEnd, 'h:mm a')}`,
    };
  }

  return null;
}

// ============================================================================
// Available Time Slots
// ============================================================================

/**
 * Find available time slots for a given day
 * @param date - Date to find slots for
 * @param existingJobs - Existing scheduled jobs
 * @param slotDurationMinutes - Duration of each slot (default: 120)
 * @param businessHours - Business hours configuration
 * @param bufferMinutes - Buffer between jobs (default: 15)
 * @returns Array of available time slots
 */
export function getAvailableSlots(
  date: Date | string,
  existingJobs: ScheduledJob[],
  slotDurationMinutes: number = DEFAULTS.DEFAULT_JOB_DURATION,
  businessHours: BusinessHours[] = DEFAULT_BUSINESS_HOURS,
  bufferMinutes: number = 15
): AvailableSlot[] {
  const targetDate = typeof date === 'string' ? parseISO(date) : date;
  const dayOfWeek = targetDate.getDay();
  const hours = businessHours.find((h) => h.dayOfWeek === dayOfWeek);

  if (!hours || !hours.isOpen) {
    return [];
  }

  // Get business hours for this day
  const dayStart = setMinutes(setHours(startOfDay(targetDate), hours.startHour), hours.startMinute);
  const dayEnd = setMinutes(setHours(startOfDay(targetDate), hours.endHour), hours.endMinute);

  // Filter jobs for this day
  const dayJobs = existingJobs
    .filter((job) => {
      if (!job.scheduled_start || job.status === 'cancelled' || job.status === 'completed') {
        return false;
      }
      const jobDate = parseISO(job.scheduled_start);
      return isWithinInterval(jobDate, { start: startOfDay(targetDate), end: endOfDay(targetDate) });
    })
    .map((job) => ({
      start: parseISO(job.scheduled_start),
      end: job.scheduled_end
        ? parseISO(job.scheduled_end)
        : addMinutes(parseISO(job.scheduled_start), DEFAULTS.DEFAULT_JOB_DURATION),
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  // Find gaps between jobs
  const slots: AvailableSlot[] = [];
  let currentTime = dayStart;

  // Skip past times
  const now = new Date();
  if (isBefore(currentTime, now)) {
    currentTime = addMinutes(now, 30); // Start at least 30 min from now
    // Round to next 15-minute increment
    const minutes = currentTime.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 15) * 15;
    currentTime = setMinutes(currentTime, roundedMinutes);
  }

  for (const job of dayJobs) {
    const gapStart = currentTime;
    const gapEnd = addMinutes(job.start, -bufferMinutes);

    if (isAfter(gapEnd, gapStart)) {
      const gapDuration = differenceInMinutes(gapEnd, gapStart);
      if (gapDuration >= slotDurationMinutes) {
        // Can fit one or more slots in this gap
        let slotStart = gapStart;
        while (differenceInMinutes(gapEnd, slotStart) >= slotDurationMinutes) {
          slots.push({
            start: slotStart,
            end: addMinutes(slotStart, slotDurationMinutes),
            durationMinutes: slotDurationMinutes,
          });
          slotStart = addMinutes(slotStart, slotDurationMinutes);
        }
      }
    }

    currentTime = addMinutes(job.end, bufferMinutes);
  }

  // Check remaining time after last job
  if (isBefore(currentTime, dayEnd)) {
    let slotStart = currentTime;
    while (differenceInMinutes(dayEnd, slotStart) >= slotDurationMinutes) {
      slots.push({
        start: slotStart,
        end: addMinutes(slotStart, slotDurationMinutes),
        durationMinutes: slotDurationMinutes,
      });
      slotStart = addMinutes(slotStart, slotDurationMinutes);
    }
  }

  return slots;
}

/**
 * Get available slots for multiple days
 * @param startDate - First day to check
 * @param numDays - Number of days to check
 * @param existingJobs - Existing scheduled jobs
 * @param slotDurationMinutes - Duration of each slot
 * @param businessHours - Business hours configuration
 * @returns Map of date strings to available slots
 */
export function getAvailableSlotsRange(
  startDate: Date | string,
  numDays: number,
  existingJobs: ScheduledJob[],
  slotDurationMinutes: number = DEFAULTS.DEFAULT_JOB_DURATION,
  businessHours: BusinessHours[] = DEFAULT_BUSINESS_HOURS
): Map<string, AvailableSlot[]> {
  const result = new Map<string, AvailableSlot[]>();
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;

  for (let i = 0; i < numDays; i++) {
    const date = addDays(start, i);
    const dateKey = format(date, 'yyyy-MM-dd');
    const slots = getAvailableSlots(date, existingJobs, slotDurationMinutes, businessHours);
    result.set(dateKey, slots);
  }

  return result;
}

/**
 * Find the next available slot
 * @param existingJobs - Existing scheduled jobs
 * @param slotDurationMinutes - Required duration
 * @param maxDaysAhead - Maximum days to search
 * @param businessHours - Business hours configuration
 * @returns Next available slot or null if none found
 */
export function findNextAvailableSlot(
  existingJobs: ScheduledJob[],
  slotDurationMinutes: number = DEFAULTS.DEFAULT_JOB_DURATION,
  maxDaysAhead: number = 14,
  businessHours: BusinessHours[] = DEFAULT_BUSINESS_HOURS
): AvailableSlot | null {
  const slotsMap = getAvailableSlotsRange(
    new Date(),
    maxDaysAhead,
    existingJobs,
    slotDurationMinutes,
    businessHours
  );

  for (const entry of Array.from(slotsMap.values())) {
    if (entry.length > 0) {
      return entry[0];
    }
  }

  return null;
}

// ============================================================================
// Schedule Utilities
// ============================================================================

/**
 * Calculate estimated end time based on service type
 * @param startTime - Start time
 * @param serviceType - Type of service
 * @returns Estimated end time
 */
export function calculateEndTime(
  startTime: Date | string,
  serviceType?: string
): Date {
  const start = typeof startTime === 'string' ? parseISO(startTime) : startTime;

  // Estimate duration based on service type
  const durationMap: Record<string, number> = {
    'Garage Door Repair': 90,
    'Garage Door Installation': 240,
    'Garage Door Opener Repair': 60,
    'Garage Door Opener Installation': 120,
    'Spring Replacement': 90,
    'Panel Replacement': 120,
    'Track Repair': 60,
    'Roller Replacement': 45,
    'Weatherstripping': 30,
    'Maintenance & Tune-up': 45,
    'Emergency Service': 120,
  };

  const duration = serviceType && durationMap[serviceType]
    ? durationMap[serviceType]
    : DEFAULTS.DEFAULT_JOB_DURATION;

  return addMinutes(start, duration);
}

/**
 * Format time slot for display
 * @param slot - Time slot to format
 * @returns Formatted string (e.g., "9:00 AM - 11:00 AM")
 */
export function formatTimeSlot(slot: TimeSlot | AvailableSlot): string {
  return `${format(slot.start, 'h:mm a')} - ${format(slot.end, 'h:mm a')}`;
}

/**
 * Check if a job can be rescheduled to a new time
 * @param jobId - ID of job to reschedule
 * @param newStart - New start time
 * @param newEnd - New end time (optional)
 * @param existingJobs - All existing jobs
 * @param businessHours - Business hours configuration
 * @returns Array of conflicts, empty if rescheduling is OK
 */
export function canReschedule(
  jobId: string,
  newStart: Date | string,
  newEnd: Date | string | null,
  existingJobs: ScheduledJob[],
  businessHours: BusinessHours[] = DEFAULT_BUSINESS_HOURS
): ScheduleConflict[] {
  // Filter out the job being rescheduled
  const otherJobs = existingJobs.filter((job) => job.id !== jobId);

  // Check for conflicts
  const conflicts = detectScheduleConflicts(newStart, newEnd, otherJobs);

  // Check business hours
  const start = typeof newStart === 'string' ? parseISO(newStart) : newStart;
  const end = newEnd
    ? (typeof newEnd === 'string' ? parseISO(newEnd) : newEnd)
    : addMinutes(start, DEFAULTS.DEFAULT_JOB_DURATION);

  const hoursConflict = checkBusinessHours(start, end, businessHours);
  if (hoursConflict) {
    conflicts.push(hoursConflict);
  }

  return conflicts;
}
