// Murray's FSM - Revenue Report / P&L Dashboard
// ================================================
// Financial overview with revenue, expenses, margins, and trends

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCents } from '@/lib/utils';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  PieChart,
  BarChart3,
  Calendar,
  Users,
  Briefcase,
  ArrowUp,
  ArrowDown,
  Minus,
  FileText,
  CreditCard,
} from 'lucide-react';

// ---------- Data Fetcher ----------

async function getRevenueData() {
  const supabase = await createClient();
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const thisYearStart = new Date(now.getFullYear(), 0, 1);

  // Revenue this month (approved estimates)
  const { data: thisMonthEstimates } = await supabase
    .from('estimates')
    .select('total_cents, approved_at, customer:customers(name)')
    .eq('status', 'approved')
    .eq('deleted', false)
    .gte('approved_at', thisMonthStart.toISOString());

  // Revenue last month
  const { data: lastMonthEstimates } = await supabase
    .from('estimates')
    .select('total_cents')
    .eq('status', 'approved')
    .eq('deleted', false)
    .gte('approved_at', lastMonthStart.toISOString())
    .lt('approved_at', lastMonthEnd.toISOString());

  // Revenue this year
  const { data: yearEstimates } = await supabase
    .from('estimates')
    .select('total_cents, approved_at')
    .eq('status', 'approved')
    .eq('deleted', false)
    .gte('approved_at', thisYearStart.toISOString());

  // Payments collected
  const { data: paymentsThisMonth } = await supabase
    .from('payments')
    .select('amount_cents')
    .eq('status', 'succeeded')
    .gte('created_at', thisMonthStart.toISOString());

  const { data: paymentsLastMonth } = await supabase
    .from('payments')
    .select('amount_cents')
    .eq('status', 'succeeded')
    .gte('created_at', lastMonthStart.toISOString())
    .lt('created_at', lastMonthEnd.toISOString());

  // Jobs this month
  const { data: jobsThisMonth } = await supabase
    .from('jobs')
    .select('id, status, service_category')
    .eq('is_spam', false)
    .gte('created_at', thisMonthStart.toISOString());

  // Technician labor cost estimate (based on time entries or hourly rates)
  const { data: technicians } = await supabase
    .from('technicians')
    .select('id, name, hourly_rate_cents')
    .eq('is_active', true)
    .eq('deleted', false);

  const { data: timeEntries } = await supabase
    .from('time_entries')
    .select('technician_id, duration_minutes')
    .gte('created_at', thisMonthStart.toISOString());

  // Revenue by service category this month
  const { data: revByCategory } = await supabase
    .from('estimates')
    .select('total_cents, title')
    .eq('status', 'approved')
    .eq('deleted', false)
    .gte('approved_at', thisMonthStart.toISOString());

  // Monthly revenue data for chart (last 6 months)
  const monthlyRevenue: { month: string; revenue: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    const monthName = mStart.toLocaleString('default', { month: 'short' });

    const monthRevenue = (yearEstimates || [])
      .filter((e: any) => {
        const d = new Date(e.approved_at);
        return d >= mStart && d <= mEnd;
      })
      .reduce((sum: number, e: any) => sum + (e.total_cents || 0), 0);

    monthlyRevenue.push({ month: monthName, revenue: monthRevenue });
  }

  // Calculations
  const revenueThisMonth = (thisMonthEstimates || []).reduce((s: number, e: any) => s + (e.total_cents || 0), 0);
  const revenueLastMonth = (lastMonthEstimates || []).reduce((s: number, e: any) => s + (e.total_cents || 0), 0);
  const revenueYTD = (yearEstimates || []).reduce((s: number, e: any) => s + (e.total_cents || 0), 0);
  const paymentsCollectedThisMonth = (paymentsThisMonth || []).reduce((s: number, p: any) => s + (p.amount_cents || 0), 0);
  const paymentsCollectedLastMonth = (paymentsLastMonth || []).reduce((s: number, p: any) => s + (p.amount_cents || 0), 0);

  // Labor costs (from time entries × hourly rates)
  const techRateMap = new Map((technicians || []).map((t: any) => [t.id, t.hourly_rate_cents || 3500]));
  const laborCost = (timeEntries || []).reduce((sum: number, te: any) => {
    const rate = techRateMap.get(te.technician_id) || 3500;
    return sum + Math.round((te.duration_minutes / 60) * rate);
  }, 0);

  // Gross margin
  const grossProfit = revenueThisMonth - laborCost;
  const grossMargin = revenueThisMonth > 0 ? Math.round((grossProfit / revenueThisMonth) * 100) : 0;

  // Month-over-month change
  const revenueChange = revenueLastMonth > 0
    ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100)
    : revenueThisMonth > 0 ? 100 : 0;

  // Jobs stats
  const totalJobsThisMonth = jobsThisMonth?.length || 0;
  const completedJobs = (jobsThisMonth || []).filter((j: any) => j.status === 'completed').length;
  const avgJobValue = totalJobsThisMonth > 0 ? Math.round(revenueThisMonth / totalJobsThisMonth) : 0;

  // Top customers
  const customerRevenue: Record<string, number> = {};
  (thisMonthEstimates || []).forEach((e: any) => {
    const name = Array.isArray(e.customer) ? e.customer[0]?.name : e.customer?.name;
    if (name) {
      customerRevenue[name] = (customerRevenue[name] || 0) + (e.total_cents || 0);
    }
  });
  const topCustomers = Object.entries(customerRevenue)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, revenue]) => ({ name, revenue }));

  return {
    revenueThisMonth,
    revenueLastMonth,
    revenueYTD,
    revenueChange,
    paymentsCollectedThisMonth,
    paymentsCollectedLastMonth,
    laborCost,
    grossProfit,
    grossMargin,
    totalJobsThisMonth,
    completedJobs,
    avgJobValue,
    topCustomers,
    monthlyRevenue,
    maxMonthlyRevenue: Math.max(...monthlyRevenue.map(m => m.revenue), 1),
  };
}

