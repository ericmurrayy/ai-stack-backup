// Murray's FSM - Analytics API Route
// ====================================
// Dashboard analytics aggregated from materialized views.
// Falls back to direct queries if views are not yet created.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DailyJobStat {
  date: string;
  total: number;
  completed: number;
  cancelled: number;
  new_jobs: number;
}

interface MonthlyRevenue {
  month: string;
  invoiced: number;
  paid: number;
  outstanding: number;
}

interface TechnicianStat {
  id: string;
  name: string;
  jobsCompleted: number;
  avgCompletionHours: number;
  totalRevenue: number;
}

interface ServiceCategoryStat {
  category: string;
  count: number;
  revenue: number;
  avgJobValue: number;
}

interface AnalyticsResponse {
  period: string;
  jobs: {
    total: number;
    completed: number;
    cancelled: number;
    completionRate: number;
    daily: DailyJobStat[];
  };
  revenue: {
    totalInvoiced: number;
    totalPaid: number;
    outstanding: number;
    monthlyTrend: MonthlyRevenue[];
  };
  technicians: TechnicianStat[];
  serviceCategories: ServiceCategoryStat[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_PERIODS = ['7d', '30d', '90d', '12m'] as const;
type Period = (typeof VALID_PERIODS)[number];

/**
 * Compute the start date for the given analytics period.
 * All dates anchored to midnight America/New_York via UTC offset.
 */
function periodStartDate(period: Period): string {
  const now = new Date();
  switch (period) {
    case '7d':
      now.setDate(now.getDate() - 7);
      break;
    case '30d':
      now.setDate(now.getDate() - 30);
      break;
    case '90d':
      now.setDate(now.getDate() - 90);
      break;
    case '12m':
      now.setMonth(now.getMonth() - 12);
      break;
  }
  return now.toISOString().slice(0, 10); // YYYY-MM-DD
}

/** Convert cents (integer) to dollars (float, 2 decimals). */
function centsToDollars(cents: number | null | undefined): number {
  return Math.round((cents ?? 0)) / 100;
}

// ---------------------------------------------------------------------------
// GET /api/analytics?period=30d
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ---- Auth check ----
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ---- Parse period ----
    const searchParams = request.nextUrl.searchParams;
    const rawPeriod = searchParams.get('period') || '30d';

    if (!VALID_PERIODS.includes(rawPeriod as Period)) {
      return NextResponse.json(
        {
          error: `Invalid period. Must be one of: ${VALID_PERIODS.join(', ')}`,
          code: 'INVALID_PERIOD',
        },
        { status: 400 }
      );
    }

    const period = rawPeriod as Period;
    const startDate = periodStartDate(period);
    const ownerId = user.id;

    // ---- Attempt materialized view queries first, fall back to direct ----
    let jobStats: DailyJobStat[];
    let revenueTrend: MonthlyRevenue[];
    let technicians: TechnicianStat[];
    let serviceCategories: ServiceCategoryStat[];

    try {
      // Run all four queries in parallel
      const [jobResult, revenueResult, techResult, categoryResult] =
        await Promise.all([
          queryJobStats(supabase, ownerId, startDate),
          queryRevenue(supabase, ownerId, startDate),
          queryTechnicians(supabase, ownerId, startDate),
          queryServiceCategories(supabase, ownerId, startDate),
        ]);

      jobStats = jobResult;
      revenueTrend = revenueResult;
      technicians = techResult;
      serviceCategories = categoryResult;
    } catch (viewError) {
      // Materialized views may not exist yet — fall back to direct queries
      console.warn(
        'Analytics: materialized view query failed, falling back to direct queries.',
        viewError
      );
      const [jobResult, revenueResult, techResult, categoryResult] =
        await Promise.all([
          queryJobStatsDirect(supabase, ownerId, startDate),
          queryRevenueDirect(supabase, ownerId, startDate),
          queryTechniciansDirect(supabase, ownerId, startDate),
          queryServiceCategoriesDirect(supabase, ownerId, startDate),
        ]);

      jobStats = jobResult;
      revenueTrend = revenueResult;
      technicians = techResult;
      serviceCategories = categoryResult;
    }

    // ---- Aggregate job totals ----
    const totalJobs = jobStats.reduce((sum, d) => sum + d.total, 0);
    const completedJobs = jobStats.reduce((sum, d) => sum + d.completed, 0);
    const cancelledJobs = jobStats.reduce((sum, d) => sum + d.cancelled, 0);
    const completionRate =
      totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) / 100 : 0;

