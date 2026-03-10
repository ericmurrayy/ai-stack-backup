import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateRevenueTrend,
  calculateJobProfitability,
  calculateCustomerLTV,
  calculateClosingRate,
  getRevenueByServiceType,
  getJobTrends,
  getKPIs,
} from '../analytics';

// ============================================================================
// Helpers
// ============================================================================

function makeJob(overrides: Partial<{
  id: string;
  status: string;
  service_category?: string;
  created_at: string;
  completed_at?: string | null;
  closed_at?: string | null;
  total_cents?: number;
}> = {}) {
  return {
    id: 'job-1',
    status: 'completed',
    created_at: '2025-06-01T10:00:00Z',
    total_cents: 15000,
    ...overrides,
  };
}

// ============================================================================
// calculateRevenueTrend
// ============================================================================

describe('calculateRevenueTrend', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return one entry per month for default 6 months', () => {
    const trend = calculateRevenueTrend([]);
    expect(trend).toHaveLength(6);
  });

  it('should return specified number of months', () => {
    const trend = calculateRevenueTrend([], 3);
    expect(trend).toHaveLength(3);
  });

  it('should aggregate revenue by month', () => {
    const jobs = [
      makeJob({ id: 'j1', closed_at: '2025-06-10T10:00:00Z', total_cents: 10000 }),
      makeJob({ id: 'j2', closed_at: '2025-06-12T10:00:00Z', total_cents: 5000 }),
    ];
    const trend = calculateRevenueTrend(jobs);
    const juneEntry = trend.find((t) => t.month === '2025-06');
    expect(juneEntry).toBeDefined();
    expect(juneEntry!.revenue).toBe(15000);
  });

  it('should zero-fill months with no revenue', () => {
    const trend = calculateRevenueTrend([]);
    expect(trend.every((t) => t.revenue === 0)).toBe(true);
  });

  it('should only count completed jobs', () => {
    const jobs = [
      makeJob({ id: 'j1', status: 'completed', closed_at: '2025-06-10T10:00:00Z', total_cents: 10000 }),
      makeJob({ id: 'j2', status: 'cancelled', closed_at: '2025-06-10T10:00:00Z', total_cents: 5000 }),
    ];
    const trend = calculateRevenueTrend(jobs);
    const juneEntry = trend.find((t) => t.month === '2025-06');
    expect(juneEntry!.revenue).toBe(10000);
  });

  it('should exclude jobs before the period', () => {
    const jobs = [
      makeJob({ id: 'j1', closed_at: '2024-01-01T10:00:00Z', total_cents: 50000 }),
    ];
    const trend = calculateRevenueTrend(jobs, 6);
    const total = trend.reduce((sum, t) => sum + t.revenue, 0);
    expect(total).toBe(0);
  });

  it('should be sorted chronologically', () => {
    const trend = calculateRevenueTrend([]);
    for (let i = 1; i < trend.length; i++) {
      expect(trend[i].month > trend[i - 1].month).toBe(true);
    }
  });
});

// ============================================================================
// calculateJobProfitability
// ============================================================================

