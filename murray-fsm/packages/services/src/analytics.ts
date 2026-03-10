// Murray's FSM - Analytics Service
// ==================================
// Revenue trends, job profitability, customer LTV, KPI calculations,
// closing rates, revenue by service type, and job trend analysis

import { parseISO, format, subMonths, startOfMonth, isBefore, isAfter } from 'date-fns';

// ============================================================================
// Types
// ============================================================================

interface AnalyticsJob {
  id: string;
  status: string;
  service_category?: string;
  created_at: string;
  completed_at?: string | null;
  closed_at?: string | null;
  total_cents?: number;
}

interface AnalyticsEstimate {
  id: string;
  status: string;
  total_cents: number;
  created_at: string;
}

interface AnalyticsReview {
  rating: number;
}

interface AnalyticsAgreement {
  status: string;
  price_cents: number;
  billing_cycle: string;
}

interface AnalyticsLineItem {
  quantity: number;
  unit_price_cents: number;
}

interface AnalyticsTimeEntry {
  started_at: string;
  ended_at?: string | null;
  entry_type?: string;
}

interface AnalyticsCustomer {
  id: string;
}

interface RevenueTrendPoint {
  month: string;
  revenue: number;
}

interface JobProfitability {
  revenue: number;
  materialCost: number;
  laborCost: number;
  profit: number;
  margin: number;
}

interface DashboardKPIs {
  totalRevenue: number;
  jobCount: number;
  avgJobValue: number;
  closeRate: number;
  avgRating: number;
  mrr: number;
}

interface JobTrendPoint {
  month: string;
  count: number;
}

// ============================================================================
// Revenue Trend
// ============================================================================

/**
 * Calculate monthly revenue trend from completed jobs over the last N months.
 *
 * Groups job revenue by month using the closed_at date. Returns one entry
 * per month, sorted chronologically, with zero-filled months where no
 * revenue was recorded.
 *
 * @param jobs - Array of jobs with total_cents and closed_at
 * @param periodMonths - Number of months to look back (default: 6)
 * @returns Array of { month, revenue } sorted chronologically
 */
