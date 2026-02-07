// Murray's FSM - Jobs Page
// ==========================

import { createAdminClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatScheduleLabel, jobStatusConfig, formatPhone } from '@/lib/utils';
import { Calendar, MapPin, Phone, Plus, User } from 'lucide-react';
import Link from 'next/link';

// Actual database job type
interface DbJob {
  id: string;
  job_number: number;
  phone_number: string;
  phone_e164: string;
  customer_name: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
  zip_code: string | null;
  service_category: string;
  urgency: string;
  issue_description: string | null;
  preferred_time: string | null;
  scheduled_at: string | null;
  status: string;
  is_spam: boolean;
  spam_reason: string | null;
  extraction_confidence: number | null;
  recommended_action: string | null;
  source_event_id: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

async function getJobs(): Promise<DbJob[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('is_spam', false)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching jobs:', error);
    return [];
  }

  return data || [];
}

export default async function JobsPage() {
  const jobs = await getJobs();

  const stats = {
    total: jobs.length,
    new: jobs.filter((j) => j.status === 'new').length,
    scheduled: jobs.filter((j) => j.status === 'scheduled').length,
    inProgress: jobs.filter((j) => j.status === 'in_progress').length,
    completed: jobs.filter((j) => j.status === 'completed').length,
  };

  return (
    <div>
      <Header title="Jobs" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="text-sm text-slate-500">Total Jobs</div>
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">New</div>
            <div className="text-2xl font-bold text-purple-600">{stats.new}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">Scheduled</div>
            <div className="text-2xl font-bold text-blue-600">{stats.scheduled}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">In Progress</div>
            <div className="text-2xl font-bold text-yellow-600">{stats.inProgress}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">Completed</div>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </Card>
        </div>

        {/* Jobs Table */}
        <Card padding="none">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">All Jobs</h2>
            <Link href="/jobs/new">
              <Button size="sm">
                <Plus className="w-4 h-4" />
                New Job
              </Button>
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Job #
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Service
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Schedule
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Urgency
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {jobs.map((job) => {
                  const statusConfig = jobStatusConfig[job.status] || { label: job.status, color: 'bg-gray-100 text-gray-800' };
                  const urgencyColors: Record<string, string> = {
                    low: 'bg-gray-100 text-gray-800',
                    medium: 'bg-blue-100 text-blue-800',
                    high: 'bg-orange-100 text-orange-800',
                    emergency: 'bg-red-100 text-red-800',
                  };
                  return (
                    <tr key={job.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">#{job.job_number}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-slate-900 flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" />
                            {job.customer_name || 'Unknown'}
                          </div>
                          {job.phone_number && (
                            <div className="text-sm text-slate-500 flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {formatPhone(job.phone_number)}
                            </div>
                          )}
                          {job.city && (
                            <div className="text-sm text-slate-500 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {job.city}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-900 capitalize">
                          {job.service_category?.replace(/_/g, ' ') || 'General'}
                        </div>
                        {job.issue_description && (
                          <div className="text-xs text-slate-500 truncate max-w-[200px]">
                            {job.issue_description}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-900 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {formatScheduleLabel(job.scheduled_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={urgencyColors[job.urgency] || urgencyColors.medium}>
                          {job.urgency}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/jobs/${job.id}`}
                          className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}

                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      No jobs found. Jobs will appear here when they are created from incoming calls or manually added.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