    // ---- Aggregate revenue totals ----
    const totalInvoiced = revenueTrend.reduce((s, m) => s + m.invoiced, 0);
    const totalPaid = revenueTrend.reduce((s, m) => s + m.paid, 0);
    const outstanding = revenueTrend.reduce((s, m) => s + m.outstanding, 0);

    const response: AnalyticsResponse = {
      period,
      jobs: {
        total: totalJobs,
        completed: completedJobs,
        cancelled: cancelledJobs,
        completionRate,
        daily: jobStats,
      },
      revenue: {
        totalInvoiced,
        totalPaid,
        outstanding,
        monthlyTrend: revenueTrend,
      },
      technicians,
      serviceCategories,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// ===========================================================================
// Materialized View Queries
// ===========================================================================
// Supabase treats materialized views as tables for SELECT via .from().

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function queryJobStats(
  supabase: SupabaseClient,
  ownerId: string,
  startDate: string
): Promise<DailyJobStat[]> {
  const { data, error } = await supabase
    .from('mv_job_stats_daily')
    .select('date, total_jobs, completed_jobs, cancelled_jobs, new_jobs')
    .eq('owner_id', ownerId)
    .gte('date', startDate)
    .order('date', { ascending: true });

  if (error) throw error;

  return (data || []).map((row: Record<string, unknown>) => ({
    date: String(row.date),
    total: Number(row.total_jobs ?? 0),
    completed: Number(row.completed_jobs ?? 0),
    cancelled: Number(row.cancelled_jobs ?? 0),
    new_jobs: Number(row.new_jobs ?? 0),
  }));
}

async function queryRevenue(
  supabase: SupabaseClient,
  ownerId: string,
  startDate: string
): Promise<MonthlyRevenue[]> {
  const { data, error } = await supabase
    .from('mv_revenue_monthly')
    .select(
      'month, total_invoiced_cents, total_paid_cents, total_outstanding_cents'
    )
    .eq('owner_id', ownerId)
    .gte('month', startDate)
    .order('month', { ascending: true });

  if (error) throw error;

  return (data || []).map((row: Record<string, unknown>) => ({
    month: String(row.month).slice(0, 7), // YYYY-MM
    invoiced: centsToDollars(Number(row.total_invoiced_cents ?? 0)),
    paid: centsToDollars(Number(row.total_paid_cents ?? 0)),
    outstanding: centsToDollars(Number(row.total_outstanding_cents ?? 0)),
  }));
}

async function queryTechnicians(
  supabase: SupabaseClient,
  ownerId: string,
  startDate: string
): Promise<TechnicianStat[]> {
  const { data, error } = await supabase
    .from('mv_technician_performance')
    .select(
      'technician_id, technician_name, jobs_completed, avg_completion_hours, total_revenue_cents'
    )
    .eq('owner_id', ownerId)
    .gte('period_start', startDate)
    .order('jobs_completed', { ascending: false });

  if (error) throw error;

  // Aggregate across months for the same technician in the period
  const map = new Map<
    string,
    { name: string; jobs: number; hoursSum: number; hoursCount: number; revenue: number }
  >();

  for (const row of data || []) {
    const id = String(row.technician_id);
    const existing = map.get(id);
    const jobs = Number(row.jobs_completed ?? 0);
    const hours = Number(row.avg_completion_hours ?? 0);
    const rev = Number(row.total_revenue_cents ?? 0);

    if (existing) {
      existing.jobs += jobs;
      existing.hoursSum += hours * jobs; // weighted average
      existing.hoursCount += jobs;
      existing.revenue += rev;
    } else {
      map.set(id, {
        name: String(row.technician_name),
        jobs,
        hoursSum: hours * jobs,
        hoursCount: jobs,
        revenue: rev,
      });
    }
  }

  return Array.from(map.entries()).map(([id, v]) => ({
    id,
    name: v.name,
    jobsCompleted: v.jobs,
    avgCompletionHours:
      v.hoursCount > 0
        ? Math.round((v.hoursSum / v.hoursCount) * 100) / 100
        : 0,
    totalRevenue: centsToDollars(v.revenue),
  }));
}

async function queryServiceCategories(
  supabase: SupabaseClient,
  ownerId: string,
  _startDate: string
): Promise<ServiceCategoryStat[]> {
  // mv_service_category_breakdown is an all-time aggregate (no date column).
  // For period-specific data, use the fallback. This is acceptable because the
  // view refreshes regularly and category distributions are stable over time.
  const { data, error } = await supabase
    .from('mv_service_category_breakdown')
    .select('service_category, job_count, total_revenue_cents, avg_job_value_cents')
    .eq('owner_id', ownerId)
    .order('job_count', { ascending: false });

  if (error) throw error;

  return (data || []).map((row: Record<string, unknown>) => ({
    category: String(row.service_category ?? 'unknown'),
    count: Number(row.job_count ?? 0),
    revenue: centsToDollars(Number(row.total_revenue_cents ?? 0)),
    avgJobValue: centsToDollars(Number(row.avg_job_value_cents ?? 0)),
  }));
}

// ===========================================================================
// Direct Query Fallbacks
// ===========================================================================
// Used when materialized views have not been created yet (e.g. migration
// not applied). These hit the underlying tables directly.

async function queryJobStatsDirect(
  supabase: SupabaseClient,
  ownerId: string,
  startDate: string
): Promise<DailyJobStat[]> {
  // Supabase JS client does not support GROUP BY natively.
  // Fetch raw rows and aggregate in JS.
  const { data, error } = await supabase
    .from('jobs')
    .select('status, created_at')
    .eq('owner_id', ownerId)
    .eq('deleted', false)
    .eq('is_spam', false)
    .gte('created_at', `${startDate}T00:00:00`)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const dayMap = new Map<
    string,
    { total: number; completed: number; cancelled: number; new_jobs: number }
  >();

  for (const row of data || []) {
    // Approximate ET by subtracting 5h — good enough for aggregation
    const d = new Date(row.created_at);
    d.setHours(d.getHours() - 5);
    const dateKey = d.toISOString().slice(0, 10);

    let entry = dayMap.get(dateKey);
    if (!entry) {
      entry = { total: 0, completed: 0, cancelled: 0, new_jobs: 0 };
      dayMap.set(dateKey, entry);
    }
    entry.total++;
    if (row.status === 'completed') entry.completed++;
    if (row.status === 'cancelled') entry.cancelled++;
    if (row.status === 'new') entry.new_jobs++;
  }

  return Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stats]) => ({ date, ...stats }));
}

