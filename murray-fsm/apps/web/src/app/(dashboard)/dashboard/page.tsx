// Murray's FSM - Operator Dashboard (Command Center)
// ===================================================
// Single glance: what needs attention RIGHT NOW.

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCents, formatRelativeTime } from '@/lib/utils';
import {
  AlertCircle, CheckCircle, Calendar, DollarSign, Users, Clock,
  Briefcase, TrendingUp, Phone, MessageSquare, ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

async function getDashboardData() {
  const supabase = createClient();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: pendingApprovals },
    { data: todaysJobs },
    { count: totalCustomers },
    { data: recentPayments },
    { data: upcomingJobs },
    { count: unreadMessages },
    { data: recentLeads },
  ] = await Promise.all([
    supabase.from('action_queue').select('*', { count: 'exact', head: true })
      .eq('status', 'pending').eq('deleted', false),
    supabase.from('jobs').select('id, title, status, scheduled_start, scheduled_end, customer:customers(name)')
      .eq('deleted', false).gte('scheduled_start', todayStart).lt('scheduled_start', todayEnd)
      .order('scheduled_start'),
    supabase.from('customers').select('*', { count: 'exact', head: true }).eq('deleted', false),
    supabase.from('payments').select('id, amount_cents, status, created_at, job:jobs(title)')
      .eq('status', 'succeeded').gte('created_at', thirtyDaysAgo).order('created_at', { ascending: false }).limit(5),
    supabase.from('jobs').select('id, title, status, scheduled_start, customer:customers(name)')
      .eq('deleted', false).eq('status', 'scheduled').gte('scheduled_start', todayEnd)
      .order('scheduled_start').limit(5),
    supabase.from('message_logs').select('*', { count: 'exact', head: true })
      .eq('direction', 'inbound').eq('read', false),
    supabase.from('leads').select('id, title, source, created_at, customer:customers(name)')
      .eq('deleted', false).order('created_at', { ascending: false }).limit(5),
  ]);

  const monthRevenue = (recentPayments || []).reduce((sum, p) => sum + p.amount_cents, 0);

  return {
    pendingApprovals: pendingApprovals || 0,
    todaysJobs: todaysJobs || [],
    totalCustomers: totalCustomers || 0,
    monthRevenue,
    recentPayments: recentPayments || [],
    upcomingJobs: upcomingJobs || [],
    unreadMessages: unreadMessages || 0,
    recentLeads: recentLeads || [],
  };
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
};

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div>
      <Header title="Dashboard" />

      <div className="p-6 space-y-6">
        {/* Alerts */}
        {data.pendingApprovals > 0 && (
          <Link href="/approvals">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3 hover:bg-yellow-100 transition-colors cursor-pointer">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <div className="flex-1">
                <div className="font-medium text-yellow-800">
                  {data.pendingApprovals} action{data.pendingApprovals !== 1 ? 's' : ''} need your approval
                </div>
                <div className="text-sm text-yellow-700">
                  Review before they can execute
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-yellow-600" />
            </div>
          </Link>
        )}

        {data.unreadMessages > 0 && (
          <Link href="/texts">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3 hover:bg-blue-100 transition-colors cursor-pointer">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              <div className="flex-1">
                <div className="font-medium text-blue-800">
                  {data.unreadMessages} unread message{data.unreadMessages !== 1 ? 's' : ''}
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-blue-600" />
            </div>
          </Link>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{formatCents(data.monthRevenue)}</div>
                <div className="text-sm text-slate-500">Revenue (30d)</div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{data.todaysJobs.length}</div>
                <div className="text-sm text-slate-500">Today&apos;s Jobs</div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{data.totalCustomers}</div>
                <div className="text-sm text-slate-500">Customers</div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{data.pendingApprovals}</div>
                <div className="text-sm text-slate-500">Pending Approvals</div>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Schedule */}
          <Card padding="none">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Today&apos;s Schedule</h2>
              <Link href="/jobs" className="text-sm text-blue-600 hover:underline">View all</Link>
            </div>
            <div className="divide-y divide-slate-100">
              {data.todaysJobs.length === 0 && (
                <div className="p-6 text-center text-slate-500">No jobs scheduled today</div>
              )}
              {data.todaysJobs.map((job: any) => (
                <Link key={job.id} href={`/jobs/${job.id}`}>
                  <div className="px-6 py-3 hover:bg-slate-50 flex items-center gap-3">
                    <div className="text-sm font-medium text-slate-500 w-16">
                      {job.scheduled_start && new Date(job.scheduled_start).toLocaleTimeString('en-US', {
                        hour: 'numeric', minute: '2-digit',
                      })}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate">{job.title}</div>
                      <div className="text-sm text-slate-500">{job.customer?.name}</div>
                    </div>
                    <Badge className={statusColors[job.status] || 'bg-slate-100 text-slate-800'}>
                      {job.status?.replace('_', ' ')}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          {/* Recent Leads */}
          <Card padding="none">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Recent Leads</h2>
              <Link href="/pipeline" className="text-sm text-blue-600 hover:underline">Pipeline</Link>
            </div>
            <div className="divide-y divide-slate-100">
              {data.recentLeads.length === 0 && (
                <div className="p-6 text-center text-slate-500">No recent leads</div>
              )}
              {data.recentLeads.map((lead: any) => (
                <div key={lead.id} className="px-6 py-3 flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <Phone className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 truncate">{lead.title}</div>
                    <div className="text-sm text-slate-500">
                      {lead.customer?.name || 'Unknown'} • {lead.source}
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">{formatRelativeTime(lead.created_at)}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Upcoming Jobs */}
          <Card padding="none">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Upcoming</h2>
              <Link href="/jobs?status=scheduled" className="text-sm text-blue-600 hover:underline">View all</Link>
            </div>
            <div className="divide-y divide-slate-100">
              {data.upcomingJobs.map((job: any) => (
                <Link key={job.id} href={`/jobs/${job.id}`}>
                  <div className="px-6 py-3 hover:bg-slate-50 flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate">{job.title}</div>
                      <div className="text-sm text-slate-500">
                        {job.customer?.name} • {job.scheduled_start && new Date(job.scheduled_start).toLocaleDateString('en-US', {
                          weekday: 'short', month: 'short', day: 'numeric',
                        })}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          {/* Recent Payments */}
          <Card padding="none">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Recent Payments</h2>
              <Link href="/payments" className="text-sm text-blue-600 hover:underline">View all</Link>
            </div>
            <div className="divide-y divide-slate-100">
              {data.recentPayments.length === 0 && (
                <div className="p-6 text-center text-slate-500">No recent payments</div>
              )}
              {data.recentPayments.map((payment: any) => (
                <div key={payment.id} className="px-6 py-3 flex items-center gap-3">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900">{formatCents(payment.amount_cents)}</div>
                    <div className="text-sm text-slate-500 truncate">{payment.job?.title || 'Payment'}</div>
                  </div>
                  <span className="text-xs text-slate-400">{formatRelativeTime(payment.created_at)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
