// Murray's FSM - Customer Portal
// ===============================
// Self-service portal for customers to view jobs, approve estimates, and track service

import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  cn,
  formatCents,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatScheduleLabel,
  jobStatusConfig,
  serviceCategoryConfig,
} from '@/lib/utils';
import {
  Briefcase,
  FileText,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowRight,
  Phone,
  Wrench,
  Plus,
} from 'lucide-react';
import { notFound } from 'next/navigation';

// ---------- Types matching the live DB schema ----------

interface Job {
  id: string;
  job_number: string;
  customer_name: string | null;
  phone_e164: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
  service_category: string;
  urgency: string;
  issue_description: string | null;
  scheduled_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Estimate {
  id: string;
  job_id: string;
  estimate_number: string;
  status: string;
  total_cents: number;
  notes: string | null;
  valid_until: string | null;
  sent_at: string | null;
  created_at: string;
}

interface PortalToken {
  id: string;
  customer_phone: string;
  token: string;
  expires_at: string;
  created_at: string;
}

// ---------- Estimate status config ----------

const estimateStatusConfig: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }> = {
  draft: { label: 'Draft', variant: 'default' },
  sent: { label: 'Awaiting Approval', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  declined: { label: 'Declined', variant: 'danger' },
  expired: { label: 'Expired', variant: 'default' },
};

// ---------- Job status badge variant mapping ----------

const jobStatusVariant: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  new: 'info',
  contacted: 'info',
  scheduled: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'danger',
  spam: 'default',
};

// Active job statuses (shown in the status tracker)
const ACTIVE_STATUSES = ['new', 'contacted', 'scheduled', 'in_progress'];

