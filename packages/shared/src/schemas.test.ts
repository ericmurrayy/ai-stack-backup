import { describe, it, expect } from 'vitest';
import {
  PhoneSchema,
  EmailSchema,
  UUIDSchema,
  MoneySchema,
  PaginationSchema,
  CustomerCreateSchema,
  CustomerUpdateSchema,
  LocationCreateSchema,
  LocationUpdateSchema,
  JobCreateSchema,
  JobUpdateSchema,
  JobStatusSchema,
  JobListSchema,
  PaymentCreateSchema,
  PaymentStatusSchema,
  QuoteLineItemSchema,
  InvoiceLineItemSchema,
  TimeEntryCreateSchema,
  AnalyticsQuerySchema,
} from './schemas';

// ============================================================================
// Primitive Schemas
// ============================================================================

describe('PhoneSchema', () => {
  it('accepts and normalizes 10-digit US number', () => {
    const result = PhoneSchema.parse('5551234567');
    expect(result).toBe('+15551234567');
  });

  it('accepts formatted US number', () => {
    const result = PhoneSchema.parse('(555) 123-4567');
    expect(result).toBe('+15551234567');
  });

  it('accepts number with country code', () => {
    const result = PhoneSchema.parse('1-555-123-4567');
    expect(result).toBe('+15551234567');
  });

  it('rejects invalid phone', () => {
    expect(() => PhoneSchema.parse('123')).toThrow();
    expect(() => PhoneSchema.parse('')).toThrow();
  });
});

describe('EmailSchema', () => {
  it('accepts valid email', () => {
    expect(EmailSchema.parse('test@example.com')).toBe('test@example.com');
  });

  it('rejects invalid email', () => {
    expect(() => EmailSchema.parse('notanemail')).toThrow();
    expect(() => EmailSchema.parse('')).toThrow();
  });
});

describe('UUIDSchema', () => {
  it('accepts valid UUID', () => {
    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    expect(UUIDSchema.parse(uuid)).toBe(uuid);
  });

  it('rejects invalid UUID', () => {
    expect(() => UUIDSchema.parse('not-a-uuid')).toThrow();
    expect(() => UUIDSchema.parse('')).toThrow();
  });
});

describe('MoneySchema', () => {
  it('accepts zero', () => {
    expect(MoneySchema.parse(0)).toBe(0);
  });

  it('accepts positive integers', () => {
    expect(MoneySchema.parse(12345)).toBe(12345);
  });

  it('rejects negative amounts', () => {
    expect(() => MoneySchema.parse(-1)).toThrow();
  });

  it('rejects non-integers', () => {
    expect(() => MoneySchema.parse(10.5)).toThrow();
  });
});

describe('PaginationSchema', () => {
  it('provides defaults', () => {
    const result = PaginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.sortOrder).toBe('desc');
  });

  it('coerces string numbers', () => {
    const result = PaginationSchema.parse({ page: '3', limit: '50' });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(50);
  });

  it('rejects page < 1', () => {
    expect(() => PaginationSchema.parse({ page: 0 })).toThrow();
  });

  it('rejects limit > 100', () => {
    expect(() => PaginationSchema.parse({ limit: 101 })).toThrow();
  });
});

// ============================================================================
// Customer Schemas
// ============================================================================

describe('CustomerCreateSchema', () => {
  it('accepts valid customer', () => {
    const result = CustomerCreateSchema.parse({
      name: 'John Doe',
      phone: '5551234567',
      email: 'john@example.com',
    });
    expect(result.name).toBe('John Doe');
    expect(result.phone).toBe('+15551234567'); // normalized
  });

  it('accepts name only', () => {
    const result = CustomerCreateSchema.parse({ name: 'Jane' });
    expect(result.name).toBe('Jane');
  });

  it('rejects empty name', () => {
    expect(() => CustomerCreateSchema.parse({ name: '' })).toThrow();
  });

  it('rejects missing name', () => {
    expect(() => CustomerCreateSchema.parse({})).toThrow();
  });
});

describe('CustomerUpdateSchema', () => {
  it('accepts partial updates', () => {
    const result = CustomerUpdateSchema.parse({ notes: 'Updated notes' });
    expect(result.notes).toBe('Updated notes');
  });

  it('accepts empty object (no changes)', () => {
    const result = CustomerUpdateSchema.parse({});
    expect(result).toBeDefined();
  });
});

