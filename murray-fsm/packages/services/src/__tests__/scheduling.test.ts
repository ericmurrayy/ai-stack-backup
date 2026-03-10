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
  type BusinessHours,
} from '../scheduling';

// All dates use LOCAL time (no Z suffix) because scheduling functions use
// getDay(), getHours(), setHours() which operate in local time.

// ============================================================================
// detectScheduleConflicts
// ============================================================================

describe('detectScheduleConflicts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Wednesday at 6 AM local time (before business hours, so we can schedule later in the day)
    vi.setSystemTime(new Date(2025, 5, 11, 6, 0, 0)); // June 11, 2025 = Wednesday
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return no conflicts when there are no existing jobs', () => {
    // Thursday 9-11 AM
    const start = new Date(2025, 5, 12, 9, 0, 0);
    const end = new Date(2025, 5, 12, 11, 0, 0);
    const conflicts = detectScheduleConflicts(start, end, []);
    expect(conflicts).toHaveLength(0);
  });

  it('should detect overlap with existing job', () => {
    const start = new Date(2025, 5, 12, 9, 0, 0);
    const end = new Date(2025, 5, 12, 11, 0, 0);
    const existingJobs: ScheduledJob[] = [
      { id: '1', scheduled_start: new Date(2025, 5, 12, 10, 0, 0).toISOString(), title: 'Existing Job' },
    ];
    const conflicts = detectScheduleConflicts(start, end, existingJobs);
    expect(conflicts.some((c) => c.type === 'overlap')).toBe(true);
  });

  it('should detect scheduling in the past', () => {
    // Yesterday
    const start = new Date(2025, 5, 10, 9, 0, 0);
    const end = new Date(2025, 5, 10, 11, 0, 0);
    const conflicts = detectScheduleConflicts(start, end, []);
    expect(conflicts.some((c) => c.type === 'in_past')).toBe(true);
  });

  it('should detect too short duration', () => {
    const start = new Date(2025, 5, 12, 9, 0, 0);
    const end = new Date(2025, 5, 12, 9, 10, 0); // 10 minutes
    const conflicts = detectScheduleConflicts(start, end, []);
    expect(conflicts.some((c) => c.type === 'too_short')).toBe(true);
  });

  it('should skip cancelled jobs when checking overlaps', () => {
    const start = new Date(2025, 5, 12, 9, 0, 0);
    const end = new Date(2025, 5, 12, 11, 0, 0);
    const existingJobs: ScheduledJob[] = [
      {
        id: '1',
        scheduled_start: new Date(2025, 5, 12, 9, 30, 0).toISOString(),
        status: 'canceled',
        title: 'Canceled Job',
      },
    ];
    const conflicts = detectScheduleConflicts(start, end, existingJobs);
    expect(conflicts.filter((c) => c.type === 'overlap')).toHaveLength(0);
  });

  it('should skip completed jobs when checking overlaps', () => {
    const start = new Date(2025, 5, 12, 9, 0, 0);
    const end = new Date(2025, 5, 12, 11, 0, 0);
    const existingJobs: ScheduledJob[] = [
      {
        id: '1',
        scheduled_start: new Date(2025, 5, 12, 9, 30, 0).toISOString(),
        status: 'completed',
        title: 'Done Job',
      },
    ];
    const conflicts = detectScheduleConflicts(start, end, existingJobs);
    expect(conflicts.filter((c) => c.type === 'overlap')).toHaveLength(0);
  });

  it('should accept string dates', () => {
    const start = new Date(2025, 5, 12, 9, 0, 0);
    const end = new Date(2025, 5, 12, 11, 0, 0);
    const conflicts = detectScheduleConflicts(
      start.toISOString(),
      end.toISOString(),
      []
    );
    expect(conflicts).toHaveLength(0);
  });

  it('should use default duration when end is null', () => {
    const start = new Date(2025, 5, 12, 9, 0, 0);
    const conflicts = detectScheduleConflicts(start, null, []);
    // No too_short conflict because default duration is 120 minutes
    expect(conflicts.some((c) => c.type === 'too_short')).toBe(false);
  });

  it('should account for buffer time in overlap detection', () => {
    const start = new Date(2025, 5, 12, 12, 0, 0);
    const end = new Date(2025, 5, 12, 14, 0, 0);
    const existingJobs: ScheduledJob[] = [
      {
        id: '1',
        scheduled_start: new Date(2025, 5, 12, 14, 5, 0).toISOString(),
        scheduled_end: new Date(2025, 5, 12, 16, 0, 0).toISOString(),
        title: 'Next Job',
      },
    ];
    // With default 15-min buffer, 14:00 end + 15 min = 14:15, overlaps with 14:05
    const conflicts = detectScheduleConflicts(start, end, existingJobs);
    expect(conflicts.some((c) => c.type === 'overlap')).toBe(true);
  });
});

