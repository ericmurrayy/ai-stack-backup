import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  isValidPhone,
  isValidZip,
  isRequired,
  isPositiveNumber,
  isFutureDate,
  isValidDate,
  validateCustomer,
  validateLocation,
  validateJobSchedule,
  validateLineItem,
} from './validation';

// ============================================================================
// Basic Validators
// ============================================================================

describe('isValidEmail', () => {
  it('accepts valid emails', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('user.name@domain.org')).toBe(true);
    expect(isValidEmail('user+tag@example.co.uk')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('notanemail')).toBe(false);
    expect(isValidEmail('@domain.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('user @domain.com')).toBe(false);
  });
});

describe('isValidPhone', () => {
  it('accepts 10-digit US numbers', () => {
    expect(isValidPhone('5551234567')).toBe(true);
    expect(isValidPhone('(555) 123-4567')).toBe(true);
    expect(isValidPhone('555-123-4567')).toBe(true);
  });

  it('accepts 11-digit with country code', () => {
    expect(isValidPhone('15551234567')).toBe(true);
    expect(isValidPhone('+15551234567')).toBe(true);
  });

  it('rejects invalid phone numbers', () => {
    expect(isValidPhone('')).toBe(false);
    expect(isValidPhone('123')).toBe(false);
    expect(isValidPhone('abcdefghij')).toBe(false);
    expect(isValidPhone('123456789')).toBe(false); // 9 digits
  });
});

describe('isValidZip', () => {
  it('accepts 5-digit ZIP', () => {
    expect(isValidZip('01824')).toBe(true);
    expect(isValidZip('90210')).toBe(true);
  });

  it('accepts ZIP+4 format', () => {
    expect(isValidZip('01824-1234')).toBe(true);
  });

  it('rejects invalid ZIPs', () => {
    expect(isValidZip('')).toBe(false);
    expect(isValidZip('1234')).toBe(false);
    expect(isValidZip('123456')).toBe(false);
    expect(isValidZip('abcde')).toBe(false);
    expect(isValidZip('01824-12')).toBe(false); // incomplete +4
  });
});

describe('isRequired', () => {
  it('returns true for non-empty string', () => {
    expect(isRequired('hello')).toBe(true);
    expect(isRequired('  a  ')).toBe(true);
  });

  it('returns false for empty/whitespace/null/undefined', () => {
    expect(isRequired('')).toBe(false);
    expect(isRequired('   ')).toBe(false);
    expect(isRequired(null)).toBe(false);
    expect(isRequired(undefined)).toBe(false);
  });
});

describe('isPositiveNumber', () => {
  it('returns true for positive numbers', () => {
    expect(isPositiveNumber(1)).toBe(true);
    expect(isPositiveNumber(0.5)).toBe(true);
    expect(isPositiveNumber(1000)).toBe(true);
  });

  it('returns false for zero, negative, null, undefined', () => {
    expect(isPositiveNumber(0)).toBe(false);
    expect(isPositiveNumber(-1)).toBe(false);
    expect(isPositiveNumber(null)).toBe(false);
    expect(isPositiveNumber(undefined)).toBe(false);
  });
});

describe('isFutureDate', () => {
  it('returns true for future date', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(isFutureDate(future)).toBe(true);
  });

  it('returns false for past date', () => {
    expect(isFutureDate('2020-01-01T00:00:00.000Z')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isFutureDate(null)).toBe(false);
  });
});

describe('isValidDate', () => {
  it('accepts valid ISO dates', () => {
    expect(isValidDate('2024-06-15T10:30:00.000Z')).toBe(true);
    expect(isValidDate('2024-01-01')).toBe(true);
  });

  it('rejects invalid dates', () => {
    expect(isValidDate(null)).toBe(false);
    expect(isValidDate('not-a-date')).toBe(false);
    expect(isValidDate('')).toBe(false);
  });
});

// ============================================================================
// Form Validators
// ============================================================================

describe('validateCustomer', () => {
  it('passes with valid data', () => {
    const result = validateCustomer({ name: 'John Doe', phone: '5551234567', email: 'john@example.com' });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails without name', () => {
    const result = validateCustomer({ name: '' });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'name' })])
    );
  });

  it('fails with invalid phone', () => {
    const result = validateCustomer({ name: 'John', phone: '123' });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'phone' })])
    );
  });

  it('fails with invalid email', () => {
    const result = validateCustomer({ name: 'John', email: 'notanemail' });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'email' })])
    );
  });

  it('passes with name only', () => {
    const result = validateCustomer({ name: 'John Doe' });
    expect(result.valid).toBe(true);
  });
});

describe('validateLocation', () => {
  it('passes with valid data', () => {
    const result = validateLocation({
      address1: '123 Main St',
      city: 'Chelmsford',
      state: 'MA',
      postal_code: '01824',
    });
    expect(result.valid).toBe(true);
  });

  it('fails without required fields', () => {
    const result = validateLocation({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('fails with invalid ZIP', () => {
    const result = validateLocation({
      address1: '123 Main St',
      city: 'Chelmsford',
      state: 'MA',
      postal_code: '123',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'postal_code' })])
    );
  });
});

describe('validateJobSchedule', () => {
  it('passes with valid schedule', () => {
    const result = validateJobSchedule({
      scheduled_start: '2030-06-15T09:00:00.000Z',
      scheduled_end: '2030-06-15T11:00:00.000Z',
    });
    expect(result.valid).toBe(true);
  });

  it('fails when end is before start', () => {
    const result = validateJobSchedule({
      scheduled_start: '2030-06-15T11:00:00.000Z',
      scheduled_end: '2030-06-15T09:00:00.000Z',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'scheduled_end' })])
    );
  });

  it('fails with invalid date strings', () => {
    const result = validateJobSchedule({
      scheduled_start: 'not-a-date',
    });
    expect(result.valid).toBe(false);
  });

  it('passes with no schedule', () => {
    const result = validateJobSchedule({});
    expect(result.valid).toBe(true);
  });
});

describe('validateLineItem', () => {
  it('passes with valid data', () => {
    const result = validateLineItem({
      description: 'Spring replacement',
      quantity: 2,
      unit_price_cents: 5000,
    });
    expect(result.valid).toBe(true);
  });

  it('fails without description', () => {
    const result = validateLineItem({ quantity: 1, unit_price_cents: 100 });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'description' })])
    );
  });

  it('fails with zero quantity', () => {
    const result = validateLineItem({ description: 'Item', quantity: 0, unit_price_cents: 100 });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'quantity' })])
    );
  });

  it('fails with negative price', () => {
    const result = validateLineItem({ description: 'Item', quantity: 1, unit_price_cents: -100 });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'unit_price_cents' })])
    );
  });
});
