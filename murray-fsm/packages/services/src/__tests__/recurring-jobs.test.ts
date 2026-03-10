import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseRRule,
  buildRRule,
  getNextOccurrence,
  getUpcomingOccurrences,
  generateJobFromRecurring,
  isRecurringJobDue,
} from '../recurring-jobs';
import type { RecurringJob } from '@murray-fsm/shared';

// ============================================================================
// Helpers
// ============================================================================

function makeRecurringJob(overrides: Partial<RecurringJob> = {}): RecurringJob {
  return {
    id: 'rj-1',
    owner_id: 'owner-1',
    customer_id: 'cust-1',
    location_id: 'loc-1',
    title: 'Monthly Maintenance',
    service_type: 'Maintenance & Tune-up',
    description: 'Regular maintenance check',
    rrule: 'FREQ=MONTHLY;INTERVAL=1',
    duration_minutes: 60,
    assigned_technician_id: 'tech-1',
    line_items_template: [
      { name: 'Maintenance service', qty: 1, unit_price_cents: 5000 },
    ],
    next_occurrence_at: '2025-06-15T09:00:00Z',
    last_generated_at: '2025-05-15T09:00:00Z',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
    deleted: false,
    ...overrides,
  };
}

// ============================================================================
// parseRRule
// ============================================================================

describe('parseRRule', () => {
  it('should parse simple weekly rule', () => {
    const result = parseRRule('FREQ=WEEKLY;INTERVAL=1');
    expect(result.freq).toBe('WEEKLY');
    expect(result.interval).toBe(1);
  });

  it('should parse rule with BYDAY', () => {
    const result = parseRRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR');
    expect(result.freq).toBe('WEEKLY');
    expect(result.interval).toBe(2);
    expect(result.byDay).toEqual(['MO', 'WE', 'FR']);
  });

  it('should parse rule with COUNT', () => {
    const result = parseRRule('FREQ=DAILY;COUNT=10');
    expect(result.freq).toBe('DAILY');
    expect(result.count).toBe(10);
  });

  it('should parse rule with UNTIL', () => {
    const result = parseRRule('FREQ=MONTHLY;UNTIL=2025-12-31');
    expect(result.freq).toBe('MONTHLY');
    expect(result.until).toBe('2025-12-31');
  });

  it('should strip RRULE: prefix', () => {
    const result = parseRRule('RRULE:FREQ=WEEKLY;INTERVAL=1');
    expect(result.freq).toBe('WEEKLY');
    expect(result.interval).toBe(1);
  });

  it('should default to WEEKLY freq when not specified', () => {
    const result = parseRRule('INTERVAL=2');
    expect(result.freq).toBe('WEEKLY');
  });

  it('should default interval to 1 when not specified', () => {
    const result = parseRRule('FREQ=DAILY');
    expect(result.interval).toBe(1);
  });

  it('should handle yearly frequency', () => {
    const result = parseRRule('FREQ=YEARLY;INTERVAL=1');
    expect(result.freq).toBe('YEARLY');
  });
});

// ============================================================================
// buildRRule
// ============================================================================

describe('buildRRule', () => {
  it('should build simple weekly rule', () => {
    const result = buildRRule({ freq: 'WEEKLY' });
    expect(result).toBe('FREQ=WEEKLY');
  });

  it('should include interval when > 1', () => {
    const result = buildRRule({ freq: 'WEEKLY', interval: 2 });
    expect(result).toBe('FREQ=WEEKLY;INTERVAL=2');
  });

  it('should not include interval when 1', () => {
    const result = buildRRule({ freq: 'MONTHLY', interval: 1 });
    expect(result).toBe('FREQ=MONTHLY');
  });

  it('should include BYDAY', () => {
    const result = buildRRule({ freq: 'WEEKLY', byDay: ['MO', 'FR'] });
    expect(result).toBe('FREQ=WEEKLY;BYDAY=MO,FR');
  });

  it('should include COUNT', () => {
    const result = buildRRule({ freq: 'DAILY', count: 10 });
    expect(result).toBe('FREQ=DAILY;COUNT=10');
  });

  it('should include UNTIL', () => {
    const result = buildRRule({ freq: 'MONTHLY', until: '2025-12-31' });
    expect(result).toBe('FREQ=MONTHLY;UNTIL=2025-12-31');
  });

  it('should build complex rule with all options', () => {
    const result = buildRRule({
      freq: 'WEEKLY',
      interval: 2,
      byDay: ['MO', 'WE'],
      count: 5,
    });
    expect(result).toContain('FREQ=WEEKLY');
    expect(result).toContain('INTERVAL=2');
    expect(result).toContain('BYDAY=MO,WE');
    expect(result).toContain('COUNT=5');
  });

  it('should uppercase freq', () => {
    const result = buildRRule({ freq: 'weekly' });
    expect(result).toBe('FREQ=WEEKLY');
  });
});

