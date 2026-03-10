import { describe, it, expect } from 'vitest';
import {
  formatCents,
  formatCentsCompact,
  formatPhone,
  normalizePhone,
  formatInitials,
  truncate,
  formatDuration,
  formatMinutes,
  formatDate,
  formatTime,
  formatDateTime,
  formatAddress,
  formatAddressOneLine,
} from '../format';

// ============================================================================
// formatCents
// ============================================================================

describe('formatCents', () => {
  it('should format positive cents to USD', () => {
    expect(formatCents(12345)).toBe('$123.45');
  });

  it('should format zero cents', () => {
    expect(formatCents(0)).toBe('$0.00');
  });

  it('should format negative cents', () => {
    expect(formatCents(-5000)).toBe('-$50.00');
  });

  it('should format large amounts', () => {
    expect(formatCents(1000000)).toBe('$10,000.00');
  });

  it('should format single cent', () => {
    expect(formatCents(1)).toBe('$0.01');
  });

  it('should format amounts with rounding', () => {
    expect(formatCents(99)).toBe('$0.99');
  });

  it('should format very large amounts with commas', () => {
    expect(formatCents(99999999)).toBe('$999,999.99');
  });
});

// ============================================================================
// formatCentsCompact
// ============================================================================

describe('formatCentsCompact', () => {
  it('should format thousands as K', () => {
    expect(formatCentsCompact(150000)).toBe('$1.5K');
  });

  it('should format exact thousand', () => {
    expect(formatCentsCompact(100000)).toBe('$1.0K');
  });

  it('should format millions as M', () => {
    expect(formatCentsCompact(150000000)).toBe('$1.5M');
  });

  it('should format exact million', () => {
    expect(formatCentsCompact(100000000)).toBe('$1.0M');
  });

  it('should fall back to formatCents for small amounts', () => {
    expect(formatCentsCompact(5000)).toBe('$50.00');
  });

  it('should handle zero', () => {
    expect(formatCentsCompact(0)).toBe('$0.00');
  });

  it('should handle 999 dollars (just below K threshold)', () => {
    expect(formatCentsCompact(99900)).toBe('$999.00');
  });

  it('should handle large K values', () => {
    expect(formatCentsCompact(50000000)).toBe('$500.0K');
  });
});

// ============================================================================
// formatPhone
// ============================================================================

describe('formatPhone', () => {
  it('should format 10-digit phone number', () => {
    expect(formatPhone('5551234567')).toBe('(555) 123-4567');
  });

  it('should format 11-digit phone number starting with 1', () => {
    expect(formatPhone('15551234567')).toBe('+1 (555) 123-4567');
  });

  it('should handle phone with dashes', () => {
    expect(formatPhone('555-123-4567')).toBe('(555) 123-4567');
  });

  it('should handle phone with parentheses and spaces', () => {
    expect(formatPhone('(555) 123-4567')).toBe('(555) 123-4567');
  });

  it('should return original for invalid length', () => {
    expect(formatPhone('12345')).toBe('12345');
  });

  it('should return empty string for null', () => {
    expect(formatPhone(null)).toBe('');
  });

  it('should return empty string for empty string', () => {
    expect(formatPhone('')).toBe('');
  });
});

// ============================================================================
// normalizePhone
// ============================================================================

describe('normalizePhone', () => {
  it('should normalize 10-digit phone to E.164', () => {
    expect(normalizePhone('5551234567')).toBe('+15551234567');
  });

  it('should normalize 11-digit phone starting with 1', () => {
    expect(normalizePhone('15551234567')).toBe('+15551234567');
  });

  it('should handle formatted phone number', () => {
    expect(normalizePhone('(555) 123-4567')).toBe('+15551234567');
  });

  it('should handle phone with dashes', () => {
    expect(normalizePhone('555-123-4567')).toBe('+15551234567');
  });

  it('should return original for invalid phone', () => {
    expect(normalizePhone('12345')).toBe('12345');
  });

  it('should return empty string for null', () => {
    expect(normalizePhone(null)).toBe('');
  });

  it('should handle phone with +1 prefix', () => {
    expect(normalizePhone('+1 (555) 123-4567')).toBe('+15551234567');
  });
});

// ============================================================================
// formatInitials
// ============================================================================

describe('formatInitials', () => {
  it('should return initials for two-word name', () => {
    expect(formatInitials('John Doe')).toBe('JD');
  });

  it('should return single initial for single name', () => {
    expect(formatInitials('John')).toBe('J');
  });

  it('should return ? for null', () => {
    expect(formatInitials(null)).toBe('?');
  });

  it('should return ? for empty string', () => {
    expect(formatInitials('')).toBe('?');
  });

  it('should handle three-word name (first and last)', () => {
    expect(formatInitials('John Michael Doe')).toBe('JD');
  });

  it('should handle lowercase names', () => {
    expect(formatInitials('john doe')).toBe('JD');
  });

  it('should handle extra whitespace', () => {
    expect(formatInitials('  John   Doe  ')).toBe('JD');
  });
});