// ============================================================================
// Location Schemas
// ============================================================================

describe('LocationCreateSchema', () => {
  it('accepts valid location', () => {
    const result = LocationCreateSchema.parse({
      customer_id: '123e4567-e89b-12d3-a456-426614174000',
      address1: '123 Main St',
      city: 'Chelmsford',
      state: 'MA',
      postal_code: '01824',
    });
    expect(result.address1).toBe('123 Main St');
  });

  it('accepts location with coordinates', () => {
    const result = LocationCreateSchema.parse({
      customer_id: '123e4567-e89b-12d3-a456-426614174000',
      address1: '123 Main St',
      city: 'Chelmsford',
      state: 'MA',
      postal_code: '01824',
      lat: 42.5995,
      lng: -71.3673,
    });
    expect(result.lat).toBe(42.5995);
  });

  it('rejects lat without lng', () => {
    expect(() =>
      LocationCreateSchema.parse({
        customer_id: '123e4567-e89b-12d3-a456-426614174000',
        address1: '123 Main St',
        city: 'Chelmsford',
        state: 'MA',
        postal_code: '01824',
        lat: 42.5995,
      })
    ).toThrow(/latitude and longitude/i);
  });

  it('rejects missing required fields', () => {
    expect(() =>
      LocationCreateSchema.parse({ customer_id: '123e4567-e89b-12d3-a456-426614174000' })
    ).toThrow();
  });
});

describe('LocationUpdateSchema', () => {
  it('accepts partial update without customer_id', () => {
    const result = LocationUpdateSchema.parse({ city: 'Lowell' });
    expect(result.city).toBe('Lowell');
  });

  it('still enforces lat/lng pair rule', () => {
    expect(() => LocationUpdateSchema.parse({ lat: 42.0 })).toThrow();
  });
});

// ============================================================================
// Job Schemas
// ============================================================================

describe('JobStatusSchema', () => {
  it('accepts valid statuses', () => {
    expect(JobStatusSchema.parse('scheduled')).toBe('scheduled');
    expect(JobStatusSchema.parse('in_progress')).toBe('in_progress');
    expect(JobStatusSchema.parse('completed')).toBe('completed');
    expect(JobStatusSchema.parse('canceled')).toBe('canceled');
  });

  it('rejects invalid status', () => {
    expect(() => JobStatusSchema.parse('invalid')).toThrow();
    expect(() => JobStatusSchema.parse('pending')).toThrow();
  });
});

describe('JobCreateSchema', () => {
  const validJob = {
    customer_id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'Garage door spring replacement',
  };

  it('accepts valid job', () => {
    const result = JobCreateSchema.parse(validJob);
    expect(result.title).toBe('Garage door spring replacement');
  });

  it('accepts job with schedule', () => {
    const result = JobCreateSchema.parse({
      ...validJob,
      scheduled_start: '2030-06-15T09:00:00.000Z',
      scheduled_end: '2030-06-15T11:00:00.000Z',
    });
    expect(result.scheduled_start).toBe('2030-06-15T09:00:00.000Z');
  });

  it('rejects end before start', () => {
    expect(() =>
      JobCreateSchema.parse({
        ...validJob,
        scheduled_start: '2030-06-15T11:00:00.000Z',
        scheduled_end: '2030-06-15T09:00:00.000Z',
      })
    ).toThrow(/end time/i);
  });

  it('rejects missing customer_id', () => {
    expect(() => JobCreateSchema.parse({ title: 'Test' })).toThrow();
  });

  it('rejects missing title', () => {
    expect(() =>
      JobCreateSchema.parse({ customer_id: '123e4567-e89b-12d3-a456-426614174000' })
    ).toThrow();
  });
});

describe('JobUpdateSchema', () => {
  it('accepts partial update', () => {
    const result = JobUpdateSchema.parse({ status: 'completed' });
    expect(result.status).toBe('completed');
  });

  it('accepts empty update', () => {
    const result = JobUpdateSchema.parse({});
    expect(result).toBeDefined();
  });

  it('rejects invalid status', () => {
    expect(() => JobUpdateSchema.parse({ status: 'invalid' })).toThrow();
  });
});