// Job status progression for the timeline
const STATUS_STEPS = [
  { key: 'new', label: 'Received' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

// ---------- Data fetching ----------

async function getPortalData(token: string) {
  const supabase = createClient();

  // 1. Verify token from customer_portal_tokens
  const { data: portalToken } = await supabase
    .from('customer_portal_tokens')
    .select('id, customer_phone, token, expires_at, created_at')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (!portalToken) return null;

  const customerPhone = portalToken.customer_phone;

  // 2. Get all jobs for this customer by phone_e164
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, job_number, customer_name, phone_e164, email, city, address, service_category, urgency, issue_description, scheduled_at, status, created_at, updated_at')
    .eq('phone_e164', customerPhone)
    .order('created_at', { ascending: false })
    .limit(50);

  const allJobs: Job[] = jobs || [];

  // 3. Get estimates for customer's jobs
  let estimates: (Estimate & { job_number: string; service_category: string })[] = [];
  if (allJobs.length > 0) {
    const jobIds = allJobs.map(j => j.id);
    const { data: estimateRows } = await supabase
      .from('estimates')
      .select('id, job_id, estimate_number, status, total_cents, notes, valid_until, sent_at, created_at')
      .in('job_id', jobIds)
      .order('created_at', { ascending: false });

    if (estimateRows) {
      const jobMap = new Map(allJobs.map(j => [j.id, j]));
      estimates = estimateRows.map(e => ({
        ...e,
        job_number: jobMap.get(e.job_id)?.job_number || '',
        service_category: jobMap.get(e.job_id)?.service_category || 'general',
      }));
    }
  }

  // Derive the customer name from the most recent job
  const customerName = allJobs.find(j => j.customer_name)?.customer_name || 'Customer';

  return {
    customerPhone,
    customerName,
    jobs: allJobs,
    estimates,
  };
}

// ---------- Page component ----------

export default async function CustomerPortalPage({
  params,
}: {
  params: { token: string };
}) {
  const data = await getPortalData(params.token);

  if (!data) {
    notFound();
  }

  const { customerPhone, customerName, jobs, estimates } = data;

  // Derived data
  const activeJobs = jobs.filter(j => ACTIVE_STATUSES.includes(j.status));
  const completedJobs = jobs.filter(j => j.status === 'completed');
  const actionableEstimates = estimates.filter(e => e.status === 'sent');
  const allEstimates = estimates.filter(e => e.status !== 'draft');

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 border-t-4 border-t-primary-800">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-800 flex items-center justify-center text-white font-bold">
              M
            </div>
            <div>
              <h1 className="font-semibold text-slate-900">Murray&apos;s FSM</h1>
              <p className="text-sm text-slate-500">Customer Portal</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="text-slate-900 font-medium">Welcome, {customerName}</p>
            <p className="text-slate-500">{customerPhone}</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{activeJobs.length}</div>
                <div className="text-sm text-slate-500">Active Jobs</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-50">
                <FileText className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{actionableEstimates.length}</div>
                <div className="text-sm text-slate-500">Pending Estimates</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <Briefcase className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{completedJobs.length}</div>
                <div className="text-sm text-slate-500">Completed</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Action Required Banner */}
        {actionableEstimates.length > 0 && (
          <Card className="p-4 bg-amber-50 border-amber-200">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="flex-1">
                <h3 className="font-medium text-amber-800">Action Required</h3>
                <p className="text-sm text-amber-700">
                  You have {actionableEstimates.length} estimate{actionableEstimates.length > 1 ? 's' : ''} awaiting your approval.
                </p>
              </div>
              <a href="#estimates">
                <Button size="sm" variant="outline">
                  View Estimates
                </Button>
              </a>
            </div>
          </Card>
        )}

        {/* Active Job Status Tracking */}
        {activeJobs.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Active Jobs</h2>
            <div className="space-y-4">
              {activeJobs.map((job) => {
                const categoryInfo = serviceCategoryConfig[job.service_category] || serviceCategoryConfig.general;
                const statusInfo = jobStatusConfig[job.status] || jobStatusConfig.new;
                const currentStepIndex = STATUS_STEPS.findIndex(s => s.key === job.status);

                return (
                  <Card key={job.id} padding="none">
                    {/* Job header */}
                    <div className="p-4 border-b border-slate-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-slate-50">
                            <Wrench className="w-5 h-5 text-slate-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-slate-900">
                                Job #{job.job_number}
                              </h3>
                              <Badge className={categoryInfo.color}>
                                {categoryInfo.label}
                              </Badge>
                            </div>
                            {job.issue_description && (
                              <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">
                                {job.issue_description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={jobStatusVariant[job.status] || 'default'}>
                            {statusInfo.label}
                          </Badge>
                          {job.scheduled_at && (
                            <p className="text-xs text-slate-500 mt-1">
                              {formatScheduleLabel(job.scheduled_at)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status timeline */}
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        {STATUS_STEPS.map((step, i) => {
                          const isCompleted = i < currentStepIndex;
                          const isCurrent = i === currentStepIndex;
                          const isFuture = i > currentStepIndex;

                          return (
                            <div key={step.key} className="flex items-center flex-1 last:flex-none">
                              <div className="flex flex-col items-center">
                                <div
                                  className={cn(
                                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium',
                                    isCompleted && 'bg-green-500 text-white',
                                    isCurrent && 'bg-primary-800 text-white ring-2 ring-primary-200',
                                    isFuture && 'bg-slate-200 text-slate-400'
                                  )}
                                >
                                  {isCompleted ? (
                                    <CheckCircle className="w-4 h-4" />
                                  ) : (
                                    i + 1
                                  )}
                                </div>
                                <span
                                  className={cn(
                                    'text-[10px] mt-1 whitespace-nowrap',
                                    isCurrent ? 'text-slate-900 font-medium' : 'text-slate-400'
                                  )}
                                >
                                  {step.label}
                                </span>
                              </div>
                              {i < STATUS_STEPS.length - 1 && (
                                <div
                                  className={cn(
                                    'flex-1 h-0.5 mx-1 mt-[-14px]',
                                    i < currentStepIndex ? 'bg-green-400' : 'bg-slate-200'
                                  )}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Job details row */}
                    <div className="px-4 pb-3 flex items-center gap-4 text-xs text-slate-500">
                      {job.city && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {job.city}
                        </span>
                      )}
                      <span>Created {formatRelativeTime(job.created_at)}</span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Estimates Section */}
        {allEstimates.length > 0 && (
          <section id="estimates">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Estimates</h2>
            <div className="space-y-3">
              {allEstimates.map((estimate) => {
                const estConfig = estimateStatusConfig[estimate.status] || estimateStatusConfig.draft;
                const categoryInfo = serviceCategoryConfig[estimate.service_category] || serviceCategoryConfig.general;
                const isActionable = estimate.status === 'sent';
                const isExpired = estimate.valid_until && new Date(estimate.valid_until) < new Date();

                return (
                  <Card key={estimate.id} className={cn('p-4', isActionable && 'border-amber-200 bg-amber-50/30')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn('p-2 rounded-lg', isActionable ? 'bg-amber-100' : 'bg-slate-50')}>
                          <FileText className={cn('w-5 h-5', isActionable ? 'text-amber-600' : 'text-slate-500')} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-slate-900">
                              Estimate #{estimate.estimate_number}
                            </h3>
                            <Badge className={categoryInfo.color}>
                              {categoryInfo.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-slate-500 mt-0.5">
                            <span>Job #{estimate.job_number}</span>
                            {estimate.valid_until && (
                              <span>
                                {isExpired
                                  ? 'Expired'
                                  : `Valid until ${formatDate(estimate.valid_until)}`}
                              </span>
                            )}
                            {estimate.sent_at && (
                              <span>Sent {formatRelativeTime(estimate.sent_at)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <span className="text-lg font-semibold text-slate-900">
                            {formatCents(estimate.total_cents)}
                          </span>
                          <div className="mt-0.5">
                            <Badge variant={estConfig.variant}>
                              {estConfig.label}
                            </Badge>
                          </div>
                        </div>
                        {isActionable && !isExpired && (
                          <div className="flex gap-2">
                            <Button size="sm" variant="danger">
                              Decline
                            </Button>
                            <Button size="sm" variant="primary">
                              Approve
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Job History */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Service History</h2>
          {jobs.length === 0 ? (
            <Card className="p-8 text-center">
              <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No service history yet.</p>
            </Card>
          ) : (
            <Card padding="none">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                      Job
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                      Service
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                      Scheduled
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                      Location
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jobs.map((job) => {
                    const categoryInfo = serviceCategoryConfig[job.service_category] || serviceCategoryConfig.general;
                    const statusInfo = jobStatusConfig[job.status] || jobStatusConfig.new;
                    return (
                      <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">#{job.job_number}</div>
                          {job.issue_description && (
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1 max-w-[200px]">
                              {job.issue_description}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={categoryInfo.color}>{categoryInfo.label}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={jobStatusVariant[job.status] || 'default'}>
                            {statusInfo.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {job.scheduled_at
                            ? formatScheduleLabel(job.scheduled_at)
                            : <span className="text-slate-400">Not scheduled</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {job.city || <span className="text-slate-400">&mdash;</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </section>

        {/* Book New Service CTA */}
        <Card className="p-6 text-center">
          <div className="flex flex-col items-center">
            <div className="p-3 rounded-full bg-primary-50 mb-3">
              <Plus className="w-6 h-6 text-primary-800" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Need Service?</h3>
            <p className="text-slate-500 mb-4">Schedule a new appointment or request a quote</p>
            <a href="/book">
              <Button size="lg">
                Book New Service
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </a>
          </div>
        </Card>

        {/* Contact */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-slate-900">Need Help?</h3>
              <p className="text-sm text-slate-500">
                Give us a call if you have any questions about your service.
              </p>
            </div>
            <a href="tel:+1" className="shrink-0">
              <Button variant="outline" size="sm">
                <Phone className="w-4 h-4" />
                Call Us
              </Button>
            </a>
          </div>
        </Card>
      </main>

      {/* Footer */}
      <footer className="mt-12 py-6 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-6 text-center text-sm text-slate-500">
          <p>Powered by Murray&apos;s FSM</p>
        </div>
      </footer>
    </div>
  );
}
