import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectScheduleConflicts,
  checkBusinessHours,
  getAvailableSlots,
  calculateEndTime,
  formatTimeSlot,
  canReschedule,
  DEFAULT_BUSINESS_HOURS,
  type ScheduledJob,
} from './scheduling';
import { addDays, addHours, setHours, setMinutes, startOfDay } from 'date-fns';

// ============================================================================
// Helpers
// ============================================================================

function futureDate(daysAhead: number, hour: number, minute: number = 0): Date {
  // Use a known future Monday (day 1) for predictable business hours tests
  // Create in local time to avoid UTC/local day mismatch
  const base = new Date(2030, 5, 9, 0, 0, 0, 0); // Mon Jun 9, 2030 in local time (getDay()=0 is Sun, Jun 8)
  // Actually, June 9, 2030 — let's verify: new Date(2030, 5, 9).getDay() 
  // June 9, 2030 is a Sunday. June 10 is Monday.
  const monday = new Date(2030, 5, 10, 0, 0, 0, 0); // Monday Jun 10, 2030 local
  const d = addDays(monday, daysAhead);
  return setMinutes(setHours(d, hour), minute);
}

function makeJob(id: string, startHour: number, endHour: number, daysAhead: number = 0): ScheduledJob {
  return {
    id,
    scheduled_start: futureDate(daysAhead, startHour).toISOString(),
    scheduled_end: futureDate(daysAhead, endHour).toISOString(),
    title: `Job ${id}`,
    status: 'scheduled',
  };
}

// ============================================================================
// Schedule Conflict Detection
// ============================================================================

describe('detectScheduleConflicts', () => {
  it('returns empty for no conflicts', () => {
    const existingJobs = [makeJob('1', 9, 11)];
    const conflicts = detectScheduleConflicts(
      futureDate(0, 13),
      futureDate(0, 15),
      existingJobs
    );
    expect(conflicts).toHaveLength(0);
  });

  it('detects overlapping jobs', () => {
    const existingJobs = [makeJob('1', 9, 11)];
    const conflicts = detectScheduleConflicts(
      futureDate(0, 10),
      futureDate(0, 12),
      existingJobs
    );
    const overlapConflicts = conflicts.filter(c => c.type === 'overlap');
    expect(overlapConflicts.length).toBeGreaterThan(0);
  });

  it('detects conflict with buffer time', () => {
    const existingJobs = [makeJob('1', 9, 11)];
    // Start 10 minutes after existing job ends (within 15-min buffer)
    const conflicts = detectScheduleConflicts(
      futureDate(0, 11, 10),
      futureDate(0, 13),
      existingJobs,
      15
    );
    const overlapConflicts = conflicts.filter(c => c.type === 'overlap');
    expect(overlapConflicts.length).toBeGreaterThan(0);
  });

  it('ignores canceled and completed jobs', () => {
    const existingJobs: ScheduledJob[] = [
      { ...makeJob('1', 10, 12), status: 'canceled' },
      { ...makeJob('2', 10, 12), status: 'completed' },
    ];
    const conflicts = detectScheduleConflicts(
      futureDate(0, 10),
      futureDate(0, 12),
      existingJobs
    );
    const overlapConflicts = conflicts.filter(c => c.type === 'overlap');
    expect(overlapConflicts).toHaveLength(0);
  });

  it('detects too-short duration', () => {
    const conflicts = detectScheduleConflicts(
      futureDate(0, 10),
      futureDate(0, 10, 10), // 10 minutes
      []
    );
    expect(conflicts.some(c => c.type === 'too_short')).toBe(true);
  });
});

// ============================================================================
// Business Hours
// ============================================================================

