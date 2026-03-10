// Murray's FSM - Jobs Page
// ==========================

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatScheduleLabel, jobStatusConfig, serviceCategoryConfig, urgencyConfig } from '@/lib/utils';
import { Calendar, Plus, User, Wrench } from 'lucide-react';
import Link from 'next/link';

interface JobTechnician {
  id: string;
  name: string;
  color: string | null;
}

interface JobRow {
  id: string;
  job_number: string | null;
  customer_name: string | null;
  city: string | null;
  service_category: string | null;
  urgency: string | null;
  scheduled_at: string | null;
  status: string;
  assigned_technician_id: string | null;
  created_at: string;
  technician: JobTechnician | null;
}

async function getJobs(): Promise<JobRow[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('jobs')
    .select('*, technician:technicians(id, name, color)')
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
            <div className="text-2xl font-bold text-blue-600">{stats.new}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">Scheduled</div>
            <div className="text-2xl font-bold text-cyan-600">{stats.scheduled}</div>
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
                    Job
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Urgency
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Schedule
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Technician
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {jobs.map((job) => {
                  const statusCfg = jobStatusConfig[job.status] || {
                    label: job.status,
                    color: 'bg-gray-100 text-gray-800',
                  };
                  const categoryCfg = job.service_category
                    ? serviceCategoryConfig[job.service_category]
                    : null;
                  const urgencyCfg = job.urgency
                    ? urgencyConfig[job.urgency]
                    : null;

                  return (
                    <tr key={job.id} className="hover:bg-slate-50">
                      {/* Job */}
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">
                          {job.job_number || 'No number'}
                        </div>
                        {categoryCfg && (
                          <Badge className={`mt-1 ${categoryCfg.color}`}>
                            {categoryCfg.label}
                          </Badge>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-slate-900">
                          {job.customer_name || 'Unknown'}
                        </div>
                        {job.city && (
                          <div className="text-sm text-slate-500">{job.city}</div>
                        )}
                      </td>

                      {/* Urgency */}
                      <td className="px-6 py-4">
                        {urgencyCfg ? (
                          <Badge className={urgencyCfg.color}>{urgencyCfg.label}</Badge>
                        ) : (
                          <span className="text-slate-400 text-sm">-</span>
                        )}
                      </td>

                      {/* Schedule */}
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-900 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {formatScheduleLabel(job.scheduled_at)}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <Badge className={statusCfg.color}>{statusCfg.label}</Badge>
                      </td>

                      {/* Technician */}
                      <td className="px-6 py-4">
                        {job.technician ? (
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{
                                backgroundColor: job.technician.color || '#94a3b8',
                              }}
                            />
                            <span className="text-sm text-slate-900">
                              {job.technician.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">Unassigned</span>
                        )}
                      </td>

                      {/* Actions */}
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
                      No jobs found
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
