// Murray's FSM - Analytics Service
// ==================================
// Revenue trends, job profitability, customer LTV, and KPI calculations

import type { Lead, Review, TimeEntry } from '@murray-fsm/shared';
import { parseISO, format, subMonths, startOfMonth, isAfter, isBefore } from 'date-fns';

// ============================================================================
// Revenue Trend
// ============================================================================

/**
 * Calculate monthly revenue trend from completed jobs.
 *
 * @param jobs - Array of jobs with total_cents and closed_at
 * @param months - Number of months to look back (default: 6)
 * @returns Array of { month, revenue } sorted chronologically
 */
export function calculateRevenueTrend(
  jobs: Array<{ total_cents?: number; closed_at?: string | null }>,
  months: number = 6
): Array<{ month: string; revenue: number }> {
  const now = new Date();
  const buckets = new Map<string, number>();

  // Initialize month buckets
  for (let i = months - 1; i >= 0; i--) {
    const monthDate = startOfMonth(subMonths(now, i));
    const key = format(monthDate, 'yyyy-MM');
    buckets.set(key, 0);
  }

  // Aggregate revenue into buckets
  const cutoff = startOfMonth(subMonths(now, months));

  for (const job of jobs) {
    if (!job.closed_at || !job.total_cents) continue;

    const closedDate = parseISO(job.closed_at);
    if (isBefore(closedDate, cutoff)) continue;

    const key = format(closedDate, 'yyyy-MM');
    if (buckets.has(key)) {
      buckets.set(key, buckets.get(key)! + job.total_cents);
    }
  }

  return Array.from(buckets.entries()).map(([month, revenue]) => ({
    month,
    revenue,
  }));
}

// ============================================================================
// Job Profitability
// ============================================================================

/**
 * Calculate the profitability of a single job.
 *
 * @param job - Job with total_cents
 * @param laborEntries - Time entries associated with the job
 * @param hourlyRate - Hourly labor rate in cents
 * @returns Revenue, labor cost, profit (all in cents), and margin percentage
 */
export function calculateJobProfitability(
  job: { total_cents?: number },
  laborEntries: TimeEntry[],
  hourlyRate: number
): { revenue: number; laborCost: number; profit: number; margin: number } {
  const revenue = job.total_cents || 0;

  const totalMinutes = laborEntries.reduce((sum, entry) => {
    if (!entry.ended_at) return sum;
    if (entry.entry_type === 'break') return sum;

    const started = parseISO(entry.started_at);
    const ended = parseISO(entry.ended_at);
    const minutes = Math.max(
      0,
      (ended.getTime() - started.getTime()) / 60000
    );
    return sum + minutes;
  }, 0);

  const laborCost = Math.round((totalMinutes / 60) * hourlyRate);
  const profit = revenue - laborCost;
  const margin = revenue > 0 ? Math.round((profit / revenue) * 10000) / 100 : 0;

  return { revenue, laborCost, profit, margin };
}

// ============================================================================
// Customer Lifetime Value
// ============================================================================

/**
 * Calculate lifetime value (LTV) per customer based on completed job revenue.
 *
 * @param jobs - Array of jobs with customer_id and total_cents
 * @returns Map of customer_id to total revenue in cents
 */
export function calculateCustomerLTV(
  jobs: Array<{ customer_id?: string; total_cents?: number }>
): Map<string, number> {
  const ltv = new Map<string, number>();

  for (const job of jobs) {
    if (!job.customer_id || !job.total_cents) continue;

    const current = ltv.get(job.customer_id) || 0;
    ltv.set(job.customer_id, current + job.total_cents);
  }

  return ltv;
}

// ============================================================================
// Dashboard KPIs
// ============================================================================

/**
 * Calculate key performance indicators for the dashboard.
 *
 * @returns totalRevenue (cents), avgJobValue (cents), completionRate (%),
 *          avgRating (1-5), conversionRate (%)
 */
export function getKPIs(params: {
  jobs: Array<{ status?: string; total_cents?: number; closed_at?: string | null }>;
  reviews: Review[];
  leads: Lead[];
}): {
  totalRevenue: number;
  avgJobValue: number;
  completionRate: number;
  avgRating: number;
  conversionRate: number;
} {
  const { jobs, reviews, leads } = params;

  // Total revenue from completed jobs
  const completedJobs = jobs.filter((j) => j.status === 'completed');
  const totalRevenue = completedJobs.reduce(
    (sum, j) => sum + (j.total_cents || 0),
    0
  );

  // Average job value
  const avgJobValue =
    completedJobs.length > 0
      ? Math.round(totalRevenue / completedJobs.length)
      : 0;

  // Completion rate
  const completionRate =
    jobs.length > 0
      ? Math.round((completedJobs.length / jobs.length) * 1000) / 10
      : 0;

  // Average rating
  const avgRating =
    reviews.length > 0
      ? Math.round(
          (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10
        ) / 10
      : 0;

  // Lead conversion rate (won leads / total leads)
  const wonLeads = leads.filter((l) => l.won_at != null);
  const conversionRate =
    leads.length > 0
      ? Math.round((wonLeads.length / leads.length) * 1000) / 10
      : 0;

  return {
    totalRevenue,
    avgJobValue,
    completionRate,
    avgRating,
    conversionRate,
  };
}
