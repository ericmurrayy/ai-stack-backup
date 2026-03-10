import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
} from '../validation';

// ============================================================================
// isValidEmail
// ============================================================================

describe('isValidEmail', () => {
  it('should accept valid email', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  it('should accept email with subdomain', () => {
    expect(isValidEmail('user@mail.example.com')).toBe(true);
  });

  it('should accept email with plus sign', () => {
    expect(isValidEmail('user+tag@example.com')).toBe(true);
  });

  it('should reject email without @', () => {
    expect(isValidEmail('userexample.com')).toBe(false);
  });

  it('should reject email without domain', () => {
    expect(isValidEmail('user@')).toBe(false);
  });

  it('should reject email without TLD', () => {
    expect(isValidEmail('user@example')).toBe(false);
  });

  it('should reject email with spaces', () => {
    expect(isValidEmail('user @example.com')).toBe(false);
  });

  it('should reject empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });
});

// ============================================================================
// isValidPhone
// ============================================================================

describe('isValidPhone', () => {
  it('should accept 10-digit phone number', () => {
    expect(isValidPhone('5551234567')).toBe(true);
  });

  it('should accept 11-digit phone starting with 1', () => {
    expect(isValidPhone('15551234567')).toBe(true);
  });

  it('should accept formatted phone with dashes', () => {
    expect(isValidPhone('555-123-4567')).toBe(true);
  });

  it('should accept formatted phone with parens and spaces', () => {
    expect(isValidPhone('(555) 123-4567')).toBe(true);
  });

  it('should reject too few digits', () => {
    expect(isValidPhone('5551234')).toBe(false);
  });

  it('should reject too many digits', () => {
    expect(isValidPhone('155512345678')).toBe(false);
  });

  it('should reject 11-digit not starting with 1', () => {
    expect(isValidPhone('25551234567')).toBe(false);
  });

  it('should reject empty string', () => {
    expect(isValidPhone('')).toBe(false);
  });
});

// ============================================================================
// isValidZip
// ============================================================================

describe('isValidZip', () => {
  it('should accept 5-digit zip', () => {
    expect(isValidZip('75201')).toBe(true);
  });

  it('should accept 5+4 zip', () => {
    expect(isValidZip('75201-1234')).toBe(true);
  });

  it('should reject 4-digit zip', () => {
    expect(isValidZip('7520')).toBe(false);
  });

  it('should reject 6-digit zip', () => {
    expect(isValidZip('752011')).toBe(false);
  });

  it('should reject zip with letters', () => {
    expect(isValidZip('7520A')).toBe(false);
  });

  it('should reject zip with invalid +4 format', () => {
    expect(isValidZip('75201-12')).toBe(false);
  });

  it('should reject empty string', () => {
    expect(isValidZip('')).toBe(false);
  });
});

// ============================================================================
// isRequired
// ============================================================================

describe('isRequired', () => {
  it('should accept non-empty string', () => {
    expect(isRequired('hello')).toBe(true);
  });

  it('should reject empty string', () => {
    expect(isRequired('')).toBe(false);
  });

  it('should reject whitespace-only string', () => {
    expect(isRequired('   ')).toBe(false);
  });

  it('should reject null', () => {
    expect(isRequired(null)).toBe(false);
  });

  it('should reject undefined', () => {
    expect(isRequired(undefined)).toBe(false);
  });

  it('should accept string with leading/trailing spaces', () => {
    expect(isRequired('  hello  ')).toBe(true);
  });
});

// ============================================================================
// isPositiveNumber
// ============================================================================

describe('isPositiveNumber', () => {
  it('should accept positive integer', () => {
    expect(isPositiveNumber(5)).toBe(true);
  });

  it('should accept positive decimal', () => {
    expect(isPositiveNumber(3.14)).toBe(true);
  });

  it('should reject zero', () => {
    expect(isPositiveNumber(0)).toBe(false);
  });

  it('should reject negative number', () => {
    expect(isPositiveNumber(-5)).toBe(false);
  });

  it('should reject null', () => {
    expect(isPositiveNumber(null)).toBe(false);
  });

  it('should reject undefined', () => {
    expect(isPositiveNumber(undefined)).toBe(false);
  });
});

// ============================================================================
// isFutureDate
// ============================================================================

describe('isFutureDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return true for future date', () => {
    expect(isFutureDate('2025-12-25T00:00:00Z')).toBe(true);
  });

  it('should return false for past date', () => {
    expect(isFutureDate('2024-01-01T00:00:00Z')).toBe(false);
  });

  it('should return false for null', () => {
    expect(isFutureDate(null)).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isFutureDate('')).toBe(false);
  });

  it('should return true for date far in the future', () => {
    expect(isFutureDate('2030-01-01T00:00:00Z')).toBe(true);
  });
});

// ============================================================================
// isValidDate
// ============================================================================

describe('isValidDate', () => {
  it('should accept valid ISO date', () => {
    expect(isValidDate('2024-01-15T14:30:00Z')).toBe(true);
  });

  it('should accept date-only string', () => {
    expect(isValidDate('2024-01-15')).toBe(true);
  });

  it('should reject null', () => {
    expect(isValidDate(null)).toBe(false);
  });

  it('should reject invalid date string', () => {
    expect(isValidDate('not-a-date')).toBe(false);
  });

  it('should reject empty string', () => {
    expect(isValidDate('')).toBe(false);
  });
});