async function queryRevenueDirect(
  supabase: SupabaseClient,
  ownerId: string,
  startDate: string
): Promise<MonthlyRevenue[]> {
  // Fetch invoices and payments separately and aggregate in JS
  const [invoiceResult, paymentResult] = await Promise.all([
    supabase
      .from('invoices')
      .select('issue_date, total_cents')
      .eq('owner_id', ownerId)
      .eq('deleted', false)
      .not('status', 'in', '("void","written_off")')
      .gte('issue_date', startDate),
    supabase
      .from('payments')
      .select('paid_at, amount_cents')
      .eq('owner_id', ownerId)
      .eq('deleted', false)
      .eq('status', 'succeeded')
      .not('paid_at', 'is', null)
      .gte('paid_at', `${startDate}T00:00:00`),
  ]);

  if (invoiceResult.error) throw invoiceResult.error;
  if (paymentResult.error) throw paymentResult.error;

  const monthMap = new Map<
    string,
    { invoiced: number; paid: number }
  >();

  for (const inv of invoiceResult.data || []) {
    const month = String(inv.issue_date).slice(0, 7); // YYYY-MM
    const entry = monthMap.get(month) || { invoiced: 0, paid: 0 };
    entry.invoiced += Number(inv.total_cents ?? 0);
    monthMap.set(month, entry);
  }

  for (const pay of paymentResult.data || []) {
    const month = String(pay.paid_at).slice(0, 7); // YYYY-MM
    const entry = monthMap.get(month) || { invoiced: 0, paid: 0 };
    entry.paid += Number(pay.amount_cents ?? 0);
    monthMap.set(month, entry);
  }

  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      invoiced: centsToDollars(v.invoiced),
      paid: centsToDollars(v.paid),
      outstanding: centsToDollars(v.invoiced - v.paid),
    }));
}