// ============================================================================
// checkBusinessHours
// ============================================================================

describe('checkBusinessHours', () => {
  it('should return null for times within business hours (weekday)', () => {
    // Wednesday June 11, 2025 - 9 AM to 11 AM local
    const start = new Date(2025, 5, 11, 9, 0, 0);
    const end = new Date(2025, 5, 11, 11, 0, 0);
    const conflict = checkBusinessHours(start, end, [
      { dayOfWeek: 3, startHour: 8, startMinute: 0, endHour: 17, endMinute: 0, isOpen: true },
    ]);
    expect(conflict).toBeNull();
  });

  it('should return conflict for closed day (Sunday)', () => {
    // Sunday June 15, 2025
    const start = new Date(2025, 5, 15, 9, 0, 0);
    const end = new Date(2025, 5, 15, 11, 0, 0);
    const conflict = checkBusinessHours(start, end);
    expect(conflict).not.toBeNull();
    expect(conflict?.type).toBe('outside_hours');
    expect(conflict?.message).toContain('closed');
  });

  it('should return conflict for times before opening', () => {
    // Monday June 9 at 6 AM local
    const start = new Date(2025, 5, 9, 6, 0, 0);
    const end = new Date(2025, 5, 9, 7, 30, 0);
    const conflict = checkBusinessHours(start, end, [
      { dayOfWeek: 1, startHour: 8, startMinute: 0, endHour: 17, endMinute: 0, isOpen: true },
    ]);
    expect(conflict).not.toBeNull();
    expect(conflict?.type).toBe('outside_hours');
  });

  it('should return conflict for times after closing', () => {
    // Monday June 9 at 6 PM to 8 PM local (after 5 PM closing)
    const start = new Date(2025, 5, 9, 18, 0, 0);
    const end = new Date(2025, 5, 9, 20, 0, 0);
    const conflict = checkBusinessHours(start, end, [
      { dayOfWeek: 1, startHour: 8, startMinute: 0, endHour: 17, endMinute: 0, isOpen: true },
    ]);
    expect(conflict).not.toBeNull();
    expect(conflict?.type).toBe('outside_hours');
  });

  it('should accept string dates', () => {
    // Wednesday 9 AM to 11 AM
    const start = new Date(2025, 5, 11, 9, 0, 0);
    const end = new Date(2025, 5, 11, 11, 0, 0);
    const conflict = checkBusinessHours(
      start.toISOString(),
      end.toISOString(),
      [{ dayOfWeek: 3, startHour: 8, startMinute: 0, endHour: 17, endMinute: 0, isOpen: true }]
    );
    expect(conflict).toBeNull();
  });

  it('should use default business hours when not provided', () => {
    // Sunday using default hours (closed)
    const start = new Date(2025, 5, 15, 10, 0, 0);
    const end = new Date(2025, 5, 15, 12, 0, 0);
    const conflict = checkBusinessHours(start, end);
    expect(conflict).not.toBeNull();
  });
});

// ============================================================================
// getAvailableSlots
// ============================================================================