// ============================================================================
// validateCustomer
// ============================================================================

describe('validateCustomer', () => {
  it('should pass with valid data', () => {
    const result = validateCustomer({
      name: 'John Doe',
      phone: '5551234567',
      email: 'john@example.com',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should pass with name only (phone and email optional)', () => {
    const result = validateCustomer({ name: 'John Doe' });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail with missing name', () => {
    const result = validateCustomer({ phone: '5551234567' });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].field).toBe('name');
  });

  it('should fail with empty name', () => {
    const result = validateCustomer({ name: '' });
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('name');
  });

  it('should fail with invalid phone', () => {
    const result = validateCustomer({ name: 'John', phone: '123' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'phone')).toBe(true);
  });

  it('should fail with invalid email', () => {
    const result = validateCustomer({ name: 'John', email: 'bad-email' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'email')).toBe(true);
  });

  it('should return multiple errors for multiple invalid fields', () => {
    const result = validateCustomer({
      name: '',
      phone: '123',
      email: 'bad',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

// ============================================================================
// validateLocation
// ============================================================================

describe('validateLocation', () => {
  it('should pass with valid data', () => {
    const result = validateLocation({
      address1: '123 Main St',
      city: 'Dallas',
      state: 'TX',
      postal_code: '75201',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should pass without postal_code (only validated if provided)', () => {
    const result = validateLocation({
      address1: '123 Main St',
      city: 'Dallas',
      state: 'TX',
    });
    expect(result.valid).toBe(true);
  });

  it('should fail with missing address1', () => {
    const result = validateLocation({
      city: 'Dallas',
      state: 'TX',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'address1')).toBe(true);
  });

  it('should fail with missing city', () => {
    const result = validateLocation({
      address1: '123 Main St',
      state: 'TX',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'city')).toBe(true);
  });

  it('should fail with missing state', () => {
    const result = validateLocation({
      address1: '123 Main St',
      city: 'Dallas',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'state')).toBe(true);
  });

  it('should fail with invalid postal code', () => {
    const result = validateLocation({
      address1: '123 Main St',
      city: 'Dallas',
      state: 'TX',
      postal_code: '123',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'postal_code')).toBe(true);
  });

  it('should return multiple errors for all missing fields', () => {
    const result = validateLocation({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(3); // address1, city, state
  });
});

// ============================================================================
// validateJobSchedule
// ============================================================================

describe('validateJobSchedule', () => {
  it('should pass with valid start and end', () => {
    const result = validateJobSchedule({
      scheduled_start: '2024-01-15T08:00:00Z',
      scheduled_end: '2024-01-15T10:00:00Z',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should pass with no dates (both optional)', () => {
    const result = validateJobSchedule({});
    expect(result.valid).toBe(true);
  });

  it('should fail with invalid start date', () => {
    const result = validateJobSchedule({
      scheduled_start: 'not-a-date',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'scheduled_start')).toBe(true);
  });

  it('should fail with invalid end date', () => {
    const result = validateJobSchedule({
      scheduled_end: 'not-a-date',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'scheduled_end')).toBe(true);
  });

  it('should fail when end is before start', () => {
    const result = validateJobSchedule({
      scheduled_start: '2024-01-15T10:00:00Z',
      scheduled_end: '2024-01-15T08:00:00Z',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('after start'))).toBe(true);
  });

  it('should fail when end equals start', () => {
    const result = validateJobSchedule({
      scheduled_start: '2024-01-15T10:00:00Z',
      scheduled_end: '2024-01-15T10:00:00Z',
    });
    expect(result.valid).toBe(false);
  });

  it('should pass with only start date', () => {
    const result = validateJobSchedule({
      scheduled_start: '2024-01-15T08:00:00Z',
    });
    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// validateLineItem
// ============================================================================

describe('validateLineItem', () => {
  it('should pass with valid data', () => {
    const result = validateLineItem({
      description: 'Spring replacement',
      quantity: 2,
      unit_price_cents: 5000,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail with missing description', () => {
    const result = validateLineItem({
      quantity: 2,
      unit_price_cents: 5000,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'description')).toBe(true);
  });

  it('should fail with empty description', () => {
    const result = validateLineItem({
      description: '',
      quantity: 2,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'description')).toBe(true);
  });

  it('should fail with zero quantity', () => {
    const result = validateLineItem({
      description: 'Spring',
      quantity: 0,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'quantity')).toBe(true);
  });

  it('should fail with negative quantity', () => {
    const result = validateLineItem({
      description: 'Spring',
      quantity: -1,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'quantity')).toBe(true);
  });

  it('should fail with negative price', () => {
    const result = validateLineItem({
      description: 'Spring',
      quantity: 1,
      unit_price_cents: -100,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'unit_price_cents')).toBe(true);
  });

  it('should pass with zero price (free item)', () => {
    const result = validateLineItem({
      description: 'Courtesy check',
      quantity: 1,
      unit_price_cents: 0,
    });
    expect(result.valid).toBe(true);
  });

  it('should fail with missing quantity', () => {
    const result = validateLineItem({
      description: 'Spring',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'quantity')).toBe(true);
  });
});
