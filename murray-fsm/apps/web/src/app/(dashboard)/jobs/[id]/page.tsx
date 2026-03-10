// Murray's FSM - Job Detail Page
// ================================
// Full job detail with timeline, customer info, estimates, and actions

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  cn,
  formatCents,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  jobStatusConfig,
  serviceCategoryConfig,
} from '@/lib/utils';
import {
  ArrowLeft,
  Briefcase,
  User,
  Phone,
  Mail,
  MapPin,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle,
  FileText,
  MessageSquare,
  Wrench,
  DollarSign,
  Edit,
  ExternalLink,
  Star,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

// ---------- Types ----------

interface JobDetail {
  id: string;
  job_number: string;
  title: string;
  description: string | null;
  status: string;
  service_category: string;
  urgency: string;
  assigned_technician_id: string | null;
  scheduled_at: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  created_at: string;
  updated_at: string;
  customer: { id: string; name: string; phone: string | null; email: string | null } | null;
  location: { address_line1: string | null; city: string | null; state: string | null; zip_code: string | null } | null;
  technician: { id: string; name: string; phone: string | null; color: string } | null;
}

const urgencyConfig: Record<string, { color: string; label: string; bgColor: string }> = {
  low: { color: 'text-slate-600', label: 'Low', bgColor: 'bg-slate-100' },
  medium: { color: 'text-blue-600', label: 'Medium', bgColor: 'bg-blue-100' },
  high: { color: 'text-orange-600', label: 'High', bgColor: 'bg-orange-100' },
  emergency: { color: 'text-red-600', label: 'Emergency', bgColor: 'bg-red-100' },
};

const STATUS_STEPS = [
  { key: 'new', label: 'Created' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

// ---------- Data Fetcher ----------

async function getJobDetail(jobId: string) {
  const supabase = createClient();

  const { data: job, error } = await supabase
    .from('jobs')
    .select(`
      id, job_number, title, description, status, service_category, urgency,
      assigned_technician_id, scheduled_at, scheduled_start, scheduled_end,
      created_at, updated_at,
      customer:customers(id, name, phone, email),
      location:locations(address_line1, city, state, zip_code),
      technician:technicians!jobs_assigned_technician_id_fkey(id, name, phone, color)
    `)
    .eq('id', jobId)
    .single();

  if (error || !job) return null;

  // Get estimates for this job
  const { data: estimates } = await supabase
    .from('estimates')
    .select('id, title, status, total_cents, created_at, approved_at')
    .eq('deleted', false)
    .or(`converted_job_id.eq.${jobId}`);

  // Get reviews for this job
  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, rating, review_text, response_text, reviewer_name, reviewed_at')
    .eq('job_id', jobId)
    .eq('deleted', false);

  // Get message logs for the customer
  const customerId = (job.customer as any)?.id;
  let messages: any[] = [];
  if (customerId) {
    const { data: msgData } = await supabase
      .from('message_logs')
      .select('id, direction, body, channel, created_at')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(10);
    messages = msgData || [];
  }

  // Normalize FK joins (Supabase may return arrays)
  const normalized: JobDetail = {
    ...(job as any),
    customer: Array.isArray(job.customer) ? job.customer[0] ?? null : job.customer ?? null,
    location: Array.isArray(job.location) ? job.location[0] ?? null : job.location ?? null,
    technician: Array.isArray(job.technician) ? job.technician[0] ?? null : job.technician ?? null,
  };

  return {
    job: normalized,
    estimates: estimates || [],
    reviews: reviews || [],
    messages,
  };
}

// ---------- Page ----------

export default async function JobDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const data = await getJobDetail(params.id);

  if (!data) {
    notFound();
  }

  const { job, estimates, reviews, messages } = data;
  const statusInfo = jobStatusConfig[job.status] || jobStatusConfig.new;
  const categoryInfo = serviceCategoryConfig[job.service_category] || serviceCategoryConfig.general;
  const urgency = urgencyConfig[job.urgency] || urgencyConfig.medium;
  const currentStepIndex = STATUS_STEPS.findIndex(s => s.key === job.status);

  return (
    <div>
      <Header title={`Job #${job.job_number || job.id.slice(0, 8)}`} />

      <div className="p-6 space-y-6 max-w-5xl">
        {/* Back + Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/jobs" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-500" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-slate-900">{job.title}</h1>
                <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                <Badge className={categoryInfo.color}>{categoryInfo.label}</Badge>
                <Badge className={`${urgency.bgColor} ${urgency.color}`}>{urgency.label}</Badge>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Created {formatRelativeTime(job.created_at)} · Updated {formatRelativeTime(job.updated_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Edit className="w-4 h-4" />
              Edit
            </Button>
          </div>
        </div>

        {/* Status Timeline */}
        <Card padding="none" className="p-5">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Job Progress</h3>
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
                        'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                        isCompleted && 'bg-green-500 text-white',
                        isCurrent && 'bg-blue-600 text-white ring-4 ring-blue-100',
                        isFuture && 'bg-slate-200 text-slate-400'
                      )}
                    >
                      {isCompleted ? <CheckCircle className="w-5 h-5" /> : i + 1}
                    </div>
                    <span className={cn(
                      'text-xs mt-2',
                      isCurrent ? 'text-slate-900 font-semibold' : 'text-slate-400'
                    )}>
                      {step.label}
                    </span>
                  </div>
                  {i < STATUS_STEPS.length - 1 && (
                    <div
                      className={cn(
                        'flex-1 h-1 mx-2 rounded-full mt-[-20px]',
                        i < currentStepIndex ? 'bg-green-400' : 'bg-slate-200'
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            {job.description && (
              <Card padding="none" className="p-5">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Description</h3>
                <p className="text-slate-900 whitespace-pre-wrap">{job.description}</p>
              </Card>
            )}

            {/* Schedule */}
            <Card padding="none" className="p-5">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Schedule</h3>
              <div className="space-y-3">
                {job.scheduled_start ? (
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-blue-500" />
                    <div>
                      <div className="font-medium text-slate-900">
                        {formatDateTime(job.scheduled_start)}
                      </div>
                      {job.scheduled_end && (
                        <div className="text-sm text-slate-500">
                          to {formatDateTime(job.scheduled_end)}
                        </div>
                      )}
                    </div>
                  </div>
                ) : job.scheduled_at ? (
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-blue-500" />
                    <span className="text-slate-900">{formatDateTime(job.scheduled_at)}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-slate-400">
                    <Clock className="w-5 h-5" />
                    <span>Not yet scheduled</span>
                  </div>
                )}
              </div>
            </Card>

            {/* Estimates */}
            {estimates.length > 0 && (
              <Card padding="none" className="p-5">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Estimates</h3>
                <div className="space-y-3">
                  {estimates.map((est: any) => (
                    <div key={est.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-slate-400" />
                        <div>
                          <div className="font-medium text-slate-900">{est.title}</div>
                          <div className="text-sm text-slate-500">{formatRelativeTime(est.created_at)}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-slate-900">{formatCents(est.total_cents)}</div>
                        <Badge className={est.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-700'}>
                          {est.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Reviews */}
            {reviews.length > 0 && (
              <Card padding="none" className="p-5">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Reviews</h3>
                {reviews.map((review: any) => (
                  <div key={review.id} className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star
                            key={star}
                            className={cn('w-4 h-4', star <= review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-slate-300')}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-medium text-slate-700">{review.reviewer_name}</span>
                      <span className="text-xs text-slate-400">{formatRelativeTime(review.reviewed_at)}</span>
                    </div>
                    <p className="text-sm text-slate-700">{review.review_text}</p>
                    {review.response_text && (
                      <div className="mt-2 pl-4 border-l-2 border-blue-200">
                        <p className="text-sm text-slate-600 italic">{review.response_text}</p>
                      </div>
                    )}
                  </div>
                ))}
              </Card>
            )}

            {/* Recent Messages */}
            {messages.length > 0 && (
              <Card padding="none" className="p-5">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Recent Messages</h3>
                <div className="space-y-2">
                  {messages.slice(0, 5).map((msg: any) => (
                    <div
                      key={msg.id}
                      className={cn(
                        'p-3 rounded-lg text-sm max-w-[80%]',
                        msg.direction === 'outbound'
                          ? 'bg-blue-50 text-blue-900 ml-auto'
                          : 'bg-slate-100 text-slate-900'
                      )}
                    >
                      <p>{msg.body}</p>
                      <p className="text-xs text-slate-400 mt-1">{formatRelativeTime(msg.created_at)}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Customer Info */}
            <Card padding="none" className="p-5">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Customer</h3>
              {job.customer ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">{job.customer.name}</div>
                      <Link href={`/customers#${job.customer.id}`} className="text-xs text-blue-600 hover:underline">
                        View profile →
                      </Link>
                    </div>
                  </div>
                  {job.customer.phone && (
                    <a href={`tel:${job.customer.phone}`} className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600">
                      <Phone className="w-4 h-4 text-slate-400" />
                      {job.customer.phone}
                    </a>
                  )}
                  {job.customer.email && (
                    <a href={`mailto:${job.customer.email}`} className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600">
                      <Mail className="w-4 h-4 text-slate-400" />
                      {job.customer.email}
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No customer assigned</p>
              )}
            </Card>

            {/* Location */}
            <Card padding="none" className="p-5">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Location</h3>
              {job.location ? (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div className="text-sm text-slate-700">
                    {job.location.address_line1 && <div>{job.location.address_line1}</div>}
                    <div>
                      {[job.location.city, job.location.state, job.location.zip_code]
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">No location set</p>
              )}
            </Card>

            {/* Assigned Technician */}
            <Card padding="none" className="p-5">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Assigned Technician</h3>
              {job.technician ? (
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                    style={{ backgroundColor: job.technician.color }}
                  >
                    {job.technician.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">{job.technician.name}</div>
                    {job.technician.phone && (
                      <a href={`tel:${job.technician.phone}`} className="text-sm text-blue-600 hover:underline">
                        {job.technician.phone}
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-slate-400 mb-2">No technician assigned</p>
                  <Link href="/dispatch">
                    <Button variant="outline" size="sm">
                      <Wrench className="w-4 h-4" />
                      Assign from Dispatch
                    </Button>
                  </Link>
                </div>
              )}
            </Card>

            {/* Quick Actions */}
            <Card padding="none" className="p-5">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Actions</h3>
              <div className="space-y-2">
                <Link href={`/estimates/new?job=${job.id}`} className="block">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <FileText className="w-4 h-4" />
                    Create Estimate
                  </Button>
                </Link>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <MessageSquare className="w-4 h-4" />
                  Send Message
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Phone className="w-4 h-4" />
                  Log Call
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
