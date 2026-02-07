/**
 * Profit & Loss API
 * =================
 * Financial reporting endpoint for Murray's FSM
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'nodejs';

// Validation schema
const ProfitQuerySchema = z.object({
  period: z.enum(['month', 'quarter', 'year']).default('month'),
});

// Empty response structure
function getEmptyProfitData(periodLabel: string) {
  return {
    summary: {
      period: periodLabel,
      revenue: 0,
      expenses: 0,
      laborCost: 0,
      materialsCost: 0,
      overhead: 0,
      netProfit: 0,
      profitMargin: 0,
      jobsCompleted: 0,
      avgJobProfit: 0,
    },
    categoryBreakdown: [],
    trend: [],
  };
}

/**
 * GET /api/profit
 * Get profit/loss summary data
 */
export async function GET(req: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);

  // Validate query parameters
  const queryResult = ProfitQuerySchema.safeParse({
    period: searchParams.get('period') || 'month',
  });

  if (!queryResult.success) {
    return NextResponse.json(
      { error: 'Invalid parameters', details: queryResult.error.flatten() },
      { status: 400 }
    );
  }

  const { period } = queryResult.data;

  // Calculate date range based on period
  const now = new Date();
  let startDate: Date;
  let periodLabel: string;

  switch (period) {
    case 'quarter':
      startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      periodLabel = `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`;
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      periodLabel = `${now.getFullYear()}`;
      break;
    case 'month':
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      periodLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' });
      break;
  }

  try {
    // Fetch all relevant data in parallel
    const [jobsResult, paymentsResult, timeEntriesResult, jobPartsResult] = await Promise.all([
      // Completed jobs this period
      supabase
        .from('jobs')
        .select('id, service_type, total_invoice_cents, total_estimate_cents, paid_cents, completed_at')
        .eq('status', 'completed')
        .eq('deleted', false)
        .gte('completed_at', startDate.toISOString()),

      // Payments received this period
      supabase
        .from('payments')
        .select('amount_cents, created_at')
        .eq('status', 'succeeded')
        .eq('deleted', false)
        .gte('created_at', startDate.toISOString()),

      // Time entries for labor cost calculation
      supabase
        .from('time_entries')
        .select('total_minutes, team_member_id, team_members(hourly_rate_cents)')
        .eq('deleted', false)
        .gte('clock_in', startDate.toISOString()),

      // Parts used for materials cost
      supabase
        .from('job_parts')
        .select('total_cost_cents, job_id, jobs(completed_at)')
        .eq('deleted', false),
    ]);

    // Process jobs data
    const jobs = jobsResult.data || [];
    const jobsCompleted = jobs.length;

    // Calculate revenue from payments
    const payments = paymentsResult.data || [];
    const totalRevenue = payments.reduce((sum, p) => sum + (p.amount_cents || 0), 0) / 100;

    // Calculate labor cost from time entries
    const timeEntries = timeEntriesResult.data || [];
    const laborCost = timeEntries.reduce((sum, te) => {
      const minutes = te.total_minutes || 0;
      const hourlyRate = (te.team_members as any)?.hourly_rate_cents || 0;
      return sum + ((minutes / 60) * (hourlyRate / 100));
    }, 0);

    // Calculate materials cost from job parts (only for jobs in this period)
    const jobParts = jobPartsResult.data || [];
    const jobIds = new Set(jobs.map(j => j.id));
    const materialsCost = jobParts
      .filter(jp => {
        const jobCompletedAt = (jp.jobs as any)?.completed_at;
        return jobCompletedAt && new Date(jobCompletedAt) >= startDate;
      })
      .reduce((sum, jp) => sum + ((jp.total_cost_cents || 0) / 100), 0);

    // Estimate overhead as 15% of revenue (typical for service businesses)
    // In production, this should come from actual expense tracking
    const overhead = totalRevenue * 0.15;

    // Calculate totals
    const totalExpenses = laborCost + materialsCost + overhead;
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    const avgJobProfit = jobsCompleted > 0 ? netProfit / jobsCompleted : 0;

    // Category breakdown
    const categoryStats: Record<string, { revenue: number; jobs: number }> = {};
    jobs.forEach(job => {
      const cat = job.service_type || 'General';
      if (!categoryStats[cat]) {
        categoryStats[cat] = { revenue: 0, jobs: 0 };
      }
      categoryStats[cat].revenue += (job.paid_cents || job.total_invoice_cents || 0) / 100;
      categoryStats[cat].jobs += 1;
    });

    // Calculate costs per category proportionally
    const categoryBreakdown = Object.entries(categoryStats).map(([category, data]) => {
      const revenuePercent = totalRevenue > 0 ? data.revenue / totalRevenue : 0;
      const estimatedCost = totalExpenses * revenuePercent;
      const profit = data.revenue - estimatedCost;
      const margin = data.revenue > 0 ? (profit / data.revenue) * 100 : 0;

      return {
        category,
        revenue: Math.round(data.revenue * 100) / 100,
        cost: Math.round(estimatedCost * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        margin: Math.round(margin),
        jobs: data.jobs,
      };
    }).sort((a, b) => b.profit - a.profit);

    // Generate 6-month trend data
    const trendData = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

      // Get payments for this month
      const { data: monthPayments } = await supabase
        .from('payments')
        .select('amount_cents')
        .eq('status', 'succeeded')
        .eq('deleted', false)
        .gte('created_at', monthDate.toISOString())
        .lt('created_at', monthEnd.toISOString());

      // Get time entries for this month
      const { data: monthTimeEntries } = await supabase
        .from('time_entries')
        .select('total_minutes, team_members(hourly_rate_cents)')
        .eq('deleted', false)
        .gte('clock_in', monthDate.toISOString())
        .lt('clock_in', monthEnd.toISOString());

      const monthRevenue = (monthPayments || []).reduce((sum, p) => sum + (p.amount_cents || 0), 0) / 100;
      const monthLabor = (monthTimeEntries || []).reduce((sum, te) => {
        const minutes = te.total_minutes || 0;
        const hourlyRate = (te.team_members as any)?.hourly_rate_cents || 0;
        return sum + ((minutes / 60) * (hourlyRate / 100));
      }, 0);
      const monthOverhead = monthRevenue * 0.15;
      const monthExpenses = monthLabor + monthOverhead;

      trendData.push({
        month: monthDate.toLocaleString('default', { month: 'short' }),
        revenue: Math.round(monthRevenue * 100) / 100,
        expenses: Math.round(monthExpenses * 100) / 100,
        profit: Math.round((monthRevenue - monthExpenses) * 100) / 100,
      });
    }

    return NextResponse.json({
      summary: {
        period: periodLabel,
        revenue: Math.round(totalRevenue * 100) / 100,
        expenses: Math.round(totalExpenses * 100) / 100,
        laborCost: Math.round(laborCost * 100) / 100,
        materialsCost: Math.round(materialsCost * 100) / 100,
        overhead: Math.round(overhead * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        profitMargin: Math.round(profitMargin * 10) / 10,
        jobsCompleted,
        avgJobProfit: Math.round(avgJobProfit * 100) / 100,
      },
      categoryBreakdown,
      trend: trendData,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Profit API] Error:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to fetch profit data', message: errorMessage },
      { status: 500 }
    );
  }
}