// ---------- Page ----------

export default async function ReportsPage() {
  const data = await getRevenueData();

  return (
    <div>
      <Header title="Revenue Report" />

      <div className="p-6 space-y-6 max-w-6xl">
        {/* Top KPIs */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-green-50">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div className={`flex items-center gap-1 text-sm font-medium ${data.revenueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {data.revenueChange >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                {Math.abs(data.revenueChange)}%
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">{formatCents(data.revenueThisMonth)}</div>
            <div className="text-sm text-slate-500">Revenue This Month</div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <CreditCard className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">{formatCents(data.paymentsCollectedThisMonth)}</div>
            <div className="text-sm text-slate-500">Payments Collected</div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-purple-50">
                <PieChart className="w-5 h-5 text-purple-600" />
              </div>
              <span className={`text-sm font-medium ${data.grossMargin >= 50 ? 'text-green-600' : data.grossMargin >= 30 ? 'text-yellow-600' : 'text-red-600'}`}>
                {data.grossMargin}%
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900">{formatCents(data.grossProfit)}</div>
            <div className="text-sm text-slate-500">Gross Profit</div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-yellow-50">
                <TrendingUp className="w-5 h-5 text-yellow-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">{formatCents(data.revenueYTD)}</div>
            <div className="text-sm text-slate-500">Revenue YTD</div>
          </Card>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Revenue Chart (Bar) */}
          <div className="col-span-2">
            <Card padding="none" className="p-5">
              <h3 className="font-semibold text-slate-900 mb-4">Monthly Revenue (Last 6 Months)</h3>
              <div className="flex items-end gap-3 h-48">
                {data.monthlyRevenue.map((m, i) => {
                  const height = data.maxMonthlyRevenue > 0
                    ? Math.max((m.revenue / data.maxMonthlyRevenue) * 100, 2)
                    : 2;
                  const isCurrentMonth = i === data.monthlyRevenue.length - 1;
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
                      <span className="text-xs font-medium text-slate-600">
                        {m.revenue > 0 ? formatCents(m.revenue) : '—'}
                      </span>
                      <div
                        className={`w-full rounded-t-lg transition-all ${isCurrentMonth ? 'bg-blue-500' : 'bg-blue-200'}`}
                        style={{ height: `${height}%` }}
                      />
                      <span className="text-xs text-slate-500">{m.month}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Job Stats */}
          <Card padding="none" className="p-5">
            <h3 className="font-semibold text-slate-900 mb-4">Job Performance</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-600">Jobs This Month</span>
                </div>
                <span className="font-semibold text-slate-900">{data.totalJobsThisMonth}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 flex items-center justify-center">✅</span>
                  <span className="text-sm text-slate-600">Completed</span>
                </div>
                <span className="font-semibold text-green-600">{data.completedJobs}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-600">Avg Job Value</span>
                </div>
                <span className="font-semibold text-slate-900">{formatCents(data.avgJobValue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-600">Labor Cost</span>
                </div>
                <span className="font-semibold text-red-600">{formatCents(data.laborCost)}</span>
              </div>

              <hr className="border-slate-200" />

              {/* P&L Summary */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">Revenue</span>
                  <span className="font-medium text-slate-900">{formatCents(data.revenueThisMonth)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">- Labor</span>
                  <span className="font-medium text-red-600">({formatCents(data.laborCost)})</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="text-sm font-semibold text-slate-900">Gross Profit</span>
                  <span className="font-bold text-green-600">{formatCents(data.grossProfit)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Gross Margin</span>
                  <Badge className={data.grossMargin >= 50 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                    {data.grossMargin}%
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Top Customers */}
          <Card padding="none" className="p-5">
            <h3 className="font-semibold text-slate-900 mb-4">Top Customers This Month</h3>
            {data.topCustomers.length > 0 ? (
              <div className="space-y-3">
                {data.topCustomers.map((customer, i) => (
                  <div key={customer.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0 ? 'bg-yellow-100 text-yellow-700' :
                        i === 1 ? 'bg-slate-200 text-slate-600' :
                        i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium text-slate-900">{customer.name}</span>
                    </div>
                    <span className="font-semibold text-slate-900">{formatCents(customer.revenue)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No revenue data yet this month</p>
            )}
          </Card>

          {/* Month Comparison */}
          <Card padding="none" className="p-5">
            <h3 className="font-semibold text-slate-900 mb-4">Month-over-Month</h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-600">Last Month Revenue</span>
                  <span className="font-medium text-slate-900">{formatCents(data.revenueLastMonth)}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3">
                  <div
                    className="bg-slate-400 h-3 rounded-full"
                    style={{ width: `${Math.min(100, data.revenueLastMonth > 0 ? (data.revenueLastMonth / Math.max(data.revenueThisMonth, data.revenueLastMonth)) * 100 : 0)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-600">This Month Revenue</span>
                  <span className="font-medium text-slate-900">{formatCents(data.revenueThisMonth)}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3">
                  <div
                    className="bg-blue-500 h-3 rounded-full"
                    style={{ width: `${Math.min(100, data.revenueThisMonth > 0 ? (data.revenueThisMonth / Math.max(data.revenueThisMonth, data.revenueLastMonth)) * 100 : 0)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-600">Payments Last Month</span>
                  <span className="font-medium text-slate-900">{formatCents(data.paymentsCollectedLastMonth)}</span>
                </div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-600">Payments This Month</span>
                  <span className="font-medium text-slate-900">{formatCents(data.paymentsCollectedThisMonth)}</span>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center gap-2">
                  {data.revenueChange >= 0 ? (
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-600" />
                  )}
                  <span className={`text-lg font-bold ${data.revenueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {data.revenueChange >= 0 ? '+' : ''}{data.revenueChange}% MoM
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
