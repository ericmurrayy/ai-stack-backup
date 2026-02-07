// Murray's FSM - Dashboard Page
// ===============================

import { createAdminClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StatCard, StatsGrid } from '@/components/ui/Stats';
import { formatPhone, formatRelativeTime, formatDuration, actionKindConfig } from '@/lib/utils';
import {
  Briefcase,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  CheckCircle,
  AlertCircle,
  Calendar,
  TrendingUp,
  DollarSign,
  Users,
  Clock,
} from 'lucide-react';
import Link from 'next/link';

// Default mock stats for when database is unavailable
const mockStats = {
  totalJobs: 0,
  todaysJobs: [],
  totalCustomers: 0,
  pendingApprovals: [],
  recentCalls: [],
  monthlyCallStats: {
    total: 0,
    inbound: 0,
    outbound: 0,
    answered: 0,
  },
  isOffline: true,
};

async function getDashboardStats() {
  try {
    const supabase = createAdminClient();

    // Get date ranges
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay())).toISOString();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

    // Fetch all stats in parallel
    const [
      jobsResult,
      todaysJobsResult,
      customersResult,
      pendingApprovalsResult,
      recentCallsResult,
      callStatsResult,
    ] = await Promise.all([
      // Total jobs
      supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('deleted', false),

      // Today's scheduled jobs
      supabase
        .from('jobs')
        .select('id, title, status, scheduled_start, customer:customers(name)')
        .eq('deleted', false)
        .gte('scheduled_start', startOfToday)
        .order('scheduled_start', { ascending: true })
        .limit(5),

      // Total customers
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('deleted', false),

      // Pending approvals
      supabase
        .from('action_queue')
        .select('*')
        .eq('deleted', false)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5),

      // Recent calls
      supabase
        .from('call_logs')
        .select('*')
        .eq('deleted', false)
        .order('started_at', { ascending: false })
        .limit(5),

      // Call stats for this month
      supabase
        .from('call_logs')
        .select('id, direction, answered_at', { count: 'exact' })
        .eq('deleted', false)
        .gte('created_at', startOfMonth),
    ]);

    // Check for errors - if any critical query failed, return mock data
    if (jobsResult.error || customersResult.error) {
      console.warn('Database unavailable, using mock data:', jobsResult.error || customersResult.error);
      return mockStats;
    }

    const callStats = callStatsResult.data || [];
    const inboundCalls = callStats.filter((c) => c.direction === 'inbound').length;
    const answeredCalls = callStats.filter((c) => c.answered_at).length;

    return {
      totalJobs: jobsResult.count || 0,
      todaysJobs: todaysJobsResult.data || [],
      totalCustomers: customersResult.count || 0,
      pendingApprovals: pendingApprovalsResult.data || [],
      recentCalls: recentCallsResult.data || [],
      monthlyCallStats: {
        total: callStats.length,
        inbound: inboundCalls,
        outbound: callStats.length - inboundCalls,
        answered: answeredCalls,
      },
      isOffline: false,
    };
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error);
    return mockStats;
  }
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div>
      <Header title="Dashboard" />

      <div className="p-6 space-y-6">
        {stats.isOffline && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-800">Database Offline</p>
              <p className="text-sm text-yellow-600">
                Unable to connect to database. Showing placeholder data. Please configure your Supabase credentials in .env.local
              </p>
            </div>
          </div>
        )}
        {/* Stats Overview */}
        <StatsGrid>
          <StatCard
            title="Total Jobs"
            value={stats.totalJobs}
            icon={Briefcase}
            trend={{ value: 12 }}
          />
          <StatCard
            title="Total Customers"
            value={stats.totalCustomers}
            icon={Users}
            trend={{ value: 8 }}
          />
          <StatCard
            title="Calls This Month"
            value={stats.monthlyCallStats.total}
            icon={Phone}
            subtitle={`${stats.monthlyCallStats.answered} answered`}
          />
          <StatCard
            title="Pending Approvals"
            value={stats.pendingApprovals.length}
            icon={AlertCircle}
            variant="warning"
          />
        </StatsGrid>

        <div className="grid grid-cols-2 gap-6">
          {/* Today's Schedule */}
          <Card padding="none">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Today&apos;s Schedule</h2>
                <p className="text-sm text-slate-500">Upcoming jobs for today</p>
              </div>
              <Link
                href="/calendar"
                className="text-sm text-primary-600 hover:text-primary-800 font-medium"
              >
                View Calendar
              </Link>
            </div>

            <div className="divide-y divide-slate-200">
              {stats.todaysJobs.map((job: any) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="block p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-100 rounded-lg text-primary-700">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate">{job.title}</div>
                      <div className="text-sm text-slate-500">
                        {job.customer?.name || 'No customer'}
                      </div>
                    </div>
                    <Badge
                      variant={
                        job.status === 'completed'
                          ? 'success'
                          : job.status === 'in_progress'
                            ? 'info'
                            : 'default'
                      }
                    >
                      {job.status}
                    </Badge>
                  </div>
                </Link>
              ))}

              {stats.todaysJobs.length === 0 && (
                <div className="p-8 text-center">
                  <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <div className="text-slate-500">No jobs scheduled for today</div>
                </div>
              )}
            </div>
          </Card>

          {/* Pending Approvals */}
          <Card padding="none">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Pending Approvals</h2>
                <p className="text-sm text-slate-500">Actions waiting for review</p>
              </div>
              <Link
                href="/approvals"
                className="text-sm text-primary-600 hover:text-primary-800 font-medium"
              >
                View All
              </Link>
            </div>

            <div className="divide-y divide-slate-200">
              {stats.pendingApprovals.map((action: any) => {
                const kindConfig = actionKindConfig[action.kind as keyof typeof actionKindConfig] || {
                  label: action.kind,
                };
                return (
                  <Link
                    key={action.id}
                    href="/approvals"
                    className="block p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-yellow-100 rounded-lg text-yellow-700">
                        <CheckCircle className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900">{kindConfig.label}</div>
                        <div className="text-sm text-slate-500">
                          {formatRelativeTime(action.created_at)}
                        </div>
                      </div>
                      <Badge variant="warning">Pending</Badge>
                    </div>
                  </Link>
                );
              })}

              {stats.pendingApprovals.length === 0 && (
                <div className="p-8 text-center">
                  <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
                  <div className="text-slate-500">All caught up!</div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Recent Calls */}
        <Card padding="none">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Recent Calls</h2>
              <p className="text-sm text-slate-500">Latest calls from your phone system</p>
            </div>
            <Link
              href="/calls"
              className="text-sm text-primary-600 hover:text-primary-800 font-medium"
            >
              View All Calls
            </Link>
          </div>

          <div className="divide-y divide-slate-200">
            {stats.recentCalls.map((call: any) => (
              <Link
                key={call.id}
                href={`/calls/${call.id}`}
                className="block p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`p-2 rounded-lg ${
                      call.direction === 'inbound'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {call.direction === 'inbound' ? (
                      <PhoneIncoming className="w-4 h-4" />
                    ) : (
                      <PhoneOutgoing className="w-4 h-4" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900">
                      {formatPhone(
                        call.direction === 'inbound' ? call.from_phone : call.to_phone
                      )}
                    </div>
                    <div className="text-sm text-slate-500 truncate">
                      {call.summary || 'No summary available'}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm text-slate-500">
                      {formatRelativeTime(call.started_at)}
                    </div>
                    {call.duration_seconds && (
                      <div className="text-xs text-slate-400 flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3" />
                        {formatDuration(call.duration_seconds)}
                      </div>
                    )}
                  </div>

                  <Badge variant={call.direction === 'inbound' ? 'success' : 'info'}>
                    {call.direction}
                  </Badge>
                </div>
              </Link>
            ))}

            {stats.recentCalls.length === 0 && (
              <div className="p-8 text-center">
                <Phone className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <div className="text-slate-500">No calls recorded yet</div>
                <div className="text-sm text-slate-400">
                  Calls from your Beside/OpenPhone integration will appear here
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
