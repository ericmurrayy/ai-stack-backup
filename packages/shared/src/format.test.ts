import { describe, it, expect } from 'vitest';
import {
  formatCents,
  formatCentsCompact,
  formatPhone,
  normalizePhone,
  formatDate,
  formatTime,
  formatDateTime,
  formatRelativeTime,
  formatScheduleLabel,
  formatDuration,
  formatMinutes,
  formatAddress,
  formatAddressOneLine,
  formatInitials,
  truncate,
} from './format';

// ============================================================================
// Currency Formatting
// ============================================================================

describe('formatCents', () => {
  it('formats zero cents', () => {
    expect(formatCents(0)).toBe('$0.00');
  });

  it('formats positive cents to USD', () => {
    expect(formatCents(12345)).toBe('$123.45');
  });

  it('formats small amounts', () => {
    expect(formatCents(1)).toBe('$0.01');
    expect(formatCents(99)).toBe('$0.99');
  });

  it('formats large amounts with commas', () => {
    expect(formatCents(100000)).toBe('$1,000.00');
    expect(formatCents(999999)).toBe('$9,999.99');
  });

  it('handles exact dollar amounts', () => {
    expect(formatCents(500)).toBe('$5.00');
    expect(formatCents(10000)).toBe('$100.00');
  });
});

describe('formatCentsCompact', () => {
  it('returns normal format for amounts under $1K', () => {
    expect(formatCentsCompact(5000)).toBe('$50.00');
    expect(formatCentsCompact(99999)).toBe('$999.99');
  });

  it('formats thousands as K', () => {
    expect(formatCentsCompact(100000)).toBe('$1.0K');
    expect(formatCentsCompact(250000)).toBe('$2.5K');
  });

  it('formats millions as M', () => {
    expect(formatCentsCompact(100000000)).toBe('$1.0M');
    expect(formatCentsCompact(350000000)).toBe('$3.5M');
  });
});

// ============================================================================
// Phone Number Formatting
// ============================================================================

describe('formatPhone', () => {
  it('returns empty string for null', () => {
    expect(formatPhone(null)).toBe('');
  });

  it('formats 10-digit US number', () => {
    expect(formatPhone('5551234567')).toBe('(555) 123-4567');
  });

  it('formats 11-digit US number with country code', () => {
    expect(formatPhone('15551234567')).toBe('+1 (555) 123-4567');
  });

  it('handles already-formatted number', () => {
    expect(formatPhone('+1 (555) 123-4567')).toBe('+1 (555) 123-4567');
  });

  it('returns original for non-US formats', () => {
    expect(formatPhone('+442012345678')).toBe('+442012345678');
  });

  it('strips non-digit chars before formatting', () => {
    expect(formatPhone('555-123-4567')).toBe('(555) 123-4567');
    expect(formatPhone('(555) 123-4567')).toBe('(555) 123-4567');
  });
});

describe('normalizePhone', () => {
  it('returns empty string for null', () => {
    expect(normalizePhone(null)).toBe('');
  });

  it('normalizes 10-digit to E.164', () => {
    expect(normalizePhone('5551234567')).toBe('+15551234567');
  });

  it('normalizes 11-digit with leading 1', () => {
    expect(normalizePhone('15551234567')).toBe('+15551234567');
  });

  it('strips formatting chars', () => {
    expect(normalizePhone('(555) 123-4567')).toBe('+15551234567');
    expect(normalizePhone('555.123.4567')).toBe('+15551234567');
  });

  it('returns original for unrecognized formats', () => {
    expect(normalizePhone('+442012345678')).toBe('+442012345678');
  });
});

// ============================================================================
// Date/Time Formatting
// ============================================================================

