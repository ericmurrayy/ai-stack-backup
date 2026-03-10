// Murray's FSM - Analytics Dashboard
// ===================================
// Comprehensive business intelligence dashboard

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCents } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Briefcase,
  Users,
  Star,
  Clock,
  Phone,
  MessageSquare,
  Target,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  FileText,
  Wrench,
  ShieldCheck,
  Activity,
  CalendarCheck,
  AlertTriangle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

interface MetricCardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}

function MetricCard({ title, value, change, changeLabel, icon, trend }: MetricCardProps) {
  const trendColor =
    trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-slate-500';
  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : null;

  return (
    <Card padding="none" className="p-4">
      <div className="flex items-start justify-between">
        <div className="p-2 rounded-lg bg-blue-50">{icon}</div>
        {change !== undefined && (
          <div className={`flex items-center gap-0.5 text-sm font-medium ${trendColor}`}>
            {TrendIcon && <TrendIcon className="w-4 h-4" />}
            {change > 0 ? '+' : ''}
            {change}%
          </div>
        )}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        <div className="text-sm text-slate-500">{title}</div>
        {changeLabel && <div className="text-xs text-slate-400 mt-1">{changeLabel}</div>}
      </div>
    </Card>
  );
}

function ProgressBar({
  value,
  max,
  label,
  color = 'bg-blue-600',
}: {
  value: number;
  max: number;
  label: string;
  color?: string;
}) {
  const percent = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-900">{value}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}

function SectionHeading({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
      {icon}
      {children}
    </h3>
  );
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getAnalyticsData() {
  const supabase = createClient();

  // Date boundaries -------------------------------------------------------
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  const startOfMonthISO = startOfMonth.toISOString();
  const startOfLastMonthISO = startOfLastMonth.toISOString();
  const endOfLastMonthISO = endOfLastMonth.toISOString();

  // -----------------------------------------------------------------------
  // 1. Jobs (NO deleted column -- filter spam out with is_spam = false)
  // -----------------------------------------------------------------------
  const { data: thisMonthJobs } = await supabase
    .from('jobs')
    .select('id, status, service_category, urgency, assigned_technician_id, created_at')
    .gte('created_at', startOfMonthISO)
    .eq('is_spam', false);

  const { data: lastMonthJobs } = await supabase
    .from('jobs')
    .select('id, status, created_at')
    .gte('created_at', startOfLastMonthISO)
    .lte('created_at', endOfLastMonthISO)
    .eq('is_spam', false);

  const { data: allJobs } = await supabase
    .from('jobs')
    .select('id, assigned_technician_id, status')
    .eq('is_spam', false);

  // -----------------------------------------------------------------------
  // 2. Estimates (has deleted column)
  // -----------------------------------------------------------------------
  const { data: allEstimates } = await supabase
    .from('estimates')
    .select('id, status, total_cents, created_at, approved_at')
    .eq('deleted', false);

  const thisMonthApproved =
    allEstimates?.filter(
      (e) =>
        e.status === 'approved' &&
        e.approved_at &&
        new Date(e.approved_at) >= startOfMonth
    ) ?? [];

  const lastMonthApproved =
    allEstimates?.filter(
      (e) =>
        e.status === 'approved' &&
        e.approved_at &&
        new Date(e.approved_at) >= startOfLastMonth &&
        new Date(e.approved_at) <= endOfLastMonth
    ) ?? [];

  const thisMonthRevenue = thisMonthApproved.reduce((s, e) => s + (e.total_cents ?? 0), 0);
  const lastMonthRevenue = lastMonthApproved.reduce((s, e) => s + (e.total_cents ?? 0), 0);
  const revenueChange =
    lastMonthRevenue > 0
      ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : 0;

  const totalEstimates = allEstimates?.length ?? 0;
  const approvedEstimates = allEstimates?.filter((e) => e.status === 'approved').length ?? 0;
  const estimateConversionRate =
    totalEstimates > 0 ? Math.round((approvedEstimates / totalEstimates) * 100) : 0;

  // Estimate status breakdown
  const estimateStatuses: Record<string, number> = {};
  for (const e of allEstimates ?? []) {
    estimateStatuses[e.status] = (estimateStatuses[e.status] ?? 0) + 1;
  }

  // -----------------------------------------------------------------------
  // 3. Leads & pipeline stages (both have deleted column)
  // -----------------------------------------------------------------------
  const { data: leads } = await supabase
    .from('leads')
    .select('id, estimated_value_cents, probability, stage_id, created_at')
    .eq('deleted', false);

  const { data: pipelineStages } = await supabase
    .from('pipeline_stages')
    .select('id, name, color, sort_order, is_won, is_lost')
    .eq('deleted', false)
    .order('sort_order', { ascending: true });

  const totalPipelineValue = leads?.reduce((s, l) => s + (l.estimated_value_cents ?? 0), 0) ?? 0;
  const weightedPipeline =
    leads?.reduce(
      (s, l) => s + (l.estimated_value_cents ?? 0) * ((l.probability ?? 0) / 100),
      0
    ) ?? 0;

  // Value by stage
  const valueByStage: { name: string; color: string; value: number; count: number }[] = [];
  for (const stage of pipelineStages ?? []) {
    const stageLeads = leads?.filter((l) => l.stage_id === stage.id) ?? [];
    valueByStage.push({
      name: stage.name,
      color: stage.color ?? '#6366f1',
      value: stageLeads.reduce((s, l) => s + (l.estimated_value_cents ?? 0), 0),
      count: stageLeads.length,
    });
  }

  // -----------------------------------------------------------------------
  // 4. Service agreements (has deleted column) -- MRR
  // -----------------------------------------------------------------------
  const { data: agreements } = await supabase
    .from('service_agreements')
    .select('id, status, price_cents, billing_cycle, type')
    .eq('deleted', false)
    .eq('status', 'active');

  let mrr = 0;
  for (const a of agreements ?? []) {
    const price = a.price_cents ?? 0;
    if (a.billing_cycle === 'monthly') mrr += price;
    else if (a.billing_cycle === 'quarterly') mrr += Math.round(price / 3);
    else if (a.billing_cycle === 'annual') mrr += Math.round(price / 12);
  }

  // Agreement breakdown by type
  const agreementsByType: Record<string, number> = {};
  for (const a of agreements ?? []) {
    agreementsByType[a.type] = (agreementsByType[a.type] ?? 0) + 1;
  }

  // -----------------------------------------------------------------------
  // 5. Customers (has deleted column)
  // -----------------------------------------------------------------------
  const { data: customers } = await supabase
    .from('customers')
    .select('id, created_at')
    .eq('deleted', false);

  const thisMonthCustomers =
    customers?.filter((c) => new Date(c.created_at) >= startOfMonth).length ?? 0;
  const lastMonthCustomers =
    customers?.filter(
      (c) =>
        new Date(c.created_at) >= startOfLastMonth &&
        new Date(c.created_at) <= endOfLastMonth
    ).length ?? 0;
  const customerChange =
    lastMonthCustomers > 0
      ? Math.round(((thisMonthCustomers - lastMonthCustomers) / lastMonthCustomers) * 100)
      : 0;

  // -----------------------------------------------------------------------
  // 6. Communication stats
  // -----------------------------------------------------------------------
  const { count: callsThisMonth } = await supabase
    .from('call_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfMonthISO);

  const { count: messagesThisMonth } = await supabase
    .from('message_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfMonthISO);

  const { count: callsLastMonth } = await supabase
    .from('call_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfLastMonthISO)
    .lte('created_at', endOfLastMonthISO);

  const { count: messagesLastMonth } = await supabase
    .from('message_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfLastMonthISO)
    .lte('created_at', endOfLastMonthISO);

  // -----------------------------------------------------------------------
  // 7. Reviews (has deleted column)
  // -----------------------------------------------------------------------
  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, rating, response_text, reviewed_at')
    .eq('deleted', false);

  const totalReviews = reviews?.length ?? 0;
  const avgRating =
    totalReviews > 0
      ? parseFloat(
          (reviews!.reduce((s, r) => s + (r.rating ?? 0), 0) / totalReviews).toFixed(1)
        )
      : 0;
  const respondedReviews = reviews?.filter((r) => r.response_text !== null).length ?? 0;
  const responseRate =
    totalReviews > 0 ? Math.round((respondedReviews / totalReviews) * 100) : 0;

  // Rating distribution
  const ratingDist: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const r of reviews ?? []) {
    const bucket = Math.max(1, Math.min(5, Math.round(r.rating ?? 0)));
    ratingDist[bucket] = (ratingDist[bucket] ?? 0) + 1;
  }

  // -----------------------------------------------------------------------
  // 8. Technicians (has deleted column) + job counts
  // -----------------------------------------------------------------------
  const { data: technicians } = await supabase
    .from('technicians')
    .select('id, name, is_active, specialties')
    .eq('deleted', false)
    .eq('is_active', true);

  // Build per-technician metrics from allJobs
  const techJobMap: Record<string, { total: number; completed: number }> = {};
  for (const j of allJobs ?? []) {
    const tid = j.assigned_technician_id;
    if (!tid) continue;
    if (!techJobMap[tid]) techJobMap[tid] = { total: 0, completed: 0 };
    techJobMap[tid].total += 1;
    if (j.status === 'completed') techJobMap[tid].completed += 1;
  }

  const techPerformance = (technicians ?? [])
    .map((t) => ({
      id: t.id,
      name: t.name,
      specialties: t.specialties ?? [],
      totalJobs: techJobMap[t.id]?.total ?? 0,
      completedJobs: techJobMap[t.id]?.completed ?? 0,
    }))
    .sort((a, b) => b.totalJobs - a.totalJobs);

  // -----------------------------------------------------------------------
  // 9. Job aggregates
  // -----------------------------------------------------------------------
  const thisMonthJobCount = thisMonthJobs?.length ?? 0;
  const lastMonthJobCount = lastMonthJobs?.length ?? 0;
  const jobsChange =
    lastMonthJobCount > 0
      ? Math.round(((thisMonthJobCount - lastMonthJobCount) / lastMonthJobCount) * 100)
      : 0;

  // Status breakdown (this month)
  const statusBreakdown: Record<string, number> = {};
  for (const j of thisMonthJobs ?? []) {
    statusBreakdown[j.status] = (statusBreakdown[j.status] ?? 0) + 1;
  }

  // Service category breakdown (this month)
  const categoryBreakdown: Record<string, number> = {};
  for (const j of thisMonthJobs ?? []) {
    const cat = j.service_category ?? 'other';
    categoryBreakdown[cat] = (categoryBreakdown[cat] ?? 0) + 1;
  }

  // Urgency breakdown (this month)
  const urgencyBreakdown: Record<string, number> = {};
  for (const j of thisMonthJobs ?? []) {
    const urg = j.urgency ?? 'medium';
    urgencyBreakdown[urg] = (urgencyBreakdown[urg] ?? 0) + 1;
  }

  // -----------------------------------------------------------------------
  // Return everything
  // -----------------------------------------------------------------------
  return {
    revenue: { current: thisMonthRevenue, last: lastMonthRevenue, change: revenueChange },
    jobs: {
      total: thisMonthJobCount,
      change: jobsChange,
      statusBreakdown,
      categoryBreakdown,
      urgencyBreakdown,
    },
    customers: {
      total: customers?.length ?? 0,
      new: thisMonthCustomers,
      change: customerChange,
    },
    pipeline: {
      totalValue: totalPipelineValue,
      weightedValue: Math.round(weightedPipeline),
      totalLeads: leads?.length ?? 0,
      valueByStage,
    },
    estimates: {
      total: totalEstimates,
      approved: approvedEstimates,
      conversionRate: estimateConversionRate,
      statusBreakdown: estimateStatuses,
    },
    agreements: {
      mrr,
      activeCount: agreements?.length ?? 0,
      byType: agreementsByType,
    },
    communication: {
      calls: callsThisMonth ?? 0,
      messages: messagesThisMonth ?? 0,
      callsLast: callsLastMonth ?? 0,
      messagesLast: messagesLastMonth ?? 0,
    },
    reviews: {
      total: totalReviews,
      avgRating,
      responseRate,
      ratingDist,
    },
    techPerformance,
  };
}

// ---------------------------------------------------------------------------
// Helpers for the UI
// ---------------------------------------------------------------------------

const statusColors: Record<string, string> = {
  new: 'bg-purple-500',
  contacted: 'bg-indigo-500',
  scheduled: 'bg-blue-500',
  in_progress: 'bg-yellow-500',
  completed: 'bg-green-500',
  cancelled: 'bg-red-500',
  spam: 'bg-slate-400',
};

const statusLabels: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  spam: 'Spam',
};

const categoryLabels: Record<string, string> = {
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  hvac: 'HVAC',
  general: 'General',
  landscaping: 'Landscaping',
  cleaning: 'Cleaning',
  painting: 'Painting',
  roofing: 'Roofing',
  other: 'Other',
};

const urgencyColors: Record<string, string> = {
  low: 'bg-slate-400',
  medium: 'bg-blue-500',
  high: 'bg-orange-500',
  emergency: 'bg-red-600',
};

const urgencyLabels: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  emergency: 'Emergency',
};

const estimateStatusLabels: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Expired',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AnalyticsPage() {
  const data = await getAnalyticsData();

  const maxJobsByStatus = Math.max(...Object.values(data.jobs.statusBreakdown), 1);
  const maxJobsByCategory = Math.max(...Object.values(data.jobs.categoryBreakdown), 1);
  const maxJobsByUrgency = Math.max(...Object.values(data.jobs.urgencyBreakdown), 1);
  const maxPipelineStage = Math.max(...data.pipeline.valueByStage.map((s) => s.value), 1);
  const maxTechJobs = Math.max(...data.techPerformance.map((t) => t.totalJobs), 1);

  return (
    <div>
      <Header title="Analytics Dashboard" />

      <div className="p-6 space-y-6">
        {/* ================================================================
            1. KEY METRICS ROW
        ================================================================ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Revenue (Approved Estimates)"
            value={formatCents(data.revenue.current)}
            change={data.revenue.change}
            changeLabel="vs last month"
            icon={<DollarSign className="w-5 h-5 text-blue-600" />}
            trend={data.revenue.change >= 0 ? 'up' : 'down'}
          />
          <MetricCard
            title="Jobs This Month"
            value={data.jobs.total.toString()}
            change={data.jobs.change}
            changeLabel="vs last month"
            icon={<Briefcase className="w-5 h-5 text-blue-600" />}
            trend={data.jobs.change >= 0 ? 'up' : 'down'}
          />
          <MetricCard
            title="New Customers"
            value={data.customers.new.toString()}
            change={data.customers.change}
            changeLabel="vs last month"
            icon={<Users className="w-5 h-5 text-blue-600" />}
            trend={data.customers.change >= 0 ? 'up' : 'down'}
          />
          <MetricCard
            title="Pipeline Value"
            value={formatCents(data.pipeline.totalValue)}
            icon={<Target className="w-5 h-5 text-blue-600" />}
          />
        </div>

        {/* ================================================================
            2. JOB ANALYTICS
        ================================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Status breakdown */}
          <Card padding="none" className="p-6">
            <SectionHeading icon={<Briefcase className="w-5 h-5 text-slate-400" />}>
              Jobs by Status
            </SectionHeading>
            <div className="space-y-3">
              {Object.entries(data.jobs.statusBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => (
                  <ProgressBar
                    key={status}
                    value={count}
                    max={maxJobsByStatus}
                    label={statusLabels[status] ?? status}
                    color={statusColors[status] ?? 'bg-slate-500'}
                  />
                ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Completion Rate</span>
                <span className="font-semibold text-green-600">
                  {data.jobs.total > 0
                    ? Math.round(
                        ((data.jobs.statusBreakdown['completed'] ?? 0) / data.jobs.total) * 100
                      )
                    : 0}
                  %
                </span>
              </div>
            </div>
          </Card>

          {/* Service category */}
          <Card padding="none" className="p-6">
            <SectionHeading icon={<Wrench className="w-5 h-5 text-slate-400" />}>
              Jobs by Service Category
            </SectionHeading>
            <div className="space-y-3">
              {Object.entries(data.jobs.categoryBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([cat, count]) => (
                  <ProgressBar
                    key={cat}
                    value={count}
                    max={maxJobsByCategory}
                    label={categoryLabels[cat] ?? cat}
                    color="bg-indigo-500"
                  />
                ))}
            </div>
          </Card>

          {/* Urgency */}
          <Card padding="none" className="p-6">
            <SectionHeading icon={<AlertTriangle className="w-5 h-5 text-slate-400" />}>
              Jobs by Urgency
            </SectionHeading>
            <div className="space-y-3">
              {Object.entries(data.jobs.urgencyBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([urg, count]) => (
                  <ProgressBar
                    key={urg}
                    value={count}
                    max={maxJobsByUrgency}
                    label={urgencyLabels[urg] ?? urg}
                    color={urgencyColors[urg] ?? 'bg-slate-500'}
                  />
                ))}
            </div>
          </Card>
        </div>

        {/* ================================================================
            3. PIPELINE & REVENUE
        ================================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pipeline by stage */}
          <Card padding="none" className="p-6 lg:col-span-2">
            <SectionHeading icon={<BarChart3 className="w-5 h-5 text-slate-400" />}>
              Pipeline Value by Stage
            </SectionHeading>
            {data.pipeline.valueByStage.length === 0 ? (
              <p className="text-sm text-slate-500">No pipeline stages configured yet.</p>
            ) : (
              <div className="space-y-3">
                {data.pipeline.valueByStage.map((stage) => (
                  <div key={stage.name} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 flex items-center gap-2">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        {stage.name}
                        <span className="text-slate-400">({stage.count})</span>
                      </span>
                      <span className="font-medium text-slate-900">
                        {formatCents(stage.value)}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min((stage.value / maxPipelineStage) * 100, 100)}%`,
                          backgroundColor: stage.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-500">Total Pipeline</div>
                <div className="font-semibold text-slate-900">
                  {formatCents(data.pipeline.totalValue)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Weighted Pipeline</div>
                <div className="font-semibold text-slate-900">
                  {formatCents(data.pipeline.weightedValue)}
                </div>
              </div>
            </div>
          </Card>

          {/* Estimate conversion + MRR */}
          <Card padding="none" className="p-6">
            <SectionHeading icon={<FileText className="w-5 h-5 text-slate-400" />}>
              Estimates & Agreements
            </SectionHeading>

            {/* Estimate conversion */}
            <div className="mb-5">
              <div className="text-sm text-slate-500 mb-1">Estimate Conversion Rate</div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold text-slate-900">
                  {data.estimates.conversionRate}%
                </span>
                <span className="text-sm text-slate-400 mb-1">
                  {data.estimates.approved} / {data.estimates.total}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${data.estimates.conversionRate}%` }}
                />
              </div>
            </div>

            {/* Estimate status mini-breakdown */}
            <div className="flex flex-wrap gap-2 mb-5">
              {Object.entries(data.estimates.statusBreakdown).map(([status, count]) => (
                <Badge key={status} variant="default" className="text-xs">
                  {estimateStatusLabels[status] ?? status}: {count}
                </Badge>
              ))}
            </div>

            {/* MRR */}
            <div className="pt-4 border-t border-slate-100">
              <div className="text-sm text-slate-500 mb-1">Monthly Recurring Revenue</div>
              <div className="text-2xl font-bold text-slate-900">{formatCents(data.agreements.mrr)}</div>
              <div className="text-xs text-slate-400 mt-1">
                {data.agreements.activeCount} active agreement
                {data.agreements.activeCount !== 1 ? 's' : ''}
              </div>
              {Object.keys(data.agreements.byType).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {Object.entries(data.agreements.byType).map(([type, count]) => (
                    <Badge key={type} variant="info" className="text-xs capitalize">
                      {type}: {count}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ================================================================
            4. TECHNICIAN PERFORMANCE
        ================================================================ */}
        <Card padding="none" className="p-6">
          <SectionHeading icon={<Users className="w-5 h-5 text-slate-400" />}>
            Technician Performance
          </SectionHeading>
          {data.techPerformance.length === 0 ? (
            <p className="text-sm text-slate-500">No active technicians found.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.techPerformance.map((tech) => {
                const completionRate =
                  tech.totalJobs > 0
                    ? Math.round((tech.completedJobs / tech.totalJobs) * 100)
                    : 0;
                return (
                  <div
                    key={tech.id}
                    className="border border-slate-200 rounded-lg p-4 space-y-3"
                  >
                    <div>
                      <div className="font-medium text-slate-900">{tech.name}</div>
                      {tech.specialties.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {tech.specialties.slice(0, 3).map((s) => (
                            <Badge key={s} variant="default" className="text-xs capitalize">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <ProgressBar
                      value={tech.totalJobs}
                      max={maxTechJobs}
                      label="Total Jobs"
                      color="bg-blue-500"
                    />
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Completed</span>
                      <span className="font-medium text-green-600">
                        {tech.completedJobs} ({completionRate}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* ================================================================
            5. COMMUNICATION STATS  +  6. REVIEW STATS
        ================================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Communication */}
          <Card padding="none" className="p-6">
            <SectionHeading icon={<MessageSquare className="w-5 h-5 text-slate-400" />}>
              Communication This Month
            </SectionHeading>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Phone className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{data.communication.calls}</div>
                    <div className="text-sm text-slate-500">Phone Calls</div>
                  </div>
                </div>
                {data.communication.callsLast > 0 && (
                  <div className="text-xs text-slate-400">
                    {data.communication.callsLast} last month
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <MessageSquare className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">
                      {data.communication.messages}
                    </div>
                    <div className="text-sm text-slate-500">Text Messages</div>
                  </div>
                </div>
                {data.communication.messagesLast > 0 && (
                  <div className="text-xs text-slate-400">
                    {data.communication.messagesLast} last month
                  </div>
                )}
              </div>
              <div className="pt-3 border-t border-slate-100">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Total Touchpoints</span>
                  <span className="font-semibold text-slate-900">
                    {data.communication.calls + data.communication.messages}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Reviews */}
          <Card padding="none" className="p-6">
            <SectionHeading icon={<Star className="w-5 h-5 text-slate-400" />}>
              Review Performance
            </SectionHeading>

            <div className="flex items-center gap-6 mb-5">
              <div>
                <div className="text-4xl font-bold text-slate-900 flex items-center gap-1">
                  {data.reviews.avgRating}
                  <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                </div>
                <div className="text-sm text-slate-500">
                  {data.reviews.total} review{data.reviews.total !== 1 ? 's' : ''}
                </div>
              </div>
              <div className="h-12 w-px bg-slate-200" />
              <div>
                <div className="text-2xl font-bold text-slate-900">{data.reviews.responseRate}%</div>
                <div className="text-sm text-slate-500">Response Rate</div>
              </div>
            </div>

            {/* Rating distribution */}
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = data.reviews.ratingDist[stars] ?? 0;
                const pct = data.reviews.total > 0 ? (count / data.reviews.total) * 100 : 0;
                return (
                  <div key={stars} className="flex items-center gap-2 text-sm">
                    <span className="w-4 text-right text-slate-600">{stars}</span>
                    <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-400 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-slate-500">{count}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* ================================================================
            7. REPORTS GRID
        ================================================================ */}
        <div>
          <h3 className="font-semibold text-slate-900 mb-4">Available Reports</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { name: 'Revenue by Service Category', icon: DollarSign },
              { name: 'Estimate Profitability', icon: TrendingUp },
              { name: 'Technician Performance', icon: Users },
              { name: 'Customer Acquisition', icon: Target },
              { name: 'Cancellation Analysis', icon: TrendingDown },
              { name: 'Average Job Duration', icon: Clock },
              { name: 'Lead Conversion Rate', icon: Zap },
              { name: 'Repeat Customer Rate', icon: Users },
              { name: 'Agreement Revenue', icon: ShieldCheck },
              { name: 'Communication Volume', icon: Activity },
              { name: 'Review Trends', icon: Star },
              { name: 'Scheduling Heatmap', icon: CalendarCheck },
            ].map((report) => (
              <button
                key={report.name}
                className="p-4 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all text-left group"
              >
                <report.icon className="w-5 h-5 text-slate-400 group-hover:text-blue-600 mb-2" />
                <div className="text-sm font-medium text-slate-900">{report.name}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