describe('calculateJobProfitability', () => {
  it('should calculate profitability with all components', () => {
    const job = { total_cents: 30000 };
    const lineItems = [
      { quantity: 2, unit_price_cents: 5000 },
    ];
    const timeEntries = [
      {
        started_at: '2025-06-10T09:00:00Z',
        ended_at: '2025-06-10T11:00:00Z',
        entry_type: 'work',
      },
    ];
    const result = calculateJobProfitability(job, lineItems, timeEntries, 5000); // $50/hr

    expect(result.revenue).toBe(30000);
    expect(result.materialCost).toBe(10000); // 2 * 5000
    expect(result.laborCost).toBe(10000); // 2 hours * $50/hr = $100 = 10000 cents
    expect(result.profit).toBe(10000); // 30000 - 10000 - 10000
    expect(result.margin).toBeGreaterThan(0);
  });

  it('should exclude break entries from labor cost', () => {
    const timeEntries = [
      { started_at: '2025-06-10T09:00:00Z', ended_at: '2025-06-10T10:00:00Z', entry_type: 'work' },
      { started_at: '2025-06-10T10:00:00Z', ended_at: '2025-06-10T10:30:00Z', entry_type: 'break' },
    ];
    const result = calculateJobProfitability({ total_cents: 20000 }, [], timeEntries, 6000);

    // Only 1 hour of work, not 1.5 hours
    expect(result.laborCost).toBe(6000); // 1 hour * $60/hr
  });

  it('should handle zero revenue', () => {
    const result = calculateJobProfitability({ total_cents: 0 }, [], [], 5000);
    expect(result.revenue).toBe(0);
    expect(result.margin).toBe(0);
  });

  it('should handle no line items or time entries', () => {
    const result = calculateJobProfitability({ total_cents: 15000 }, [], [], 5000);
    expect(result.revenue).toBe(15000);
    expect(result.materialCost).toBe(0);
    expect(result.laborCost).toBe(0);
    expect(result.profit).toBe(15000);
    expect(result.margin).toBe(100);
  });

  it('should handle missing ended_at on time entries', () => {
    const timeEntries = [
      { started_at: '2025-06-10T09:00:00Z', ended_at: null, entry_type: 'work' },
    ];
    const result = calculateJobProfitability({ total_cents: 10000 }, [], timeEntries, 5000);
    expect(result.laborCost).toBe(0);
  });

  it('should handle undefined total_cents', () => {
    const result = calculateJobProfitability({}, [], [], 5000);
    expect(result.revenue).toBe(0);
    expect(result.profit).toBe(0);
  });

  it('should calculate margin as percentage', () => {
    const result = calculateJobProfitability({ total_cents: 20000 }, [], [], 0);
    expect(result.margin).toBe(100); // 100% margin when no costs
  });
});

// ============================================================================
// calculateCustomerLTV
// ============================================================================

describe('calculateCustomerLTV', () => {
  it('should sum revenue from completed jobs', () => {
    const customer = { id: 'cust-1' };
    const jobs = [
      makeJob({ id: 'j1', status: 'completed', total_cents: 10000 }),
      makeJob({ id: 'j2', status: 'completed', total_cents: 20000 }),
    ];
    expect(calculateCustomerLTV(customer, jobs)).toBe(30000);
  });

  it('should exclude non-completed jobs', () => {
    const customer = { id: 'cust-1' };
    const jobs = [
      makeJob({ id: 'j1', status: 'completed', total_cents: 10000 }),
      makeJob({ id: 'j2', status: 'cancelled', total_cents: 20000 }),
    ];
    expect(calculateCustomerLTV(customer, jobs)).toBe(10000);
  });

  it('should return 0 for no jobs', () => {
    expect(calculateCustomerLTV({ id: 'cust-1' }, [])).toBe(0);
  });

  it('should handle jobs without total_cents', () => {
    const jobs = [
      makeJob({ id: 'j1', status: 'completed', total_cents: undefined }),
    ];
    expect(calculateCustomerLTV({ id: 'cust-1' }, jobs)).toBe(0);
  });

  it('should handle mix of jobs with and without total_cents', () => {
    const jobs = [
      makeJob({ id: 'j1', status: 'completed', total_cents: 10000 }),
      makeJob({ id: 'j2', status: 'completed', total_cents: undefined }),
      makeJob({ id: 'j3', status: 'completed', total_cents: 5000 }),
    ];
    expect(calculateCustomerLTV({ id: 'cust-1' }, jobs)).toBe(15000);
  });
});

// ============================================================================
// calculateClosingRate
// ============================================================================

