// Murray's FSM - Customer Portal
// ===============================
// Self-service portal for customers to view jobs, approve estimates, pay invoices

import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCents, formatRelativeTime } from '@/lib/utils';
import {
  Briefcase,
  FileText,
  CreditCard,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  Download,
  MessageSquare,
  Star,
} from 'lucide-react';
import { notFound } from 'next/navigation';
import { EstimateActions, PayButton, PayNowButton } from './PortalActions';

interface PortalData {
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  business: {
    name: string;
    phone: string;
    email: string;
    logo_url?: string;
    primary_color: string;
  };
  jobs: Array<{
    id: string;
    title: string;
    status: string;
    scheduled_start: string;
    total_invoice_cents: number;
    paid_cents: number;
  }>;
  estimates: Array<{
    id: string;
    job_id: string;
    job_title: string;
    total_estimate_cents: number;
    created_at: string;
  }>;
  invoices: Array<{
    id: string;
    job_id: string;
    job_title: string;
    total_invoice_cents: number;
    paid_cents: number;
  }>;
}

async function getPortalData(token: string): Promise<PortalData | null> {
  const supabase = createClient();

  // Verify token and get customer
  const { data: portalToken } = await supabase
    .from('customer_portal_tokens')
    .select('*, customer:customers(*)')
    .eq('token', token)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (!portalToken) return null;

  const customerId = portalToken.customer_id;
  const ownerId = portalToken.customer.owner_id;

  // Get business settings
  const { data: business } = await supabase
    .from('business_settings')
    .select('business_name, business_phone, business_email, business_logo_url, primary_color')
    .eq('owner_id', ownerId)
    .single();

  // Get jobs
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title, status, scheduled_start, total_invoice_cents, paid_cents')
    .eq('customer_id', customerId)
    .eq('deleted', false)
    .order('scheduled_start', { ascending: false })
    .limit(10);

  // Get pending estimates: jobs with estimate line_items but no invoice created yet
  const { data: jobsWithEstimates } = await supabase
    .from('jobs')
    .select(`
      id, title, total_estimate_cents, total_invoice_cents,
      line_items!inner(id, total_cents, created_at)
    `)
    .eq('customer_id', customerId)
    .eq('deleted', false)
    .eq('line_items.kind', 'estimate')
    .eq('line_items.deleted', false)
    .gt('total_estimate_cents', 0)
    .eq('total_invoice_cents', 0);

  const estimates = (jobsWithEstimates || []).map(job => ({
    id: job.line_items[0]?.id || job.id,
    job_id: job.id,
    job_title: job.title,
    total_estimate_cents: job.total_estimate_cents,
    created_at: job.line_items[0]?.created_at,
  }));

  // Get unpaid invoices: jobs with invoice total > paid
  const { data: jobsWithInvoices } = await supabase
    .from('jobs')
    .select('id, title, total_invoice_cents, paid_cents')
    .eq('customer_id', customerId)
    .eq('deleted', false)
    .gt('total_invoice_cents', 0);

  const invoices = (jobsWithInvoices || [])
    .filter(job => job.total_invoice_cents > (job.paid_cents || 0))
    .map(job => ({
      id: job.id,
      job_id: job.id,
      job_title: job.title,
      total_invoice_cents: job.total_invoice_cents,
      paid_cents: job.paid_cents || 0,
    }));

  // Update last accessed
  await supabase
    .from('customer_portal_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('token', token);

  return {
    customer: {
      id: portalToken.customer.id,
      name: portalToken.customer.name,
      email: portalToken.customer.email,
      phone: portalToken.customer.phone,
    },
    business: {
      name: business?.business_name || 'Service Provider',
      phone: business?.business_phone || '',
      email: business?.business_email || '',
      logo_url: business?.business_logo_url,
      primary_color: business?.primary_color || '#1e40af',
    },
    jobs: jobs || [],
    estimates,
    invoices,
  };
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  canceled: 'bg-red-100 text-red-800',
  pending: 'bg-orange-100 text-orange-800',
};

export default async function CustomerPortalPage({
  params,
}: {
  params: { token: string };
}) {
  const data = await getPortalData(params.token);

  if (!data) {
    notFound();
  }

  const { customer, business, jobs, estimates, invoices } = data;

  const upcomingJobs = jobs.filter(j => new Date(j.scheduled_start) > new Date());
  const pendingEstimates = estimates;
  const unpaidInvoices = invoices.filter(i => i.total_invoice_cents > i.paid_cents);
  const totalOwed = unpaidInvoices.reduce((sum, i) => sum + (i.total_invoice_cents - i.paid_cents), 0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header
        className="bg-white border-b border-slate-200 px-6 py-4"
        style={{ borderTopColor: business.primary_color, borderTopWidth: '4px' }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {business.logo_url ? (
              <img src={business.logo_url} alt={business.name} className="h-10" />
            ) : (
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: business.primary_color }}
              >
                {business.name.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="font-semibold text-slate-900">{business.name}</h1>
              <p className="text-sm text-slate-500">Customer Portal</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="text-slate-900 font-medium">Welcome, {customer.name}</p>
            <p className="text-slate-500">{customer.email}</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{upcomingJobs.length}</div>
                <div className="text-sm text-slate-500">Upcoming</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-50">
                <FileText className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{pendingEstimates.length}</div>
                <div className="text-sm text-slate-500">Pending Estimates</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-50">
                <CreditCard className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{unpaidInvoices.length}</div>
                <div className="text-sm text-slate-500">Unpaid Invoices</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <Briefcase className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{jobs.length}</div>
                <div className="text-sm text-slate-500">Total Jobs</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Action Required */}
        {(pendingEstimates.length > 0 || totalOwed > 0) && (
          <Card className="p-4 bg-amber-50 border-amber-200">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <div className="flex-1">
                <h3 className="font-medium text-amber-800">Action Required</h3>
                <p className="text-sm text-amber-700">
                  {pendingEstimates.length > 0 && `${pendingEstimates.length} estimate(s) awaiting your approval. `}
                  {totalOwed > 0 && `Outstanding balance: ${formatCents(totalOwed)}`}
                </p>
              </div>
              {totalOwed > 0 && (
                <PayNowButton
                  token={params.token}
                  jobIds={unpaidInvoices.map(i => i.job_id)}
                  primaryColor={business.primary_color}
                  label="Pay Now"
                />
              )}
            </div>
          </Card>
        )}

        {/* Pending Estimates */}
        {pendingEstimates.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Estimates Awaiting Approval</h2>
            <div className="space-y-3">
              {pendingEstimates.map((estimate) => (
                <Card key={estimate.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-slate-900">{estimate.job_title}</h3>
                      <p className="text-sm text-slate-500">
                        Sent {formatRelativeTime(estimate.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-semibold text-slate-900">
                        {formatCents(estimate.total_estimate_cents)}
                      </span>
                      <EstimateActions
                        token={params.token}
                        jobId={estimate.job_id}
                        primaryColor={business.primary_color}
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Unpaid Invoices */}
        {unpaidInvoices.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Invoices</h2>
            <Card padding="none">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                      Service
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                      Amount
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                      Paid
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                      Balance
                    </th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {unpaidInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-900">{invoice.job_title}</td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {formatCents(invoice.total_invoice_cents)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {formatCents(invoice.paid_cents)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {formatCents(invoice.total_invoice_cents - invoice.paid_cents)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PayButton
                          token={params.token}
                          jobId={invoice.job_id}
                          primaryColor={business.primary_color}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {/* Job History */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Service History</h2>
          <div className="space-y-3">
            {jobs.map((job) => (
              <Card key={job.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {job.status === 'completed' ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : job.status === 'in_progress' ? (
                      <Clock className="w-5 h-5 text-yellow-500" />
                    ) : (
                      <Calendar className="w-5 h-5 text-blue-500" />
                    )}
                    <div>
                      <h3 className="font-medium text-slate-900">{job.title}</h3>
                      <p className="text-sm text-slate-500">
                        {new Date(job.scheduled_start).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge className={statusColors[job.status] || 'bg-slate-100 text-slate-800'}>
                      {job.status.replace('_', ' ')}
                    </Badge>
                    {job.total_invoice_cents > 0 && (
                      <span className="font-medium text-slate-900">
                        {formatCents(job.total_invoice_cents)}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Book New Service */}
        <Card className="p-6 text-center">
          <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Need Service?</h3>
          <p className="text-slate-500 mb-4">Schedule a new appointment online</p>
          <button
            className="px-6 py-2 text-sm font-medium text-white rounded-lg"
            style={{ backgroundColor: business.primary_color }}
          >
            Book Appointment
          </button>
        </Card>

        {/* Contact */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-slate-900">Need Help?</h3>
              <p className="text-sm text-slate-500">
                Contact us at {business.phone} or {business.email}
              </p>
            </div>
            <button className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Message Us
            </button>
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