describe('getAvailableSlots', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Monday June 9, 2025 at 6 AM local (before business hours)
    vi.setSystemTime(new Date(2025, 5, 9, 6, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return slots for an open day with no existing jobs', () => {
    // Monday, business hours 8-17
    const slots = getAvailableSlots(
      new Date(2025, 5, 9),
      [],
      120, // 2-hour slots
      DEFAULT_BUSINESS_HOURS
    );
    expect(slots.length).toBeGreaterThan(0);
    // 8 AM to 5 PM = 9 hours, 120 min slots = 4 slots (8-10, 10-12, 12-14, 14-16; 16-18 doesn't fit)
    expect(slots.length).toBe(4);
  });

  it('should return empty array for closed day (Sunday)', () => {
    const slots = getAvailableSlots(new Date(2025, 5, 15), [], 120);
    expect(slots).toHaveLength(0);
  });

  it('should work around existing jobs', () => {
    const existingJobs: ScheduledJob[] = [
      {
        id: '1',
        scheduled_start: new Date(2025, 5, 9, 10, 0, 0).toISOString(),
        scheduled_end: new Date(2025, 5, 9, 12, 0, 0).toISOString(),
        status: 'scheduled',
      },
    ];
    const slots = getAvailableSlots(
      new Date(2025, 5, 9),
      existingJobs,
      60, // 1-hour slots
      DEFAULT_BUSINESS_HOURS
    );
    // Should not have slots overlapping with 10:00-12:00
    for (const slot of slots) {
      const slotEnd = slot.end.getTime();
      const slotStart = slot.start.getTime();
      const jobStart = new Date(2025, 5, 9, 10, 0, 0).getTime();
      const jobEnd = new Date(2025, 5, 9, 12, 0, 0).getTime();
      expect(
        slotStart >= jobEnd || slotEnd <= jobStart
      ).toBe(true);
    }
  });

  it('should skip cancelled and completed jobs', () => {
    const existingJobs: ScheduledJob[] = [
      {
        id: '1',
        scheduled_start: new Date(2025, 5, 9, 10, 0, 0).toISOString(),
        scheduled_end: new Date(2025, 5, 9, 12, 0, 0).toISOString(),
        status: 'canceled',
      },
    ];
    const slotsWithCanceled = getAvailableSlots(
      new Date(2025, 5, 9),
      existingJobs,
      120,
      DEFAULT_BUSINESS_HOURS
    );
    const slotsEmpty = getAvailableSlots(
      new Date(2025, 5, 9),
      [],
      120,
      DEFAULT_BUSINESS_HOURS
    );
    expect(slotsWithCanceled.length).toBe(slotsEmpty.length);
  });

  it('should accept string date', () => {
    const date = new Date(2025, 5, 9);
    const slots = getAvailableSlots(date.toISOString(), [], 120, DEFAULT_BUSINESS_HOURS);
    expect(slots.length).toBeGreaterThan(0);
  });

  it('should respect slot duration parameter', () => {
    const shortSlots = getAvailableSlots(new Date(2025, 5, 9), [], 60, DEFAULT_BUSINESS_HOURS);
    const longSlots = getAvailableSlots(new Date(2025, 5, 9), [], 120, DEFAULT_BUSINESS_HOURS);
    expect(shortSlots.length).toBeGreaterThan(longSlots.length);
  });
});

// ============================================================================
// calculateEndTime
// ============================================================================

describe('calculateEndTime', () => {
  it('should use service-specific duration for known service type', () => {
    const start = new Date(2025, 5, 9, 9, 0, 0);
    const end = calculateEndTime(start, 'Garage Door Repair');
    // Garage Door Repair = 90 minutes
    const diffMs = end.getTime() - start.getTime();
    expect(diffMs).toBe(90 * 60 * 1000);
  });

  it('should use default duration for unknown service type', () => {
    const start = new Date(2025, 5, 9, 9, 0, 0);
    const end = calculateEndTime(start, 'Unknown Service');
    // Default = 120 minutes
    const diffMs = end.getTime() - start.getTime();
    expect(diffMs).toBe(120 * 60 * 1000);
  });

  it('should use default duration when service type is undefined', () => {
    const start = new Date(2025, 5, 9, 9, 0, 0);
    const end = calculateEndTime(start);
    const diffMs = end.getTime() - start.getTime();
    expect(diffMs).toBe(120 * 60 * 1000);
  });

  it('should accept string date', () => {
    const start = new Date(2025, 5, 9, 9, 0, 0);
    const end = calculateEndTime(start.toISOString(), 'Weatherstripping');
    // Weatherstripping = 30 minutes
    const expected = new Date(2025, 5, 9, 9, 30, 0);
    expect(end.getTime()).toBe(expected.getTime());
  });

  it('should handle Garage Door Installation (240 min)', () => {
    const start = new Date(2025, 5, 9, 8, 0, 0);
    const end = calculateEndTime(start, 'Garage Door Installation');
    const diffMs = end.getTime() - start.getTime();
    expect(diffMs).toBe(240 * 60 * 1000);
  });

  it('should handle Roller Replacement (45 min)', () => {
    const start = new Date(2025, 5, 9, 9, 0, 0);
    const end = calculateEndTime(start, 'Roller Replacement');
    const diffMs = end.getTime() - start.getTime();
    expect(diffMs).toBe(45 * 60 * 1000);
  });

  it('should handle Maintenance & Tune-up (45 min)', () => {
    const start = new Date(2025, 5, 9, 14, 0, 0);
    const end = calculateEndTime(start, 'Maintenance & Tune-up');
    const diffMs = end.getTime() - start.getTime();
    expect(diffMs).toBe(45 * 60 * 1000);
  });
});

// ============================================================================
// formatTimeSlot
// ============================================================================