describe('calculateClosingRate', () => {
  it('should calculate closing rate correctly', () => {
    const jobs = [
      makeJob({ id: 'j1', status: 'completed' }),
      makeJob({ id: 'j2', status: 'completed' }),
      makeJob({ id: 'j3', status: 'cancelled' }),
      makeJob({ id: 'j4', status: 'completed' }),
    ];
    // 3 completed / (3 completed + 1 cancelled) = 75%
    expect(calculateClosingRate(jobs)).toBe(75);
  });

  it('should return 100 when all jobs are completed', () => {
    const jobs = [
      makeJob({ id: 'j1', status: 'completed' }),
      makeJob({ id: 'j2', status: 'completed' }),
    ];
    expect(calculateClosingRate(jobs)).toBe(100);
  });

  it('should return 0 when all jobs are cancelled', () => {
    const jobs = [
      makeJob({ id: 'j1', status: 'cancelled' }),
      makeJob({ id: 'j2', status: 'cancelled' }),
    ];
    expect(calculateClosingRate(jobs)).toBe(0);
  });

  it('should return 0 for empty array', () => {
    expect(calculateClosingRate([])).toBe(0);
  });

  it('should ignore non-terminal statuses', () => {
    const jobs = [
      makeJob({ id: 'j1', status: 'completed' }),
      makeJob({ id: 'j2', status: 'in_progress' }),
      makeJob({ id: 'j3', status: 'scheduled' }),
    ];
    // Only 1 completed, 0 cancelled => 100%
    expect(calculateClosingRate(jobs)).toBe(100);
  });

  it('should handle 50/50 split', () => {
    const jobs = [
      makeJob({ id: 'j1', status: 'completed' }),
      makeJob({ id: 'j2', status: 'cancelled' }),
    ];
    expect(calculateClosingRate(jobs)).toBe(50);
  });
});

// ============================================================================
// getRevenueByServiceType
// ============================================================================

describe('getRevenueByServiceType', () => {
  it('should group revenue by service category', () => {
    const jobs = [
      makeJob({ id: 'j1', service_category: 'spring_repair', total_cents: 10000 }),
      makeJob({ id: 'j2', service_category: 'spring_repair', total_cents: 5000 }),
      makeJob({ id: 'j3', service_category: 'opener_install', total_cents: 20000 }),
    ];
    const result = getRevenueByServiceType(jobs);
    expect(result['spring_repair']).toBe(15000);
    expect(result['opener_install']).toBe(20000);
  });

  it('should only include completed jobs', () => {
    const jobs = [
      makeJob({ id: 'j1', status: 'completed', service_category: 'repair', total_cents: 10000 }),
      makeJob({ id: 'j2', status: 'cancelled', service_category: 'repair', total_cents: 5000 }),
    ];
    const result = getRevenueByServiceType(jobs);
    expect(result['repair']).toBe(10000);
  });

  it('should use uncategorized for jobs without service_category', () => {
    const jobs = [
      makeJob({ id: 'j1', service_category: undefined, total_cents: 10000 }),
    ];
    const result = getRevenueByServiceType(jobs);
    expect(result['uncategorized']).toBe(10000);
  });

  it('should return empty object for no jobs', () => {
    expect(getRevenueByServiceType([])).toEqual({});
  });

  it('should exclude jobs without total_cents', () => {
    const jobs = [
      makeJob({ id: 'j1', service_category: 'repair', total_cents: undefined }),
    ];
    const result = getRevenueByServiceType(jobs);
    expect(Object.keys(result)).toHaveLength(0);
  });
});

// ============================================================================
// getJobTrends
// ============================================================================

