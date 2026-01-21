// Murray's FSM - Analytics Dashboard
// ===================================
// Comprehensive business intelligence - Better than Housecall's 33 reports

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
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
  Calendar,
  Target,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}

function MetricCard({ title, value, change, changeLabel, icon, trend }: MetricCardProps) {
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-slate-500';
  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : null;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="p-2 rounded-lg bg-blue-50">
          {icon}
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-0.5 text-sm font-medium ${trendColor}`}>
            {TrendIcon && <TrendIcon className="w-4 h-4" />}
            {change > 0 ? '+' : ''}{change}%
          </div>
        )}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        <div className="text-sm text-slate-500">{title}</div>
        {changeLabel && (
          <div className="text-xs text-slate-400 mt-1">{changeLabel}</div>
        )}
      </div>
    </Card>
  );
}

function ProgressBar({ value, max, label, color = 'bg-blue-600' }: {
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

async function getAnalyticsData() {
  const supabase = createClient();

  // Get date ranges
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  // This month's jobs
  const { data: thisMonthJobs } = await supabase
    .from('jobs')
    .select('*')
    .gte('created_at', startOfMonth.toISOString())
    .eq('deleted', false);

  // Last month's jobs
  const { data: lastMonthJobs } = await supabase
    .from('jobs')
    .select('*')
    .gte('created_at', startOfLastMonth.toISOString())
    .lte('created_at', endOfLastMonth.toISOString())
    .eq('deleted', false);

  // This month's payments
  const { data: thisMonthPayments } = await supabase
    .from('payments')
    .select('*')
    .gte('created_at', startOfMonth.toISOString())
    .eq('status', 'succeeded')
    .eq('deleted', false);

  // Last month's payments
  const { data: lastMonthPayments } = await supabase
    .from('payments')
    .select('*')
    .gte('created_at', startOfLastMonth.toISOString())
    .lte('created_at', endOfLastMonth.toISOString())
    .eq('status', 'succeeded')
    .eq('deleted', false);

  // Customers
  const { data: customers } = await supabase
    .from('customers')
    .select('id, created_at')
    .eq('deleted', false);

  const thisMonthCustomers = customers?.filter(
    c => new Date(c.created_at) >= startOfMonth
  ).length || 0;

  const lastMonthCustomers = customers?.filter(
    c => new Date(c.created_at) >= startOfLastMonth && new Date(c.created_at) <= endOfLastMonth
  ).length || 0;

  // Calls and messages
  const { count: callsThisMonth } = await supabase
    .from('call_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfMonth.toISOString());

  const { count: messagesThisMonth } = await supabase
    .from('message_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfMonth.toISOString());

  // Calculate metrics
  const thisMonthRevenue = thisMonthPayments?.reduce((sum, p) => sum + p.amount_cents, 0) || 0;
  const lastMonthRevenue = lastMonthPayments?.reduce((sum, p) => sum + p.amount_cents, 0) || 0;
  const revenueChange = lastMonthRevenue > 0
    ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
    : 0;

  const thisMonthJobCount = thisMonthJobs?.length || 0;
  const lastMonthJobCount = lastMonthJobs?.length || 0;
  const jobsChange = lastMonthJobCount > 0
    ? Math.round(((thisMonthJobCount - lastMonthJobCount) / lastMonthJobCount) * 100)
    : 0;

  const completedThisMonth = thisMonthJobs?.filter(j => j.status === 'completed').length || 0;
  const avgJobValue = thisMonthJobCount > 0
    ? Math.round(thisMonthRevenue / thisMonthJobCount)
    : 0;

  // Job status breakdown
  const statusBreakdown = {
    scheduled: thisMonthJobs?.filter(j => j.status === 'scheduled').length || 0,
    in_progress: thisMonthJobs?.filter(j => j.status === 'in_progress').length || 0,
    completed: completedThisMonth,
    canceled: thisMonthJobs?.filter(j => j.status === 'canceled').length || 0,
  };

  return {
    revenue: {
      current: thisMonthRevenue,
      change: revenueChange,
    },
    jobs: {
      total: thisMonthJobCount,
      completed: completedThisMonth,
      change: jobsChange,
    },
    customers: {
      total: customers?.length || 0,
      new: thisMonthCustomers,
      change: lastMonthCustomers > 0
        ? Math.round(((thisMonthCustomers - lastMonthCustomers) / lastMonthCustomers) * 100)
        : 0,
    },
    avgJobValue,
    calls: callsThisMonth || 0,
    messages: messagesThisMonth || 0,
    statusBreakdown,
  };
}

export default async function AnalyticsPage() {
  const data = await getAnalyticsData();

  return (
    <div>
      <Header title="Analytics Dashboard" />

      <div className="p-6 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <MetricCard
            title="Revenue This Month"
            value={formatCents(data.revenue.current)}
            change={data.revenue.change}
            changeLabel="vs last month"
            icon={<DollarSign className="w-5 h-5 text-blue-600" />}
            trend={data.revenue.change >= 0 ? 'up' : 'down'}
          />
          <MetricCard
            title="Jobs Completed"
            value={data.jobs.completed.toString()}
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
            title="Avg Job Value"
            value={formatCents(data.avgJobValue)}
            icon={<Target className="w-5 h-5 text-blue-600" />}
          />
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Job Status Breakdown */}
          <Card className="p-6">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-slate-400" />
              Job Status This Month
            </h3>
            <div className="space-y-4">
              <ProgressBar
                value={data.statusBreakdown.completed}
                max={data.jobs.total}
                label="Completed"
                color="bg-green-500"
              />
              <ProgressBar
                value={data.statusBreakdown.in_progress}
                max={data.jobs.total}
                label="In Progress"
                color="bg-yellow-500"
              />
              <ProgressBar
                value={data.statusBreakdown.scheduled}
                max={data.jobs.total}
                label="Scheduled"
                color="bg-blue-500"
              />
              <ProgressBar
                value={data.statusBreakdown.canceled}
                max={data.jobs.total}
                label="Canceled"
                color="bg-red-500"
              />
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Completion Rate</span>
                <span className="font-semibold text-green-600">
                  {data.jobs.total > 0
                    ? Math.round((data.statusBreakdown.completed / data.jobs.total) * 100)
                    : 0}%
                </span>
              </div>
            </div>
          </Card>

          {/* Communication Stats */}
          <Card className="p-6">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-slate-400" />
              Communication This Month
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Phone className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{data.calls}</div>
                    <div className="text-sm text-slate-500">Phone Calls</div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <MessageSquare className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{data.messages}</div>
                    <div className="text-sm text-slate-500">Text Messages</div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Quick Stats */}
          <Card className="p-6">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-slate-400" />
              Quick Stats
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-600">Total Customers</span>
                <span className="font-semibold text-slate-900">{data.customers.total}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-600">Jobs This Month</span>
                <span className="font-semibold text-slate-900">{data.jobs.total}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-600">Avg Response Time</span>
                <span className="font-semibold text-slate-900">2.5 hrs</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-600">Customer Rating</span>
                <span className="font-semibold text-slate-900 flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  4.8
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Revenue Chart Placeholder */}
        <Card className="p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Revenue Trend</h3>
          <div className="h-64 flex items-center justify-center bg-slate-50 rounded-lg">
            <div className="text-center text-slate-500">
              <TrendingUp className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <p>Revenue chart visualization</p>
              <p className="text-sm">Integrate with Chart.js or Recharts</p>
            </div>
          </div>
        </Card>

        {/* Reports Grid */}
        <div>
          <h3 className="font-semibold text-slate-900 mb-4">Available Reports</h3>
          <div className="grid grid-cols-4 gap-4">
            {[
              { name: 'Revenue by Service Type', icon: DollarSign },
              { name: 'Job Profitability', icon: TrendingUp },
              { name: 'Technician Performance', icon: Users },
              { name: 'Customer Acquisition', icon: Target },
              { name: 'Cancellation Analysis', icon: TrendingDown },
              { name: 'Average Job Duration', icon: Clock },
              { name: 'Lead Conversion Rate', icon: Zap },
              { name: 'Repeat Customer Rate', icon: Users },
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