export function calculateRevenueTrend(
  jobs: AnalyticsJob[],
  periodMonths: number = 6
): RevenueTrendPoint[] {
  const now = new Date();
  const buckets = new Map<string, number>();

  // Initialize month buckets
  for (let i = periodMonths - 1; i >= 0; i--) {
    const monthDate = startOfMonth(subMonths(now, i));
    const key = format(monthDate, 'yyyy-MM');
    buckets.set(key, 0);
  }

  // Aggregate revenue into buckets
  const cutoff = startOfMonth(subMonths(now, periodMonths));

  for (const job of jobs) {
    if (!job.closed_at || !job.total_cents) continue;
    if (job.status !== 'completed') continue;

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
 * Revenue comes from the job total. Costs are calculated from line items
 * (material cost) and time entries multiplied by the technician's hourly
 * rate (labor cost). Breaks are excluded from labor calculation.
 *
 * @param job - Job with total_cents
 * @param lineItems - Line items for material costs
 * @param timeEntries - Time entries for labor cost
 * @param techHourlyRate - Hourly rate in cents for the technician
 * @returns Revenue, material cost, labor cost, profit (cents), and margin %
 */
export function calculateJobProfitability(
  job: { total_cents?: number },
  lineItems: AnalyticsLineItem[],
  timeEntries: AnalyticsTimeEntry[],
  techHourlyRate: number
): JobProfitability {
  const revenue = job.total_cents || 0;

  // Material cost from line items
  const materialCost = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unit_price_cents,
    0
  );

  // Labor cost from time entries (exclude breaks)
  const totalMinutes = timeEntries.reduce((sum, entry) => {
    if (!entry.ended_at) return sum;
    if (entry.entry_type === 'break') return sum;

    const started = parseISO(entry.started_at);
    const ended = parseISO(entry.ended_at);
    const minutes = Math.max(0, (ended.getTime() - started.getTime()) / 60000);
    return sum + minutes;
  }, 0);

  const laborCost = Math.round((totalMinutes / 60) * techHourlyRate);
  const totalCost = materialCost + laborCost;
  const profit = revenue - totalCost;
  const margin = revenue > 0 ? Math.round((profit / revenue) * 10000) / 100 : 0;

  return { revenue, materialCost, laborCost, profit, margin };
}

// ============================================================================
// Customer Lifetime Value
// ============================================================================

/**
 * Calculate lifetime value for a single customer based on completed job
 * revenue.
 *
 * @param customer - Customer object with id
 * @param jobs - Array of jobs (should be pre-filtered to this customer's jobs)
 * @returns Total lifetime value in cents
 */
export function calculateCustomerLTV(
  customer: AnalyticsCustomer,
  jobs: AnalyticsJob[]
): number {
  return jobs
    .filter((job) => job.status === 'completed' && job.total_cents)
    .reduce((sum, job) => sum + (job.total_cents || 0), 0);
}

// ============================================================================
// Closing Rate
// ============================================================================

/**
 * Calculate the closing rate: completed jobs / (completed + cancelled).
 *
 * Only jobs with a terminal status (completed or cancelled) are considered.
 * Jobs still in progress or scheduled are excluded from the calculation.
 *
 * @param jobs - Array of jobs with status
 * @returns Closing rate as a percentage (0-100)
 */
export function calculateClosingRate(jobs: AnalyticsJob[]): number {
  const completed = jobs.filter((j) => j.status === 'completed').length;
  const cancelled = jobs.filter((j) => j.status === 'cancelled').length;
  const total = completed + cancelled;

  if (total === 0) return 0;

  return Math.round((completed / total) * 10000) / 100;
}

// ============================================================================
// Revenue by Service Type
// ============================================================================

/**
 * Group revenue by service category from completed jobs.
 *
 * @param jobs - Array of jobs with service_category and total_cents
 * @returns Record mapping service_category to total revenue in cents
 */
export function getRevenueByServiceType(
  jobs: AnalyticsJob[]
): Record<string, number> {
  const revenueByType: Record<string, number> = {};

  for (const job of jobs) {
    if (job.status !== 'completed' || !job.total_cents) continue;

    const category = job.service_category || 'uncategorized';
    revenueByType[category] = (revenueByType[category] || 0) + job.total_cents;
  }

  return revenueByType;
}

// ============================================================================
// Job Trends
// ============================================================================

/**
 * Count jobs per month for trend charts.
 *
 * Groups all jobs (regardless of status) by created_at month. Returns
 * zero-filled entries for months with no jobs.
 *
 * @param jobs - Array of jobs with created_at
 * @param months - Number of months to look back (default: 6)
 * @returns Array of { month, count } sorted chronologically
 */
export function getJobTrends(
  jobs: AnalyticsJob[],
  months: number = 6
): JobTrendPoint[] {
  const now = new Date();
  const buckets = new Map<string, number>();

  // Initialize month buckets
  for (let i = months - 1; i >= 0; i--) {
    const monthDate = startOfMonth(subMonths(now, i));
    const key = format(monthDate, 'yyyy-MM');
    buckets.set(key, 0);
  }

  // Count jobs per month
  const cutoff = startOfMonth(subMonths(now, months));

  for (const job of jobs) {
    if (!job.created_at) continue;

    const createdDate = parseISO(job.created_at);
    if (isBefore(createdDate, cutoff)) continue;

    const key = format(createdDate, 'yyyy-MM');
    if (buckets.has(key)) {
      buckets.set(key, buckets.get(key)! + 1);
    }
  }

  return Array.from(buckets.entries()).map(([month, count]) => ({
    month,
    count,
  }));
}

// ============================================================================
// Dashboard KPIs
// ============================================================================

/**
 * Calculate key performance indicators for the analytics dashboard.
 *
 * Aggregates data from jobs, estimates, reviews, and agreements into a
 * single KPI summary suitable for dashboard display.
 *
 * @param jobs - All jobs
 * @param estimates - All estimates
 * @param reviews - All reviews
 * @param agreements - All service agreements
 * @returns Dashboard KPIs: totalRevenue, jobCount, avgJobValue,
 *          closeRate, avgRating, mrr
 */
export function getKPIs(
  jobs: AnalyticsJob[],
  estimates: AnalyticsEstimate[],
  reviews: AnalyticsReview[],
  agreements: AnalyticsAgreement[]
): DashboardKPIs {
  // Total revenue from completed jobs
  const completedJobs = jobs.filter((j) => j.status === 'completed');
  const totalRevenue = completedJobs.reduce(
    (sum, j) => sum + (j.total_cents || 0),
    0
  );

  // Job count
  const jobCount = completedJobs.length;

  // Average job value
  const avgJobValue = jobCount > 0 ? Math.round(totalRevenue / jobCount) : 0;

  // Close rate
  const closeRate = calculateClosingRate(jobs);

  // Average rating
  const avgRating =
    reviews.length > 0
      ? Math.round(
          (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10
        ) / 10
      : 0;

  // Monthly Recurring Revenue from active agreements
  const mrr = agreements
    .filter((a) => a.status === 'active')
    .reduce((sum, a) => {
      switch (a.billing_cycle) {
        case 'monthly':
          return sum + a.price_cents;
        case 'quarterly':
          return sum + Math.round(a.price_cents / 3);
        case 'annual':
          return sum + Math.round(a.price_cents / 12);
        default:
          return sum + a.price_cents;
      }
    }, 0);

  return {
    totalRevenue,
    jobCount,
    avgJobValue,
    closeRate,
    avgRating,
    mrr,
  };
}
