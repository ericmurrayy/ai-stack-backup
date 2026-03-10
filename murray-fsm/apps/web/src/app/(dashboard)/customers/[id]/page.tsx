// Murray's FSM - Customer Detail Page
// =====================================
// Full customer profile with jobs, estimates, reviews, and communication history

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  cn,
  formatCents,
  formatDate,
  formatRelativeTime,
  jobStatusConfig,
  serviceCategoryConfig,
} from '@/lib/utils';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  FileText,
  Star,
  MessageSquare,
  PhoneCall,
  DollarSign,
  Calendar,
  Tag,
  Edit,
  Clock,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

// ---------- Data Fetcher ----------

async function getCustomerDetail(customerId: string) {
  const supabase = createClient();

  // Customer
  const { data: customer, error } = await supabase
    .from('customers')
    .select('id, name, email, phone, source, tags, notes, created_at')
    .eq('id', customerId)
    .eq('deleted', false)
    .single();

  if (error || !customer) return null;

  // Locations
  const { data: locations } = await supabase
    .from('locations')
    .select('id, address_line1, city, state, zip_code, is_primary')
    .eq('customer_id', customerId)
    .eq('deleted', false);

  // Jobs
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, job_number, title, status, service_category, urgency, scheduled_at, created_at')
    .eq('customer_id', customerId)
    .eq('is_spam', false)
    .order('created_at', { ascending: false })
    .limit(20);

  // Estimates
  const { data: estimates } = await supabase
    .from('estimates')
    .select('id, title, status, total_cents, created_at')
    .eq('customer_id', customerId)
    .eq('deleted', false)
    .order('created_at', { ascending: false });

  // Reviews
  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, rating, review_text, reviewer_name, reviewed_at')
    .eq('customer_id', customerId)
    .eq('deleted', false)
    .order('reviewed_at', { ascending: false });

  // Recent communications
  const { data: calls } = await supabase
    .from('call_logs')
    .select('id, direction, duration_seconds, notes, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(5);

  const { data: messages } = await supabase
    .from('message_logs')
    .select('id, direction, body, channel, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(10);

  // Referrals
  const { data: referrals } = await supabase
    .from('referrals')
    .select('id, referred_name, status, referrer_reward_cents, created_at')
    .eq('referrer_customer_id', customerId)
    .eq('deleted', false);

  // Agreements
  const { data: agreements } = await supabase
    .from('service_agreements')
    .select('id, name, status, price_cents, billing_cycle, end_date')
    .eq('customer_id', customerId)
    .eq('deleted', false);

  // Compute stats
  const allJobs = jobs || [];
  const allEstimates = estimates || [];
  const totalRevenue = allEstimates
    .filter((e: any) => e.status === 'approved')
    .reduce((sum: number, e: any) => sum + (e.total_cents || 0), 0);
  const avgRating = reviews && reviews.length > 0
    ? (reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return {
    customer,
    locations: locations || [],
    jobs: allJobs,
    estimates: allEstimates,
    reviews: reviews || [],
    calls: calls || [],
    messages: messages || [],
    referrals: referrals || [],
    agreements: agreements || [],
    stats: {
      totalJobs: allJobs.length,
      activeJobs: allJobs.filter((j: any) => !['completed', 'cancelled'].includes(j.status)).length,
      totalRevenue,
      avgRating,
      totalReferrals: referrals?.length || 0,
    },
  };
}

// ---------- Page ----------

export default async function CustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const data = await getCustomerDetail(params.id);

  if (!data) {
    notFound();
  }

  const { customer, locations, jobs, estimates, reviews, calls, messages, referrals, agreements, stats } = data;
  const primaryLocation = locations.find((l: any) => l.is_primary) || locations[0];

  return (
    <div>
      <Header title={customer.name} />

      <div className="p-6 space-y-6 max-w-5xl">
        {/* Back + Customer Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/customers" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-500" />
            </Link>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="w-7 h-7 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-900">{customer.name}</h1>
                  {customer.tags?.map((tag: string) => (
                    <Badge key={tag} className="bg-slate-100 text-slate-700 text-xs capitalize">{tag}</Badge>
                  ))}
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                  <span>Customer since {formatDate(customer.created_at)}</span>
                  {customer.source && (
                    <span className="capitalize">Source: {customer.source}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm">
            <Edit className="w-4 h-4" />
            Edit
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Briefcase className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{stats.totalJobs}</div>
                <div className="text-xs text-slate-500">Total Jobs</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-50">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">{stats.activeJobs}</div>
                <div className="text-xs text-slate-500">Active Jobs</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{formatCents(stats.totalRevenue)}</div>
                <div className="text-xs text-slate-500">Revenue</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-50">
                <Star className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{stats.avgRating ?? '—'}</div>
                <div className="text-xs text-slate-500">Avg Rating</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">{stats.totalReferrals}</div>
                <div className="text-xs text-slate-500">Referrals</div>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Jobs */}
            <Card padding="none">
              <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Jobs ({jobs.length})</h3>
                <Link href={`/jobs?customer=${customer.id}`}>
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </div>
              {jobs.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {jobs.slice(0, 8).map((job: any) => {
                    const statusInfo = jobStatusConfig[job.status] || jobStatusConfig.new;
                    const categoryInfo = serviceCategoryConfig[job.service_category] || serviceCategoryConfig.general;
                    return (
                      <Link key={job.id} href={`/jobs/${job.id}`} className="block px-5 py-3 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-slate-900">{job.title}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              #{job.job_number} · {formatRelativeTime(job.created_at)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={categoryInfo.color}>{categoryInfo.label}</Badge>
                            <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400">No jobs yet</div>
              )}
            </Card>

            {/* Messages */}
            {messages.length > 0 && (
              <Card padding="none">
                <div className="px-5 py-3 border-b border-slate-200">
                  <h3 className="font-semibold text-slate-900">Recent Messages</h3>
                </div>
                <div className="p-4 space-y-2">
                  {messages.slice(0, 6).map((msg: any) => (
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
                      <p className="text-xs text-slate-400 mt-1">
                        {msg.channel} · {formatRelativeTime(msg.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Info */}
            <Card padding="none" className="p-5">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Contact</h3>
              <div className="space-y-3">
                {customer.phone && (
                  <a href={`tel:${customer.phone}`} className="flex items-center gap-2 text-sm text-slate-700 hover:text-blue-600">
                    <Phone className="w-4 h-4 text-slate-400" />
                    {customer.phone}
                  </a>
                )}
                {customer.email && (
                  <a href={`mailto:${customer.email}`} className="flex items-center gap-2 text-sm text-slate-700 hover:text-blue-600">
                    <Mail className="w-4 h-4 text-slate-400" />
                    {customer.email}
                  </a>
                )}
                {primaryLocation && (
                  <div className="flex items-start gap-2 text-sm text-slate-700">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                    <div>
                      {primaryLocation.address_line1 && <div>{primaryLocation.address_line1}</div>}
                      <div>{[primaryLocation.city, primaryLocation.state, primaryLocation.zip_code].filter(Boolean).join(', ')}</div>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Notes */}
            {customer.notes && (
              <Card padding="none" className="p-5">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Notes</h3>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{customer.notes}</p>
              </Card>
            )}

            {/* Active Agreements */}
            {agreements.length > 0 && (
              <Card padding="none" className="p-5">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Service Agreements</h3>
                <div className="space-y-2">
                  {agreements.map((agr: any) => (
                    <div key={agr.id} className="p-3 bg-slate-50 rounded-lg">
                      <div className="font-medium text-sm text-slate-900">{agr.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={agr.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-700'}>
                          {agr.status}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          {formatCents(agr.price_cents)}/{agr.billing_cycle}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Quick Actions */}
            <Card padding="none" className="p-5">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Actions</h3>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Briefcase className="w-4 h-4" />
                  Create Job
                </Button>
                <Link href="/estimates/new" className="block">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <FileText className="w-4 h-4" />
                    Create Estimate
                  </Button>
                </Link>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <MessageSquare className="w-4 h-4" />
                  Send Message
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
