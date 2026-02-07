import { describe, it, expect } from 'vitest';
import {
  JOB_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
  ACTION_STATUS_CONFIG,
  ACTION_KIND_CONFIG,
  SERVICE_TYPES,
  US_STATES,
  DEFAULTS,
} from './constants';

describe('JOB_STATUS_CONFIG', () => {
  it('has all expected statuses', () => {
    const statuses = Object.keys(JOB_STATUS_CONFIG);
    expect(statuses).toContain('scheduled');
    expect(statuses).toContain('in_progress');
    expect(statuses).toContain('completed');
    expect(statuses).toContain('canceled');
  });

  it('every status has label, color, bgColor, textColor', () => {
    for (const [key, config] of Object.entries(JOB_STATUS_CONFIG)) {
      expect(config.label, `${key} missing label`).toBeTruthy();
      expect(config.color, `${key} missing color`).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(config.bgColor, `${key} missing bgColor`).toBeTruthy();
      expect(config.textColor, `${key} missing textColor`).toBeTruthy();
    }
  });
});

describe('PAYMENT_STATUS_CONFIG', () => {
  it('has all expected statuses', () => {
    const statuses = Object.keys(PAYMENT_STATUS_CONFIG);
    expect(statuses).toEqual(
      expect.arrayContaining(['pending', 'processing', 'succeeded', 'failed', 'canceled', 'refunded'])
    );
  });

  it('every status has label and color', () => {
    for (const [key, config] of Object.entries(PAYMENT_STATUS_CONFIG)) {
      expect(config.label, `${key} missing label`).toBeTruthy();
      expect(config.color, `${key} missing color`).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe('ACTION_STATUS_CONFIG', () => {
  it('has all expected statuses', () => {
    expect(Object.keys(ACTION_STATUS_CONFIG)).toEqual(
      expect.arrayContaining(['pending', 'approved', 'rejected', 'executed', 'failed'])
    );
  });
});

describe('ACTION_KIND_CONFIG', () => {
  it('has all expected kinds', () => {
    expect(Object.keys(ACTION_KIND_CONFIG)).toEqual(
      expect.arrayContaining(['create_job', 'schedule_job', 'send_sms', 'send_email'])
    );
  });

  it('every kind has label and icon', () => {
    for (const [key, config] of Object.entries(ACTION_KIND_CONFIG)) {
      expect(config.label, `${key} missing label`).toBeTruthy();
      expect(config.icon, `${key} missing icon`).toBeTruthy();
    }
  });
});

describe('SERVICE_TYPES', () => {
  it('includes core garage door services', () => {
    expect(SERVICE_TYPES).toContain('Garage Door Repair');
    expect(SERVICE_TYPES).toContain('Garage Door Installation');
    expect(SERVICE_TYPES).toContain('Spring Replacement');
    expect(SERVICE_TYPES).toContain('Emergency Service');
  });

  it('has no duplicates', () => {
    const unique = new Set(SERVICE_TYPES);
    expect(unique.size).toBe(SERVICE_TYPES.length);
  });
});

describe('US_STATES', () => {
  it('has 50 states', () => {
    expect(US_STATES).toHaveLength(50);
  });

  it('includes Massachusetts', () => {
    const ma = US_STATES.find((s) => s.code === 'MA');
    expect(ma).toBeDefined();
    expect(ma!.name).toBe('Massachusetts');
  });

  it('every state has code and name', () => {
    for (const state of US_STATES) {
      expect(state.code).toMatch(/^[A-Z]{2}$/);
      expect(state.name.length).toBeGreaterThan(0);
    }
  });

  it('codes are unique', () => {
    const codes = US_STATES.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('DEFAULTS', () => {
  it('has sensible page size', () => {
    expect(DEFAULTS.PAGE_SIZE).toBeGreaterThan(0);
    expect(DEFAULTS.PAGE_SIZE).toBeLessThanOrEqual(DEFAULTS.MAX_PAGE_SIZE);
  });

  it('has default job duration', () => {
    expect(DEFAULTS.DEFAULT_JOB_DURATION).toBeGreaterThan(0);
  });

  it('uses USD currency', () => {
    expect(DEFAULTS.CURRENCY).toBe('USD');
  });
});