// ============================================================================
// truncate
// ============================================================================

describe('truncate', () => {
  it('should return text unchanged if shorter than max', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('should truncate long text with ellipsis', () => {
    expect(truncate('this is a long string', 10)).toBe('this is...');
  });

  it('should return empty string for null', () => {
    expect(truncate(null, 10)).toBe('');
  });

  it('should return empty string for empty text', () => {
    expect(truncate('', 10)).toBe('');
  });

  it('should handle text equal to max length', () => {
    expect(truncate('12345', 5)).toBe('12345');
  });

  it('should handle very short max length', () => {
    expect(truncate('hello world', 4)).toBe('h...');
  });

  it('should handle text one char over max', () => {
    expect(truncate('123456', 5)).toBe('12...');
  });
});

// ============================================================================
// formatDuration
// ============================================================================

describe('formatDuration', () => {
  it('should format hours and minutes', () => {
    expect(formatDuration(9000)).toBe('2h 30m');
  });

  it('should format minutes and seconds', () => {
    expect(formatDuration(150)).toBe('2m 30s');
  });

  it('should format seconds only', () => {
    expect(formatDuration(45)).toBe('45s');
  });

  it('should format exact hours', () => {
    expect(formatDuration(3600)).toBe('1h 0m');
  });

  it('should return empty string for null', () => {
    expect(formatDuration(null)).toBe('');
  });

  it('should return empty string for zero', () => {
    expect(formatDuration(0)).toBe('');
  });

  it('should format large durations', () => {
    expect(formatDuration(36000)).toBe('10h 0m');
  });
});

// ============================================================================
// formatMinutes
// ============================================================================

describe('formatMinutes', () => {
  it('should format hours and minutes', () => {
    expect(formatMinutes(150)).toBe('2h 30m');
  });

  it('should format hours only', () => {
    expect(formatMinutes(120)).toBe('2h');
  });

  it('should format minutes only', () => {
    expect(formatMinutes(45)).toBe('45m');
  });

  it('should return empty string for null', () => {
    expect(formatMinutes(null)).toBe('');
  });

  it('should return empty string for zero', () => {
    expect(formatMinutes(0)).toBe('');
  });

  it('should format single minute', () => {
    expect(formatMinutes(1)).toBe('1m');
  });

  it('should format large durations', () => {
    expect(formatMinutes(600)).toBe('10h');
  });
});

// ============================================================================
// formatDate
// ============================================================================

describe('formatDate', () => {
  it('should format ISO date string with default format', () => {
    expect(formatDate('2024-01-15T14:30:00Z')).toBe('Jan 15, 2024');
  });

  it('should format ISO date with custom format', () => {
    expect(formatDate('2024-01-15T14:30:00Z', 'yyyy-MM-dd')).toBe('2024-01-15');
  });

  it('should return empty string for null', () => {
    expect(formatDate(null)).toBe('');
  });

  it('should return original string for invalid date', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  it('should return empty string for empty string', () => {
    expect(formatDate('')).toBe('');
  });
});

// ============================================================================
// formatTime
// ============================================================================

describe('formatTime', () => {
  it('should format ISO date to time', () => {
    expect(formatTime('2024-01-15T14:30:00Z')).toMatch(/\d{1,2}:\d{2}\s[AP]M/);
  });

  it('should return empty string for null', () => {
    expect(formatTime(null)).toBe('');
  });

  it('should return empty string for empty string', () => {
    expect(formatTime('')).toBe('');
  });
});

// ============================================================================
// formatDateTime
// ============================================================================

describe('formatDateTime', () => {
  it('should format ISO date to date and time', () => {
    const result = formatDateTime('2024-01-15T14:30:00Z');
    expect(result).toContain('Jan');
    expect(result).toContain('2024');
  });

  it('should return empty string for null', () => {
    expect(formatDateTime(null)).toBe('');
  });

  it('should return empty string for empty string', () => {
    expect(formatDateTime('')).toBe('');
  });
});

// ============================================================================
// formatAddress
// ============================================================================

describe('formatAddress', () => {
  it('should format full address with address2', () => {
    const result = formatAddress('123 Main St', 'Apt 4B', 'Dallas', 'TX', '75201');
    expect(result).toBe('123 Main St\nApt 4B\nDallas, TX 75201');
  });

  it('should format address without address2', () => {
    const result = formatAddress('123 Main St', null, 'Dallas', 'TX', '75201');
    expect(result).toBe('123 Main St\nDallas, TX 75201');
  });
});

// ============================================================================
// formatAddressOneLine
// ============================================================================

describe('formatAddressOneLine', () => {
  it('should format address on one line', () => {
    expect(formatAddressOneLine('123 Main St', 'Dallas', 'TX')).toBe(
      '123 Main St, Dallas, TX'
    );
  });
});
