// Murray's FSM - Jobs Page (with pagination)
// =============================================

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  formatScheduleLabel,
  jobStatusConfig,
  serviceCategoryConfig,
  urgencyConfig,
} from '@/lib/utils';
import { Calendar, Plus, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import Link from 'next/link';
import { JobsFilters } from '@/components/JobsFilters';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25; // matches DEFAULTS.PAGE_SIZE from @murray-fsm/shared

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface JobsResult {
  jobs: JobRow[];
  totalCount: number;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getJobs(opts: {
  page: number;
  status?: string;
  search?: string;
}): Promise<JobsResult> {
  const supabase = await createClient();

  const from = (opts.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('jobs')
    .select('*, technician:technicians(id, name, color)', { count: 'exact' })
    .eq('is_spam', false)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (opts.status && opts.status !== 'all') {
    query = query.eq('status', opts.status);
  }

  if (opts.search) {
    query = query.or(
      `customer_name.ilike.%${opts.search}%,job_number.ilike.%${opts.search}%,city.ilike.%${opts.search}%`
    );
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching jobs:', error);
    return { jobs: [], totalCount: 0 };
  }

  return {
    jobs: (data as JobRow[]) || [],
    totalCount: count ?? 0,
  };
}

async function getJobStats() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('jobs')
    .select('status')
    .eq('is_spam', false);

  if (error || !data) return { total: 0, new: 0, scheduled: 0, inProgress: 0, completed: 0 };
  return {
    total: data.length,
    new: data.filter((j) => j.status === 'new').length,
    scheduled: data.filter((j) => j.status === 'scheduled').length,
    inProgress: data.filter((j) => j.status === 'in_progress').length,
    completed: data.filter((j) => j.status === 'completed').length,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPaginationUrl(page: number, status: string, search: string): string {
  const p = new URLSearchParams();
  if (page > 1) p.set('page', String(page));
  if (status && status !== 'all') p.set('status', status);
  if (search) p.set('search', search);
  const qs = p.toString();
  return `/jobs${qs ? `?${qs}` : ''}`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; search?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page || '1', 10) || 1);
  const statusFilter = params.status || 'all';
  const searchQuery = params.search || '';

  const [{ jobs, totalCount }, stats] = await Promise.all([
    getJobs({ page: currentPage, status: statusFilter, search: searchQuery }),
    getJobStats(),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

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
            <div className="text-2xl font-bold text-yellow-600">
              {stats.inProgress}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">Completed</div>
            <div className="text-2xl font-bold text-green-600">
              {stats.completed}
            </div>
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

          {/* Search & Filter Bar */}
          <JobsFilters currentStatus={statusFilter} currentSearch={searchQuery} />

          {jobs.length === 0 ? (
            /* ---- Empty state ---- */
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 mb-4">
                <Inbox className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">
                No jobs found
              </h3>
              <p className="text-sm text-slate-500 mb-6 text-center max-w-xs">
                {currentPage > 1
                  ? 'There are no jobs on this page. Try going back to an earlier page.'
                  : 'No jobs match the current filters. Create a new job to get started.'}
              </p>
              {currentPage > 1 ? (
                <Link href="/jobs?page=1">
                  <Button variant="outline" size="sm">
                    <ChevronLeft className="w-4 h-4" />
                    Back to first page
                  </Button>
                </Link>
              ) : (
                <Link href="/jobs/new">
                  <Button size="sm">
                    <Plus className="w-4 h-4" />
                    Create Job
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            /* ---- Table ---- */
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
                            <div className="text-sm text-slate-500">
                              {job.city}
                            </div>
                          )}
                        </td>

                        {/* Urgency */}
                        <td className="px-6 py-4">
                          {urgencyCfg ? (
                            <Badge className={urgencyCfg.color}>
                              {urgencyCfg.label}
                            </Badge>
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
                          <Badge className={statusCfg.color}>
                            {statusCfg.label}
                          </Badge>
                        </td>

                        {/* Technician */}
                        <td className="px-6 py-4">
                          {job.technician ? (
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{
                                  backgroundColor:
                                    job.technician.color || '#94a3b8',
                                }}
                              />
                              <span className="text-sm text-slate-900">
                                {job.technician.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">
                              Unassigned
                            </span>
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
                </tbody>
              </table>
            </div>
          )}

          {/* ---- Pagination controls ---- */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
              {/* Showing range */}
              <p className="text-sm text-slate-500">
                Showing{' '}
                <span className="font-medium text-slate-700">
                  {(currentPage - 1) * PAGE_SIZE + 1}
                </span>
                {' '}-{' '}
                <span className="font-medium text-slate-700">
                  {Math.min(currentPage * PAGE_SIZE, totalCount)}
                </span>
                {' '}of{' '}
                <span className="font-medium text-slate-700">{totalCount}</span>{' '}
                jobs
              </p>

              {/* Page navigation */}
              <div className="flex items-center gap-2">
                {currentPage > 1 ? (
                  <Link href={buildPaginationUrl(currentPage - 1, statusFilter, searchQuery)}>
                    <Button variant="outline" size="sm">
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                  </Link>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                )}

                <span className="px-3 text-sm font-medium text-slate-700">
                  Page {currentPage} of {totalPages}
                </span>

                {currentPage < totalPages ? (
                  <Link href={buildPaginationUrl(currentPage + 1, statusFilter, searchQuery)}>
                    <Button variant="outline" size="sm">
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </Link>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