describe('JobListSchema', () => {
  it('provides defaults', () => {
    const result = JobListSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('accepts status filter as string', () => {
    const result = JobListSchema.parse({ status: 'scheduled' });
    expect(result.status).toBe('scheduled');
  });

  it('accepts status filter as array', () => {
    const result = JobListSchema.parse({ status: ['scheduled', 'in_progress'] });
    expect(result.status).toEqual(['scheduled', 'in_progress']);
  });
});

// ============================================================================
// Payment Schemas
// ============================================================================

describe('PaymentCreateSchema', () => {
  it('accepts valid payment', () => {
    const result = PaymentCreateSchema.parse({
      job_id: '123e4567-e89b-12d3-a456-426614174000',
      amount_cents: 15000,
    });
    expect(result.amount_cents).toBe(15000);
    expect(result.method).toBe('card'); // default
  });

  it('rejects zero amount', () => {
    expect(() =>
      PaymentCreateSchema.parse({
        job_id: '123e4567-e89b-12d3-a456-426614174000',
        amount_cents: 0,
      })
    ).toThrow();
  });

  it('rejects missing job_id', () => {
    expect(() => PaymentCreateSchema.parse({ amount_cents: 100 })).toThrow();
  });
});

describe('PaymentStatusSchema', () => {
  it('accepts all valid statuses', () => {
    const statuses = ['pending', 'processing', 'succeeded', 'failed', 'canceled', 'refunded'];
    for (const s of statuses) {
      expect(PaymentStatusSchema.parse(s)).toBe(s);
    }
  });
});

// ============================================================================
// Line Item Schemas
// ============================================================================

describe('QuoteLineItemSchema', () => {
  it('accepts valid line item', () => {
    const result = QuoteLineItemSchema.parse({
      name: 'Torsion Spring',
      quantity: 2,
      unit_price_cents: 7500,
    });
    expect(result.name).toBe('Torsion Spring');
    expect(result.unit_price_cents).toBe(7500);
  });

  it('rejects missing name', () => {
    expect(() => QuoteLineItemSchema.parse({ quantity: 1, unit_price_cents: 100 })).toThrow();
  });
});

describe('InvoiceLineItemSchema', () => {
  it('accepts valid line item', () => {
    const result = InvoiceLineItemSchema.parse({
      name: 'Labor - 2 hours',
      quantity: 1,
      unit_price_cents: 25000,
    });
    expect(result.name).toBe('Labor - 2 hours');
  });
});

// ============================================================================
// Time Entry Schemas
// ============================================================================

describe('TimeEntryCreateSchema', () => {
  it('accepts valid time entry', () => {
    const result = TimeEntryCreateSchema.parse({
      team_member_id: '123e4567-e89b-12d3-a456-426614174000',
      clock_in: '2024-06-15T08:00:00.000Z',
      clock_out: '2024-06-15T17:00:00.000Z',
    });
    expect(result.clock_in).toBe('2024-06-15T08:00:00.000Z');
  });

  it('rejects clock_out before clock_in', () => {
    expect(() =>
      TimeEntryCreateSchema.parse({
        team_member_id: '123e4567-e89b-12d3-a456-426614174000',
        clock_in: '2024-06-15T17:00:00.000Z',
        clock_out: '2024-06-15T08:00:00.000Z',
      })
    ).toThrow(/clock out/i);
  });

  it('accepts entry without clock_out (still on clock)', () => {
    const result = TimeEntryCreateSchema.parse({
      team_member_id: '123e4567-e89b-12d3-a456-426614174000',
      clock_in: '2024-06-15T08:00:00.000Z',
    });
    expect(result.clock_out).toBeUndefined();
  });
});

// ============================================================================
// Analytics Schema
// ============================================================================

describe('AnalyticsQuerySchema', () => {
  it('provides defaults', () => {
    const result = AnalyticsQuerySchema.parse({});
    expect(result.range).toBe('30d');
    expect(result.group_by).toBe('day');
  });

  it('rejects custom range without dates', () => {
    expect(() => AnalyticsQuerySchema.parse({ range: 'custom' })).toThrow();
  });

  it('accepts custom range with dates', () => {
    const result = AnalyticsQuerySchema.parse({
      range: 'custom',
      start_date: '2024-01-01',
      end_date: '2024-06-30',
    });
    expect(result.start_date).toBe('2024-01-01');
  });
});