describe('formatTimeSlot', () => {
  it('should format time slot with AM/PM', () => {
    const slot = {
      start: new Date(2025, 5, 9, 9, 0, 0),
      end: new Date(2025, 5, 9, 11, 0, 0),
    };
    const result = formatTimeSlot(slot);
    expect(result).toMatch(/\d{1,2}:\d{2}\s[AP]M\s-\s\d{1,2}:\d{2}\s[AP]M/);
  });

  it('should format AvailableSlot type', () => {
    const slot = {
      start: new Date(2025, 5, 9, 9, 0, 0),
      end: new Date(2025, 5, 9, 11, 0, 0),
      durationMinutes: 120,
    };
    const result = formatTimeSlot(slot);
    expect(result).toContain(' - ');
  });

  it('should handle PM times correctly', () => {
    const slot = {
      start: new Date(2025, 5, 9, 13, 0, 0), // 1 PM local
      end: new Date(2025, 5, 9, 15, 0, 0),   // 3 PM local
    };
    const result = formatTimeSlot(slot);
    expect(result).toContain('PM');
  });

  it('should handle morning times', () => {
    const slot = {
      start: new Date(2025, 5, 9, 8, 0, 0),
      end: new Date(2025, 5, 9, 9, 0, 0),
    };
    const result = formatTimeSlot(slot);
    expect(result).toContain('AM');
  });

  it('should handle noon', () => {
    const slot = {
      start: new Date(2025, 5, 9, 12, 0, 0),
      end: new Date(2025, 5, 9, 14, 0, 0),
    };
    const result = formatTimeSlot(slot);
    expect(result).toContain(' - ');
  });
});

// ============================================================================
// canReschedule
// ============================================================================

describe('canReschedule', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Wednesday June 11 at 6 AM local
    vi.setSystemTime(new Date(2025, 5, 11, 6, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return no conflicts for valid reschedule', () => {
    const existingJobs: ScheduledJob[] = [
      { id: 'job-1', scheduled_start: new Date(2025, 5, 12, 9, 0, 0).toISOString() },
      { id: 'job-2', scheduled_start: new Date(2025, 5, 12, 14, 0, 0).toISOString() },
    ];
    // Reschedule job-1 to Friday (day 5) 9-11 AM
    const conflicts = canReschedule(
      'job-1',
      new Date(2025, 5, 13, 9, 0, 0),  // Friday June 13
      new Date(2025, 5, 13, 11, 0, 0),
      existingJobs,
      [{ dayOfWeek: 5, startHour: 8, startMinute: 0, endHour: 17, endMinute: 0, isOpen: true }]
    );
    expect(conflicts).toHaveLength(0);
  });

  it('should exclude the job being rescheduled from conflict check', () => {
    const existingJobs: ScheduledJob[] = [
      { id: 'job-1', scheduled_start: new Date(2025, 5, 12, 9, 0, 0).toISOString(), scheduled_end: new Date(2025, 5, 12, 11, 0, 0).toISOString() },
    ];
    // Reschedule job-1 to same time -- no conflict because we exclude job-1
    const conflicts = canReschedule(
      'job-1',
      new Date(2025, 5, 12, 9, 0, 0),  // Thursday
      new Date(2025, 5, 12, 11, 0, 0),
      existingJobs,
      [{ dayOfWeek: 4, startHour: 8, startMinute: 0, endHour: 17, endMinute: 0, isOpen: true }]
    );
    expect(conflicts.filter((c) => c.type === 'overlap')).toHaveLength(0);
  });

  it('should detect conflicts with other jobs', () => {
    const existingJobs: ScheduledJob[] = [
      { id: 'job-1', scheduled_start: new Date(2025, 5, 12, 9, 0, 0).toISOString() },
      { id: 'job-2', scheduled_start: new Date(2025, 5, 12, 9, 30, 0).toISOString(), scheduled_end: new Date(2025, 5, 12, 11, 30, 0).toISOString() },
    ];
    const conflicts = canReschedule(
      'job-1',
      new Date(2025, 5, 12, 9, 30, 0),
      new Date(2025, 5, 12, 11, 30, 0),
      existingJobs,
      [{ dayOfWeek: 4, startHour: 8, startMinute: 0, endHour: 17, endMinute: 0, isOpen: true }]
    );
    expect(conflicts.some((c) => c.type === 'overlap')).toBe(true);
  });

  it('should check business hours for rescheduled time', () => {
    // Sunday (closed by default)
    const conflicts = canReschedule(
      'job-1',
      new Date(2025, 5, 15, 9, 0, 0),
      new Date(2025, 5, 15, 11, 0, 0),
      []
    );
    expect(conflicts.some((c) => c.type === 'outside_hours')).toBe(true);
  });

  it('should detect past dates', () => {
    // Yesterday
    const conflicts = canReschedule(
      'job-1',
      new Date(2025, 5, 10, 9, 0, 0),
      new Date(2025, 5, 10, 11, 0, 0),
      []
    );
    expect(conflicts.some((c) => c.type === 'in_past')).toBe(true);
  });
});