// ============================================================================
// getNextOccurrence
// ============================================================================

describe('getNextOccurrence', () => {
  it('should find next daily occurrence', () => {
    const after = new Date('2025-06-10T12:00:00Z');
    const next = getNextOccurrence('FREQ=DAILY;INTERVAL=1', after);
    expect(next).not.toBeNull();
    expect(next!.getTime()).toBe(new Date('2025-06-11T12:00:00Z').getTime());
  });

  it('should find next weekly occurrence', () => {
    const after = new Date('2025-06-10T12:00:00Z');
    const next = getNextOccurrence('FREQ=WEEKLY;INTERVAL=1', after);
    expect(next).not.toBeNull();
    // One week later
    expect(next!.getTime()).toBe(new Date('2025-06-17T12:00:00Z').getTime());
  });

  it('should find next monthly occurrence', () => {
    const after = new Date('2025-06-10T12:00:00Z');
    const next = getNextOccurrence('FREQ=MONTHLY;INTERVAL=1', after);
    expect(next).not.toBeNull();
    // One month later
    expect(next!.getMonth()).toBe(6); // July (0-indexed)
  });

  it('should return null when past UNTIL date', () => {
    const after = new Date('2026-01-01T12:00:00Z');
    const next = getNextOccurrence('FREQ=WEEKLY;UNTIL=2025-12-31', after);
    expect(next).toBeNull();
  });

  it('should find next BYDAY occurrence (Monday)', () => {
    // Start from a Wednesday
    const after = new Date('2025-06-11T12:00:00Z');
    const next = getNextOccurrence('FREQ=WEEKLY;BYDAY=MO', after);
    expect(next).not.toBeNull();
    // Next Monday is June 16
    expect(next!.getDay()).toBe(1); // Monday
  });

  it('should find next occurrence for multi-day BYDAY', () => {
    // Start from Monday
    const after = new Date('2025-06-09T12:00:00Z');
    const next = getNextOccurrence('FREQ=WEEKLY;BYDAY=TU,TH', after);
    expect(next).not.toBeNull();
    // Next matching day is Tuesday June 10
    expect(next!.getDay()).toBe(2); // Tuesday
  });

  it('should use current date when afterDate not provided', () => {
    const next = getNextOccurrence('FREQ=YEARLY;INTERVAL=1');
    expect(next).not.toBeNull();
  });
});

// ============================================================================
// getUpcomingOccurrences
// ============================================================================

describe('getUpcomingOccurrences', () => {
  it('should generate multiple daily occurrences', () => {
    const from = new Date('2025-06-10T12:00:00Z');
    const occurrences = getUpcomingOccurrences('FREQ=DAILY;INTERVAL=1', from, 5);
    expect(occurrences).toHaveLength(5);
  });

  it('should generate weekly occurrences', () => {
    const from = new Date('2025-06-10T12:00:00Z');
    const occurrences = getUpcomingOccurrences('FREQ=WEEKLY;INTERVAL=1', from, 3);
    expect(occurrences).toHaveLength(3);
  });

  it('should respect COUNT limit in the rule', () => {
    const from = new Date('2025-06-10T12:00:00Z');
    const occurrences = getUpcomingOccurrences('FREQ=DAILY;COUNT=3', from, 10);
    expect(occurrences.length).toBeLessThanOrEqual(3);
  });

  it('should stop when UNTIL is reached', () => {
    const from = new Date('2025-06-10T12:00:00Z');
    const occurrences = getUpcomingOccurrences(
      'FREQ=DAILY;UNTIL=2025-06-13',
      from,
      10
    );
    // Should stop before/at the UNTIL date
    for (const occ of occurrences) {
      expect(occ.getTime()).toBeLessThanOrEqual(new Date('2025-06-13T23:59:59Z').getTime());
    }
  });

  it('should return empty array when no occurrences possible', () => {
    const from = new Date('2026-01-01T12:00:00Z');
    const occurrences = getUpcomingOccurrences('FREQ=WEEKLY;UNTIL=2025-12-31', from, 5);
    expect(occurrences).toHaveLength(0);
  });

  it('should generate BYDAY occurrences', () => {
    const from = new Date('2025-06-09T00:00:00Z'); // Monday
    const occurrences = getUpcomingOccurrences('FREQ=WEEKLY;BYDAY=MO,FR', from, 4);
    expect(occurrences.length).toBeGreaterThan(0);
    // All should be Monday (1) or Friday (5)
    for (const occ of occurrences) {
      expect([1, 5]).toContain(occ.getDay());
    }
  });
});

// ============================================================================
// generateJobFromRecurring
// ============================================================================

