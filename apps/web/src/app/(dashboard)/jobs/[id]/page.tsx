// Murray's FSM - Enhanced Job Detail Page
// ========================================

import { createAdminClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatPhone, formatDateTime, jobStatusConfig } from '@/lib/utils';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  User,
  Wrench,
  CheckCircle,
  Navigation,
  MessageSquare,
  PlayCircle,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JobActions } from './JobActions';
import { JobStatusWorkflow } from './JobStatusWorkflow';
import { JobQuoteInvoice } from './JobQuoteInvoice';

interface JobDetailProps {
  params: { id: string };
}

async function getJob(id: string) {
  const supabase = createAdminClient();

  const { data: job, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !job) {
    return null;
  }

  return job;
}

async function getJobRelatedData(jobId: string) {
  const supabase = createAdminClient();

  // Try to get quote and invoice for this job (may not exist if tables don't exist)
  const results: { quote: any; invoice: any } = { quote: null, invoice: null };

  try {
    const { data: quote } = await supabase
      .from('quotes')
      .select('id, quote_number, status, total')
      .eq('job_id', jobId)
      .maybeSingle();
    results.quote = quote;
  } catch (e) {
    // Table may not exist
  }

  try {
    const { data: invoice } = await supabase
      .from('invoices')
      .select('id, invoice_number, status, total')
      .eq('job_id', jobId)
      .maybeSingle();
    results.invoice = invoice;
  } catch (e) {
    // Table may not exist
  }

  return results;
}

export default async function JobDetailPage({ params }: JobDetailProps) {
  const job = await getJob(params.id);

  if (!job) {
    notFound();
  }

  const relatedData = await getJobRelatedData(params.id);

  const statusConfig = jobStatusConfig[job.status] || {
    label: job.status,
    color: 'bg-gray-100 text-gray-800',
  };

  const urgencyColors: Record<string, string> = {
    low: 'bg-gray-100 text-gray-800',
    medium: 'bg-blue-100 text-blue-800',
    high: 'bg-orange-100 text-orange-800',
    emergency: 'bg-red-100 text-red-800',
  };

  return (
    <div>
      <Header title={`Job #${job.job_number}`} />

      <div className="p-6 space-y-6">
        {/* Back link and actions */}
        <div className="flex items-center justify-between">
          <Link
            href="/jobs"
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Jobs
          </Link>
          <JobActions jobId={job.id} currentStatus={job.status} />
        </div>

        {/* Status Workflow */}
        <JobStatusWorkflow currentStatus={job.status} jobId={job.id} />

        {/* Status header */}
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-slate-900">Job #{job.job_number}</h1>
                <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                <Badge className={urgencyColors[job.urgency] || urgencyColors.medium}>
                  {job.urgency} urgency
                </Badge>
              </div>
              <p className="text-slate-600">{job.service_category?.replace(/_/g, ' ')}</p>
              {job.quoted_amount && (
                <p className="text-lg font-semibold text-green-600 mt-2">
                  ${job.quoted_amount.toLocaleString()}
                </p>
              )}
            </div>
            <div className="text-right text-sm text-slate-500">
              <div>Created: {formatDateTime(job.created_at)}</div>
              {job.scheduled_at && <div>Scheduled: {formatDateTime(job.scheduled_at)}</div>}
              {job.completed_at && <div>Completed: {formatDateTime(job.completed_at)}</div>}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer Info */}
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-slate-400" />
                  Customer Information
                </h2>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-slate-500">Name</div>
                    <div className="font-medium text-slate-900">{job.customer_name || 'Unknown'}</div>
                  </div>
                  {job.phone_number && (
                    <div>
                      <div className="text-sm text-slate-500">Phone</div>
                      <a
                        href={`tel:${job.phone_e164 || job.phone_number}`}
                        className="font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <Phone className="w-4 h-4" />
                        {formatPhone(job.phone_number)}
                      </a>
                    </div>
                  )}
                  {job.email && (
                    <div>
                      <div className="text-sm text-slate-500">Email</div>
                      <a
                        href={`mailto:${job.email}`}
                        className="font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <Mail className="w-4 h-4" />
                        {job.email}
                      </a>
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                  <a
                    href={`tel:${job.phone_number}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100"
                  >
                    <Phone className="w-4 h-4" />
                    Call
                  </a>
                  <a
                    href={`sms:${job.phone_number}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded-md hover:bg-green-100"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Text
                  </a>
                </div>
              </Card>

              {/* Location */}
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-slate-400" />
                  Service Location
                </h2>
                <div className="space-y-2">
                  {job.address && (
                    <div className="font-medium text-slate-900">{job.address}</div>
                  )}
                  {(job.city || job.zip_code) && (
                    <div className="text-slate-600">
                      {[job.city, job.zip_code].filter(Boolean).join(', ')}
                    </div>
                  )}
                  {!job.address && !job.city && (
                    <div className="text-slate-400 italic">No location provided</div>
                  )}
                </div>

                {job.address && (
                  <div className="mt-4">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                        [job.address, job.city, job.zip_code].filter(Boolean).join(', ')
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                    >
                      <Navigation className="w-4 h-4" />
                      Get Directions
                    </a>
                  </div>
                )}
              </Card>
            </div>

            {/* Issue Description */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-slate-400" />
                Issue Description
              </h2>
              <p className="text-slate-700 whitespace-pre-wrap">
                {job.issue_description || 'No description provided'}
              </p>
              {job.preferred_time && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="text-sm text-slate-500">Preferred Time</div>
                  <div className="font-medium text-slate-900">{job.preferred_time}</div>
                </div>
              )}
              {job.notes && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="text-sm text-slate-500">Additional Notes</div>
                  <div className="font-medium text-slate-900 whitespace-pre-wrap">{job.notes}</div>
                </div>
              )}
            </Card>

            {/* Activity Timeline */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-slate-400" />
                Activity Timeline
              </h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">Job Created</div>
                    <div className="text-sm text-slate-500">{formatDateTime(job.created_at)}</div>
                  </div>
                </div>
                {job.scheduled_at && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">Scheduled</div>
                      <div className="text-sm text-slate-500">{formatDateTime(job.scheduled_at)}</div>
                    </div>
                  </div>
                )}
                {job.started_at && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
                      <PlayCircle className="w-4 h-4 text-yellow-600" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">Job Started</div>
                      <div className="text-sm text-slate-500">{formatDateTime(job.started_at)}</div>
                    </div>
                  </div>
                )}
                {job.completed_at && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">Job Completed</div>
                      <div className="text-sm text-slate-500">{formatDateTime(job.completed_at)}</div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Sidebar - 1 column */}
          <div className="space-y-6">
            {/* Quote & Invoice Section */}
            <JobQuoteInvoice
              jobId={job.id}
              quote={relatedData.quote}
              invoice={relatedData.invoice}
              jobStatus={job.status}
              customerId={job.customer_id}
              customerName={job.customer_name}
              customerPhone={job.phone_number}
              customerEmail={job.email}
              quotedAmount={job.quoted_amount}
              jobDescription={job.issue_description || job.title || 'Service Request'}
            />

            {/* Quick Stats */}
            <Card className="p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Job Details</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Service Type</span>
                  <span className="font-medium">{job.service_category?.replace(/_/g, ' ') || 'General'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Source</span>
                  <span className="font-medium">{job.source || 'Direct'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Urgency</span>
                  <span className="font-medium capitalize">{job.urgency || 'Medium'}</span>
                </div>
                {job.quoted_amount && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Quoted</span>
                    <span className="font-medium text-green-600">${job.quoted_amount.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