describe('formatDate', () => {
  it('returns empty string for null', () => {
    expect(formatDate(null)).toBe('');
  });

  it('formats ISO date string', () => {
    expect(formatDate('2024-06-15T10:30:00.000Z')).toMatch(/Jun 15, 2024/);
  });

  it('accepts custom format string', () => {
    // Use mid-year noon UTC to avoid timezone rollover
    expect(formatDate('2024-06-15T12:00:00.000Z', 'yyyy')).toBe('2024');
  });

  it('returns original for invalid date', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});

describe('formatTime', () => {
  it('returns empty string for null', () => {
    expect(formatTime(null)).toBe('');
  });

  it('formats ISO to time only', () => {
    const result = formatTime('2024-06-15T14:30:00.000Z');
    // Result depends on local timezone, just check it's not empty
    expect(result).toBeTruthy();
    expect(result).toMatch(/\d{1,2}:\d{2}\s[AP]M/);
  });
});

describe('formatDateTime', () => {
  it('returns empty string for null', () => {
    expect(formatDateTime(null)).toBe('');
  });

  it('formats ISO to date and time', () => {
    const result = formatDateTime('2024-06-15T14:30:00.000Z');
    expect(result).toBeTruthy();
    expect(result).toMatch(/Jun 15, 2024/);
  });
});

describe('formatRelativeTime', () => {
  it('returns empty string for null', () => {
    expect(formatRelativeTime(null)).toBe('');
  });

  it('returns relative time string', () => {
    const recentDate = new Date(Date.now() - 60000).toISOString();
    const result = formatRelativeTime(recentDate);
    expect(result).toMatch(/ago/);
  });
});

describe('formatScheduleLabel', () => {
  it('returns Unscheduled for null', () => {
    expect(formatScheduleLabel(null)).toBe('Unscheduled');
  });

  it('returns Today label for today', () => {
    const today = new Date();
    today.setHours(14, 30, 0, 0);
    const result = formatScheduleLabel(today.toISOString());
    expect(result).toMatch(/Today at/);
  });

  it('returns Tomorrow label for tomorrow', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const result = formatScheduleLabel(tomorrow.toISOString());
    expect(result).toMatch(/Tomorrow at/);
  });

  it('returns formatted date for other days', () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(14, 0, 0, 0); // 2pm avoids timezone edge cases
    const result = formatScheduleLabel(nextWeek.toISOString());
    // Should contain day abbreviation and time
    expect(result).toBeTruthy();
    expect(result).not.toBe('Unscheduled');
    expect(result).toMatch(/\d{1,2}:\d{2}\s[AP]M/);
  });
});

// ============================================================================
// Duration Formatting
// ============================================================================

describe('formatDuration', () => {
  it('returns empty string for null', () => {
    expect(formatDuration(null)).toBe('');
  });

  it('formats seconds only', () => {
    expect(formatDuration(45)).toBe('45s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(90)).toBe('1m 30s');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(3660)).toBe('1h 1m');
  });

  it('formats exact hours', () => {
    expect(formatDuration(7200)).toBe('2h 0m');
  });
});

describe('formatMinutes', () => {
  it('returns empty string for null', () => {
    expect(formatMinutes(null)).toBe('');
  });

  it('formats minutes only', () => {
    expect(formatMinutes(45)).toBe('45m');
  });

  it('formats hours and minutes', () => {
    expect(formatMinutes(90)).toBe('1h 30m');
  });

  it('formats exact hours', () => {
    expect(formatMinutes(120)).toBe('2h');
  });
});

// ============================================================================
// Address Formatting
// ============================================================================

describe('formatAddress', () => {
  it('formats full address', () => {
    const result = formatAddress('123 Main St', 'Apt 4', 'Chelmsford', 'MA', '01824');
    expect(result).toBe('123 Main St\nApt 4\nChelmsford, MA 01824');
  });

  it('omits null address2', () => {
    const result = formatAddress('123 Main St', null, 'Chelmsford', 'MA', '01824');
    expect(result).toBe('123 Main St\nChelmsford, MA 01824');
  });
});

describe('formatAddressOneLine', () => {
  it('formats single-line address', () => {
    expect(formatAddressOneLine('123 Main St', 'Chelmsford', 'MA')).toBe(
      '123 Main St, Chelmsford, MA'
    );
  });
});

// ============================================================================
// Name Formatting
// ============================================================================

describe('formatInitials', () => {
  it('returns ? for null', () => {
    expect(formatInitials(null)).toBe('?');
  });

  it('returns single initial for one name', () => {
    expect(formatInitials('Eric')).toBe('E');
  });

  it('returns two initials for full name', () => {
    expect(formatInitials('Eric Murray')).toBe('EM');
  });

  it('handles multiple names', () => {
    expect(formatInitials('John Michael Smith')).toBe('JS');
  });

  it('handles extra whitespace', () => {
    expect(formatInitials('  Eric  Murray  ')).toBe('EM');
  });
});

describe('truncate', () => {
  it('returns empty string for null', () => {
    expect(truncate(null, 10)).toBe('');
  });

  it('returns text unchanged if under limit', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates with ellipsis', () => {
    expect(truncate('hello world', 8)).toBe('hello...');
  });

  it('handles exact length', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });
});