describe('checkBusinessHours', () => {
  it('returns null for valid business hours (weekday)', () => {
    // Monday 10am-12pm
    const result = checkBusinessHours(
      futureDate(0, 10), // Monday
      futureDate(0, 12),
    );
    expect(result).toBeNull();
  });

  it('detects outside business hours (Sunday)', () => {
    // Sunday — business closed. Use local time constructor.
    const sunday = new Date(2030, 5, 9, 0, 0, 0, 0); // Jun 9, 2030 is Sunday in local time
    const start = setHours(sunday, 10);
    const end = setHours(sunday, 12);
    const result = checkBusinessHours(start, end);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('outside_hours');
  });

  it('detects before opening hours', () => {
    // Monday 6am (before 8am open)
    const result = checkBusinessHours(
      futureDate(0, 6),
      futureDate(0, 8),
    );
    expect(result).not.toBeNull();
    expect(result!.type).toBe('outside_hours');
  });

  it('detects after closing hours', () => {
    // Monday 5pm-7pm (after 5pm close)
    const result = checkBusinessHours(
      futureDate(0, 16),
      futureDate(0, 18),
    );
    expect(result).not.toBeNull();
  });
});

// ============================================================================
// Calculate End Time
// ============================================================================

describe('calculateEndTime', () => {
  it('uses default duration for unknown service type', () => {
    const start = futureDate(0, 9);
    const end = calculateEndTime(start);
    const diffMs = end.getTime() - start.getTime();
    expect(diffMs).toBe(120 * 60 * 1000); // 120 min default
  });

  it('uses service-specific duration', () => {
    const start = futureDate(0, 9);
    const end = calculateEndTime(start, 'Spring Replacement');
    const diffMs = end.getTime() - start.getTime();
    expect(diffMs).toBe(90 * 60 * 1000); // 90 min
  });

  it('handles Garage Door Installation (4 hours)', () => {
    const start = futureDate(0, 8);
    const end = calculateEndTime(start, 'Garage Door Installation');
    const diffMs = end.getTime() - start.getTime();
    expect(diffMs).toBe(240 * 60 * 1000);
  });

  it('handles Weatherstripping (30 min)', () => {
    const start = futureDate(0, 10);
    const end = calculateEndTime(start, 'Weatherstripping');
    const diffMs = end.getTime() - start.getTime();
    expect(diffMs).toBe(30 * 60 * 1000);
  });

  it('accepts string date input', () => {
    const start = '2030-06-10T09:00:00.000Z';
    const end = calculateEndTime(start, 'Roller Replacement');
    const diffMs = end.getTime() - new Date(start).getTime();
    expect(diffMs).toBe(45 * 60 * 1000);
  });
});

// ============================================================================
// Format Time Slot
// ============================================================================

describe('formatTimeSlot', () => {
  it('formats a time slot', () => {
    const slot = {
      start: setMinutes(setHours(new Date('2030-06-10'), 9), 0),
      end: setMinutes(setHours(new Date('2030-06-10'), 11), 0),
    };
    const result = formatTimeSlot(slot);
    expect(result).toMatch(/9:00 AM/);
    expect(result).toMatch(/11:00 AM/);
    expect(result).toContain(' - ');
  });
});

// ============================================================================
// Can Reschedule
// ============================================================================

describe('canReschedule', () => {
  it('allows rescheduling to open slot', () => {
    const existingJobs = [
      makeJob('1', 9, 11),
      makeJob('2', 14, 16),
    ];
    // Reschedule job 1 to 11:30-13:30 (gap between jobs, with 15-min buffer clearance)
    const conflicts = canReschedule(
      '1',
      futureDate(0, 11, 30),
      futureDate(0, 13, 30),
      existingJobs
    );
    const overlaps = conflicts.filter(c => c.type === 'overlap');
    expect(overlaps).toHaveLength(0);
  });

  it('detects conflict when rescheduling into occupied slot', () => {
    const existingJobs = [
      makeJob('1', 9, 11),
      makeJob('2', 13, 15),
    ];
    // Reschedule job 1 to 14:00-16:00 (overlaps job 2)
    const conflicts = canReschedule(
      '1',
      futureDate(0, 14),
      futureDate(0, 16),
      existingJobs
    );
    const overlaps = conflicts.filter(c => c.type === 'overlap');
    expect(overlaps.length).toBeGreaterThan(0);
  });

  it('excludes the job being rescheduled from conflict check', () => {
    const existingJobs = [makeJob('1', 9, 11)];
    // Reschedule job 1 to same time — should not conflict with itself
    const conflicts = canReschedule(
      '1',
      futureDate(0, 9),
      futureDate(0, 11),
      existingJobs
    );
    const overlaps = conflicts.filter(c => c.type === 'overlap');
    expect(overlaps).toHaveLength(0);
  });
});
