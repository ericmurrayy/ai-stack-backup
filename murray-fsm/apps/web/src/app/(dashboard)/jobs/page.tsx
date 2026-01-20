// Murray's FSM - Jobs Page
// ==========================

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatScheduleLabel, formatCents, jobStatusConfig } from '@/lib/utils';
import { Calendar, MapPin, Clock, DollarSign, Plus } from 'lucide-react';
import Link from 'next/link';
import type { Job, Customer, Location } from '@/types/database';

interface JobWithRelations extends Job {
  customer: Customer | null;
  location: Location | null;
}

async function getJobs(): Promise<JobWithRelations[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('jobs')
    .select(`
      *,
      customer:customers(*),
      location:locations(*)
    `)
    .eq('deleted', false)
    .order('scheduled_start', { ascending: true, nullsFirst: false })
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
    scheduled: jobs.filter((j) => j.status === 'scheduled').length,
    inProgress: jobs.filter((j) => j.status === 'in_progress').length,
    completed: jobs.filter((j) => j.status === 'completed').length,
  };

  return (
    <div>
      <Header title="Jobs" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-sm text-slate-500">Total Jobs</div>
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
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
            <Button size="sm">
              <Plus className="w-4 h-4" />
              New Job
            </Button>
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
                    Schedule
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {jobs.map((job) => {
                  const statusConfig = jobStatusConfig[job.status];
                  return (
                    <tr key={job.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{job.title}</div>
                        {job.service_type && (
                          <div className="text-sm text-slate-500">{job.service_type}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {job.customer ? (
                          <div>
                            <div className="text-sm font-medium text-slate-900">
                              {job.customer.name}
                            </div>
                            {job.location && (
                              <div className="text-sm text-slate-500 flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {job.location.city}, {job.location.state}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">No customer</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-900 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {formatScheduleLabel(job.scheduled_start)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          {job.total_invoice_cents > 0 ? (
                            <div>
                              <div className="font-medium text-slate-900">
                                {formatCents(job.total_invoice_cents)}
                              </div>
                              {job.paid_cents > 0 && (
                                <div className="text-green-600 text-xs">
                                  Paid: {formatCents(job.paid_cents)}
                                </div>
                              )}
                            </div>
                          ) : job.total_estimate_cents > 0 ? (
                            <div className="text-slate-500">
                              Est: {formatCents(job.total_estimate_cents)}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </div>
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
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
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