describe('generateJobFromRecurring', () => {
  it('should generate job data with correct fields', () => {
    const rj = makeRecurringJob();
    const occDate = new Date('2025-06-15');
    const job = generateJobFromRecurring(rj, occDate);

    expect(job.title).toBe('Monthly Maintenance');
    expect(job.customer_id).toBe('cust-1');
    expect(job.location_id).toBe('loc-1');
    expect(job.service_type).toBe('Maintenance & Tune-up');
    expect(job.description).toBe('Regular maintenance check');
    expect(job.duration_minutes).toBe(60);
    expect(job.assigned_technician_id).toBe('tech-1');
    expect(job.source).toBe('recurring');
    expect(job.recurring_job_id).toBe('rj-1');
  });

  it('should copy line items from template', () => {
    const rj = makeRecurringJob({
      line_items_template: [
        { name: 'Service A', qty: 1, unit_price_cents: 5000 },
        { name: 'Part B', qty: 2, unit_price_cents: 2500 },
      ],
    });
    const job = generateJobFromRecurring(rj, new Date('2025-06-15'));
    expect(job.line_items).toHaveLength(2);
    expect(job.line_items[0].name).toBe('Service A');
    expect(job.line_items[1].qty).toBe(2);
  });

  it('should preserve time from next_occurrence_at', () => {
    // Use local time constructor so getHours() returns the expected value
    const nextOcc = new Date(2025, 5, 15, 14, 30, 0);
    const rj = makeRecurringJob({ next_occurrence_at: nextOcc.toISOString() });
    const job = generateJobFromRecurring(rj, new Date(2025, 5, 15));
    expect(job.scheduled_at).toContain('14:30');
  });

  it('should default to 9 AM when no next_occurrence_at', () => {
    const rj = makeRecurringJob({ next_occurrence_at: null });
    const job = generateJobFromRecurring(rj, new Date(2025, 5, 15));
    expect(job.scheduled_at).toContain('09:00');
  });

  it('should calculate scheduled_end based on duration', () => {
    const startTime = new Date(2025, 5, 15, 9, 0, 0);
    const rj = makeRecurringJob({
      duration_minutes: 120,
      next_occurrence_at: startTime.toISOString(),
    });
    const job = generateJobFromRecurring(rj, new Date(2025, 5, 15));
    // End should be 2 hours after start (9 AM + 120 min = 11 AM)
    expect(job.scheduled_end).toContain('11:00');
  });

  it('should use empty string for customer_id when null', () => {
    const rj = makeRecurringJob({ customer_id: null });
    const job = generateJobFromRecurring(rj, new Date('2025-06-15'));
    expect(job.customer_id).toBe('');
  });
});

// ============================================================================
// isRecurringJobDue
// ============================================================================

describe('isRecurringJobDue', () => {
  it('should return true when job is due', () => {
    const rj = makeRecurringJob({
      next_occurrence_at: '2025-06-10T09:00:00Z',
      last_generated_at: '2025-05-10T09:00:00Z',
    });
    const now = new Date('2025-06-10T12:00:00Z');
    expect(isRecurringJobDue(rj, now)).toBe(true);
  });

  it('should return false when inactive', () => {
    const rj = makeRecurringJob({ is_active: false });
    expect(isRecurringJobDue(rj, new Date('2025-06-20T12:00:00Z'))).toBe(false);
  });

  it('should return false when deleted', () => {
    const rj = makeRecurringJob({ deleted: true });
    expect(isRecurringJobDue(rj, new Date('2025-06-20T12:00:00Z'))).toBe(false);
  });

  it('should return false when next_occurrence_at is null', () => {
    const rj = makeRecurringJob({ next_occurrence_at: null });
    expect(isRecurringJobDue(rj, new Date('2025-06-20T12:00:00Z'))).toBe(false);
  });

  it('should return false when next_occurrence is in the future', () => {
    const rj = makeRecurringJob({
      next_occurrence_at: '2025-07-15T09:00:00Z',
    });
    expect(isRecurringJobDue(rj, new Date('2025-06-10T12:00:00Z'))).toBe(false);
  });

  it('should return false when already generated for this occurrence', () => {
    const rj = makeRecurringJob({
      next_occurrence_at: '2025-06-15T09:00:00Z',
      last_generated_at: '2025-06-15T09:00:00Z', // same as next occurrence
    });
    expect(isRecurringJobDue(rj, new Date('2025-06-15T12:00:00Z'))).toBe(false);
  });

  it('should return false when UNTIL has passed', () => {
    const rj = makeRecurringJob({
      rrule: 'FREQ=MONTHLY;UNTIL=2025-05-01',
      next_occurrence_at: '2025-06-01T09:00:00Z',
      last_generated_at: '2025-04-01T09:00:00Z',
    });
    expect(isRecurringJobDue(rj, new Date('2025-06-10T12:00:00Z'))).toBe(false);
  });

  it('should return true when no last_generated_at', () => {
    const rj = makeRecurringJob({
      next_occurrence_at: '2025-06-10T09:00:00Z',
      last_generated_at: null,
    });
    expect(isRecurringJobDue(rj, new Date('2025-06-10T12:00:00Z'))).toBe(true);
  });
});