describe('getJobTrends', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return one entry per month', () => {
    const trends = getJobTrends([], 6);
    expect(trends).toHaveLength(6);
  });

  it('should count jobs per month', () => {
    const jobs = [
      makeJob({ id: 'j1', created_at: '2025-06-01T10:00:00Z' }),
      makeJob({ id: 'j2', created_at: '2025-06-05T10:00:00Z' }),
      makeJob({ id: 'j3', created_at: '2025-05-15T10:00:00Z' }),
    ];
    const trends = getJobTrends(jobs);
    const juneEntry = trends.find((t) => t.month === '2025-06');
    const mayEntry = trends.find((t) => t.month === '2025-05');
    expect(juneEntry!.count).toBe(2);
    expect(mayEntry!.count).toBe(1);
  });

  it('should count all statuses (not just completed)', () => {
    const jobs = [
      makeJob({ id: 'j1', status: 'scheduled', created_at: '2025-06-01T10:00:00Z' }),
      makeJob({ id: 'j2', status: 'cancelled', created_at: '2025-06-05T10:00:00Z' }),
    ];
    const trends = getJobTrends(jobs);
    const juneEntry = trends.find((t) => t.month === '2025-06');
    expect(juneEntry!.count).toBe(2);
  });

  it('should zero-fill months with no jobs', () => {
    const trends = getJobTrends([]);
    expect(trends.every((t) => t.count === 0)).toBe(true);
  });

  it('should be sorted chronologically', () => {
    const trends = getJobTrends([]);
    for (let i = 1; i < trends.length; i++) {
      expect(trends[i].month > trends[i - 1].month).toBe(true);
    }
  });

  it('should respect custom months parameter', () => {
    const trends = getJobTrends([], 3);
    expect(trends).toHaveLength(3);
  });
});

// ============================================================================
// getKPIs
// ============================================================================

describe('getKPIs', () => {
  it('should calculate all KPIs correctly', () => {
    const jobs = [
      makeJob({ id: 'j1', status: 'completed', total_cents: 10000 }),
      makeJob({ id: 'j2', status: 'completed', total_cents: 20000 }),
      makeJob({ id: 'j3', status: 'cancelled' }),
    ];
    const estimates = [
      { id: 'e1', status: 'approved', total_cents: 15000, created_at: '2025-06-01T00:00:00Z' },
    ];
    const reviews = [
      { rating: 5 },
      { rating: 4 },
    ];
    const agreements = [
      { status: 'active', price_cents: 12000, billing_cycle: 'monthly' },
    ];

    const kpis = getKPIs(jobs, estimates, reviews, agreements);

    expect(kpis.totalRevenue).toBe(30000);
    expect(kpis.jobCount).toBe(2);
    expect(kpis.avgJobValue).toBe(15000);
    expect(kpis.closeRate).toBe(66.67);
    expect(kpis.avgRating).toBe(4.5);
    expect(kpis.mrr).toBe(12000);
  });

  it('should handle quarterly billing cycle for MRR', () => {
    const agreements = [
      { status: 'active', price_cents: 30000, billing_cycle: 'quarterly' },
    ];
    const kpis = getKPIs([], [], [], agreements);
    expect(kpis.mrr).toBe(10000); // 30000 / 3
  });

  it('should handle annual billing cycle for MRR', () => {
    const agreements = [
      { status: 'active', price_cents: 120000, billing_cycle: 'annual' },
    ];
    const kpis = getKPIs([], [], [], agreements);
    expect(kpis.mrr).toBe(10000); // 120000 / 12
  });

  it('should only count active agreements for MRR', () => {
    const agreements = [
      { status: 'active', price_cents: 10000, billing_cycle: 'monthly' },
      { status: 'expired', price_cents: 20000, billing_cycle: 'monthly' },
    ];
    const kpis = getKPIs([], [], [], agreements);
    expect(kpis.mrr).toBe(10000);
  });

  it('should return 0 avg rating when no reviews', () => {
    const kpis = getKPIs([], [], [], []);
    expect(kpis.avgRating).toBe(0);
  });

  it('should return 0 avg job value when no completed jobs', () => {
    const kpis = getKPIs([], [], [], []);
    expect(kpis.avgJobValue).toBe(0);
  });

  it('should return 0 close rate when no terminal jobs', () => {
    const kpis = getKPIs([], [], [], []);
    expect(kpis.closeRate).toBe(0);
  });
});