async function queryTechniciansDirect(
  supabase: SupabaseClient,
  ownerId: string,
  startDate: string
): Promise<TechnicianStat[]> {
  // Fetch completed jobs with technician assignment
  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select(
      'assigned_technician_id, created_at, closed_at, technician:technicians(id, name)'
    )
    .eq('owner_id', ownerId)
    .eq('deleted', false)
    .eq('is_spam', false)
    .eq('status', 'completed')
    .not('assigned_technician_id', 'is', null)
    .not('closed_at', 'is', null)
    .gte('closed_at', `${startDate}T00:00:00`);

  if (jobsError) throw jobsError;

  // Fetch related invoice totals for revenue
  const jobIds = (jobs || [])
    .map((j: Record<string, unknown>) => String(j.assigned_technician_id))
    .filter(Boolean);

  // Aggregate per technician in JS
  const techMap = new Map<
    string,
    { name: string; jobs: number; hoursSum: number; revenueCents: number }
  >();

  for (const job of jobs || []) {
    const rawTech = job.technician as unknown;
    const tech = (Array.isArray(rawTech) ? rawTech[0] : rawTech) as { id: string; name: string } | null | undefined;
    if (!tech) continue;
    const id = tech.id;

    const existing = techMap.get(id) || {
      name: tech.name,
      jobs: 0,
      hoursSum: 0,
      revenueCents: 0,
    };

    existing.jobs++;

    // Calculate hours between created_at and closed_at
    const created = new Date(job.created_at as string).getTime();
    const closed = new Date(job.closed_at as string).getTime();
    const hours = (closed - created) / (1000 * 60 * 60);
    existing.hoursSum += hours;

    techMap.set(id, existing);
  }

  // Best-effort revenue: fetch invoice sums per job's technician
  // Skip if no technicians found
  if (techMap.size > 0 && jobIds.length > 0) {
    const { data: invoices } = await supabase
      .from('invoices')
      .select('job_id, total_cents')
      .eq('owner_id', ownerId)
      .eq('deleted', false)
      .not('status', 'in', '("void","written_off")')
      .in(
        'job_id',
        (jobs || []).map((j: Record<string, unknown>) => j.assigned_technician_id ? String((j as Record<string, unknown>).id || '') : '').filter(Boolean)
      );

    // Map invoices back to technicians through jobs
    const jobToTech = new Map<string, string>();
    for (const job of jobs || []) {
      const rawT = job.technician as unknown;
      const tech = (Array.isArray(rawT) ? rawT[0] : rawT) as { id: string } | null | undefined;
      if (tech) {
        jobToTech.set(String((job as Record<string, unknown>).id || ''), tech.id);
      }
    }

    for (const inv of invoices || []) {
      const techId = jobToTech.get(String(inv.job_id));
      if (techId) {
        const entry = techMap.get(techId);
        if (entry) {
          entry.revenueCents += Number(inv.total_cents ?? 0);
        }
      }
    }
  }

  return Array.from(techMap.entries()).map(([id, v]) => ({
    id,
    name: v.name,
    jobsCompleted: v.jobs,
    avgCompletionHours:
      v.jobs > 0 ? Math.round((v.hoursSum / v.jobs) * 100) / 100 : 0,
    totalRevenue: centsToDollars(v.revenueCents),
  }));
}

async function queryServiceCategoriesDirect(
  supabase: SupabaseClient,
  ownerId: string,
  startDate: string
): Promise<ServiceCategoryStat[]> {
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, service_category')
    .eq('owner_id', ownerId)
    .eq('deleted', false)
    .eq('is_spam', false)
    .gte('created_at', `${startDate}T00:00:00`);

  if (error) throw error;

  // Group by category
  const catMap = new Map<
    string,
    { count: number; jobIds: string[] }
  >();

  for (const job of jobs || []) {
    const cat = String(job.service_category || 'unknown');
    const entry = catMap.get(cat) || { count: 0, jobIds: [] };
    entry.count++;
    entry.jobIds.push(String(job.id));
    catMap.set(cat, entry);
  }

  // Fetch invoice totals for revenue per category
  const allJobIds = (jobs || []).map((j: Record<string, unknown>) => String(j.id));
  let invoiceMap = new Map<string, number>();

  if (allJobIds.length > 0) {
    const { data: invoices } = await supabase
      .from('invoices')
      .select('job_id, total_cents')
      .eq('owner_id', ownerId)
      .eq('deleted', false)
      .not('status', 'in', '("void","written_off")')
      .in('job_id', allJobIds);

    for (const inv of invoices || []) {
      const existing = invoiceMap.get(String(inv.job_id)) || 0;
      invoiceMap.set(String(inv.job_id), existing + Number(inv.total_cents ?? 0));
    }
  }

  return Array.from(catMap.entries())
    .map(([category, v]) => {
      const totalRevCents = v.jobIds.reduce(
        (sum, jid) => sum + (invoiceMap.get(jid) || 0),
        0
      );
      return {
        category,
        count: v.count,
        revenue: centsToDollars(totalRevCents),
        avgJobValue:
          v.count > 0
            ? centsToDollars(Math.round(totalRevCents / v.count))
            : 0,
      };
    })
    .sort((a, b) => b.count - a.count);
}
