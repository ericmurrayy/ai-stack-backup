// Murray's FSM - Recurring Jobs Page
// ====================================

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatRelativeTime } from '@/lib/utils';
import {
  Repeat,
  Calendar,
  Clock,
  User,
  Plus,
  Play,
  Pause,
  MoreVertical,
} from 'lucide-react';
import Link from 'next/link';

interface RecurringJobCustomer {
  name: string;
}

interface RecurringJob {
  id: string;
  owner_id: string;
  customer_id: string;
  location_id: string | null;
  title: string;
  service_type: string | null;
  description: string | null;
  rrule: string;
  duration_minutes: number;
  assigned_technician_id: string | null;
  line_items_template: any;
  next_occurrence_at: string | null;
  last_generated_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted: boolean;
  customer: RecurringJobCustomer | null;
}

interface RecurringJobsStats {
  total: number;
  active: number;
  paused: number;
  dueToday: number;
}

// Parse RRULE string to human-readable format
function parseRRuleDisplay(rrule: string): string {
  if (!rrule) return 'Unknown';

  const parts: Record<string, string> = {};
  rrule
    .replace(/^RRULE:/, '')
    .split(';')
    .forEach((part) => {
      const [key, value] = part.split('=');
      if (key && value) {
        parts[key] = value;
      }
    });

  const freq = parts['FREQ'];
  const interval = parts['INTERVAL'] ? parseInt(parts['INTERVAL'], 10) : 1;
  const byDay = parts['BYDAY'];

  let label = '';

  switch (freq) {
    case 'DAILY':
      label = interval > 1 ? `Every ${interval} days` : 'Daily';
      break;
    case 'WEEKLY':
      if (interval > 1) {
        label = `Every ${interval} weeks`;
      } else {
        label = 'Weekly';
      }
      if (byDay) {
        const dayMap: Record<string, string> = {
          MO: 'Mon',
          TU: 'Tue',
          WE: 'Wed',
          TH: 'Thu',
          FR: 'Fri',
          SA: 'Sat',
          SU: 'Sun',
        };
        const days = byDay
          .split(',')
          .map((d) => dayMap[d] || d)
          .join(', ');
        label += ` (${days})`;
      }
      break;
    case 'MONTHLY':
      label = interval > 1 ? `Every ${interval} months` : 'Monthly';
      break;
    case 'YEARLY':
      label = interval > 1 ? `Every ${interval} years` : 'Yearly';
      break;
    default:
      label = rrule;
  }

  return label;
}

async function getRecurringJobsData(): Promise<{
  jobs: RecurringJob[];
  stats: RecurringJobsStats;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('recurring_jobs')
    .select(`
      *,
      customer:customers(name)
    `)
    .eq('deleted', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching recurring jobs:', error);
    return {
      jobs: [],
      stats: { total: 0, active: 0, paused: 0, dueToday: 0 },
    };
  }

  const jobs: RecurringJob[] = data || [];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const stats: RecurringJobsStats = {
    total: jobs.length,
    active: jobs.filter((j) => j.is_active).length,
    paused: jobs.filter((j) => !j.is_active).length,
    dueToday: jobs.filter((j) => {
      if (!j.next_occurrence_at || !j.is_active) return false;
      const next = new Date(j.next_occurrence_at);
      return next >= todayStart && next < todayEnd;
    }).length,
  };

  return { jobs, stats };
}

function RecurringJobCard({ job }: { job: RecurringJob }) {
  const durationHours = job.duration_minutes / 60;
  const durationLabel =
    durationHours % 1 === 0
      ? `${durationHours}h`
      : `${durationHours.toFixed(1)}h`;

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className={`p-2.5 rounded-lg ${
            job.is_active ? 'bg-green-50' : 'bg-yellow-50'
          }`}
        >
          <Repeat
            className={`w-5 h-5 ${
              job.is_active ? 'text-green-600' : 'text-yellow-600'
            }`}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900 truncate">
              {job.title}
            </h3>
            <Badge variant={job.is_active ? 'success' : 'warning'}>
              {job.is_active ? 'Active' : 'Paused'}
            </Badge>
          </div>

          {job.customer && (
            <div className="flex items-center gap-1.5 mt-1 text-sm text-slate-500">
              <User className="w-3.5 h-3.5" />
              {job.customer.name}
            </div>
          )}

          {job.service_type && (
            <div className="text-sm text-slate-400 mt-0.5">
              {job.service_type}
            </div>
          )}

          {/* Details row */}
          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-slate-600">
            <span className="flex items-center gap-1.5">
              <Repeat className="w-3.5 h-3.5 text-slate-400" />
              {parseRRuleDisplay(job.rrule)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {durationLabel}
            </span>
          </div>

          {/* Dates row */}
          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm">
            {job.next_occurrence_at && (
              <span className="flex items-center gap-1.5 text-slate-600">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                Next: {formatRelativeTime(job.next_occurrence_at)}
              </span>
            )}
            {job.last_generated_at && (
              <span className="flex items-center gap-1.5 text-slate-400">
                <Calendar className="w-3.5 h-3.5" />
                Last generated: {formatRelativeTime(job.last_generated_at)}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            title={job.is_active ? 'Pause' : 'Resume'}
          >
            {job.is_active ? (
              <Pause className="w-4 h-4 text-yellow-500" />
            ) : (
              <Play className="w-4 h-4 text-green-500" />
            )}
          </button>
          <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <MoreVertical className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </div>
    </Card>
  );
}

export default async function RecurringJobsPage() {
  const { jobs, stats } = await getRecurringJobsData();

  return (
    <div>
      <Header title="Recurring Jobs" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Repeat className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">
                  {stats.total}
                </div>
                <div className="text-sm text-slate-500">Total Recurring</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <Play className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {stats.active}
                </div>
                <div className="text-sm text-slate-500">Active</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-50">
                <Pause className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">
                  {stats.paused}
                </div>
                <div className="text-sm text-slate-500">Paused</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {stats.dueToday}
                </div>
                <div className="text-sm text-slate-500">Due Today</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Filter & Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
              All ({stats.total})
            </button>
            <button className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg">
              Active ({stats.active})
            </button>
            <button className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg">
              Paused ({stats.paused})
            </button>
          </div>
          <Link href="/recurring/new">
            <button className="px-4 py-2 text-sm font-medium text-white bg-primary-800 rounded-lg hover:bg-primary-900 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New Recurring Job
            </button>
          </Link>
        </div>

        {/* Recurring Jobs List */}
        {jobs.length > 0 ? (
          <div className="space-y-4">
            {jobs.map((job) => (
              <RecurringJobCard key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Repeat className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Set up recurring maintenance
            </h3>
            <p className="text-slate-500 mb-4">
              Create recurring jobs for scheduled maintenance, inspections, and
              repeat service visits
            </p>
            <Link href="/recurring/new">
              <button className="px-4 py-2 text-sm font-medium text-white bg-primary-800 rounded-lg hover:bg-primary-900">
                Create Your First Recurring Job
              </button>
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
}
