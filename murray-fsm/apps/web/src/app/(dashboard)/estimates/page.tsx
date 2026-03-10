// Murray's FSM - Estimates Page
// ===============================

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatCents, formatRelativeTime, formatDate } from '@/lib/utils';
import {
  FileText,
  DollarSign,
  Send,
  Eye,
  CheckCircle,
  Clock,
  Plus,
  ArrowRightCircle,
} from 'lucide-react';
import Link from 'next/link';

interface EstimateCustomer {
  name: string;
  phone: string | null;
  email: string | null;
}

interface Estimate {
  id: string;
  owner_id: string;
  customer_id: string;
  location_id: string | null;
  estimate_number: string | null;
  status: 'draft' | 'sent' | 'viewed' | 'approved' | 'rejected' | 'expired';
  title: string;
  notes: string | null;
  valid_until: string | null;
  total_cents: number;
  sent_at: string | null;
  approved_at: string | null;
  converted_job_id: string | null;
  created_at: string;
  updated_at: string;
  deleted: boolean;
  customer: EstimateCustomer | null;
}

const statusColors: Record<Estimate['status'], string> = {
  draft: 'bg-slate-100 text-slate-800',
  sent: 'bg-blue-100 text-blue-800',
  viewed: 'bg-indigo-100 text-indigo-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  expired: 'bg-yellow-100 text-yellow-800',
};

const statusLabels: Record<Estimate['status'], string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Expired',
};

async function getEstimatesData() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('estimates')
    .select(`
      *,
      customer:customers(name, phone, email)
    `)
    .eq('deleted', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching estimates:', error);
    return { estimates: [], stats: { total: 0, draft: 0, sentPending: 0, approved: 0, totalValue: 0, approvedValue: 0 } };
  }

  const estimates: Estimate[] = data || [];

  const stats = {
    total: estimates.length,
    draft: estimates.filter((e) => e.status === 'draft').length,
    sentPending: estimates.filter((e) => e.status === 'sent' || e.status === 'viewed').length,
    approved: estimates.filter((e) => e.status === 'approved').length,
    totalValue: estimates.reduce((sum, e) => sum + e.total_cents, 0),
    approvedValue: estimates
      .filter((e) => e.status === 'approved')
      .reduce((sum, e) => sum + e.total_cents, 0),
  };

  return { estimates, stats };
}

function EstimateCard({ estimate }: { estimate: Estimate }) {
  return (
    <Card className="p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            {estimate.estimate_number && (
              <span className="text-sm font-mono text-slate-500">
                {estimate.estimate_number}
              </span>
            )}
            <Badge className={statusColors[estimate.status]}>
              {statusLabels[estimate.status]}
            </Badge>
          </div>
          <h3 className="font-medium text-slate-900 truncate">{estimate.title}</h3>
          {estimate.customer && (
            <div className="text-sm text-slate-500 mt-1">
              {estimate.customer.name}
            </div>
          )}
        </div>
        <div className="text-right ml-4 flex-shrink-0">
          <div className="text-lg font-semibold text-slate-900">
            {formatCents(estimate.total_cents)}
          </div>
          {estimate.valid_until && (
            <div className="text-xs text-slate-400 mt-1">
              Valid until {formatDate(estimate.valid_until, 'MMM d, yyyy')}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Clock className="w-3 h-3" />
          {formatRelativeTime(estimate.created_at)}
        </div>

        <div className="flex items-center gap-2">
          {estimate.status === 'draft' && (
            <Link href={`/estimates/${estimate.id}/send`}>
              <Button variant="outline" size="sm">
                <Send className="w-3.5 h-3.5" />
                Send
              </Button>
            </Link>
          )}
          {estimate.status === 'approved' && !estimate.converted_job_id && (
            <Link href={`/estimates/${estimate.id}/convert`}>
              <Button variant="success" size="sm">
                <ArrowRightCircle className="w-3.5 h-3.5" />
                Convert to Job
              </Button>
            </Link>
          )}
          <Link href={`/estimates/${estimate.id}`}>
            <Button variant="ghost" size="sm">
              <Eye className="w-3.5 h-3.5" />
              View
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

export default async function EstimatesPage() {
  const { estimates, stats } = await getEstimatesData();

  return (
    <div>
      <Header title="Estimates" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <FileText className="w-4 h-4" />
              Total Estimates
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Clock className="w-4 h-4" />
              Draft
            </div>
            <div className="text-2xl font-bold text-slate-600 mt-1">{stats.draft}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Send className="w-4 h-4" />
              Sent / Pending
            </div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{stats.sentPending}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <CheckCircle className="w-4 h-4" />
              Approved
            </div>
            <div className="text-2xl font-bold text-green-600 mt-1">{stats.approved}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <DollarSign className="w-4 h-4" />
              Total Value
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {formatCents(stats.totalValue)}
            </div>
          </Card>
        </div>

        {/* Filter Bar & Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/estimates">
              <Button variant="primary" size="sm">All</Button>
            </Link>
            <Link href="/estimates?status=draft">
              <Button variant="outline" size="sm">Draft</Button>
            </Link>
            <Link href="/estimates?status=sent">
              <Button variant="outline" size="sm">Sent</Button>
            </Link>
            <Link href="/estimates?status=approved">
              <Button variant="outline" size="sm">Approved</Button>
            </Link>
          </div>
          <Link href="/estimates/new">
            <Button size="sm">
              <Plus className="w-4 h-4" />
              New Estimate
            </Button>
          </Link>
        </div>

        {/* Estimates List */}
        {estimates.length > 0 ? (
          <div className="grid gap-4">
            {estimates.map((estimate) => (
              <EstimateCard key={estimate.id} estimate={estimate} />
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <div className="text-slate-500 font-medium">No estimates yet</div>
            <div className="text-sm text-slate-400 mt-1">
              Create your first estimate to send to a customer
            </div>
            <div className="mt-4">
              <Link href="/estimates/new">
                <Button size="sm">
                  <Plus className="w-4 h-4" />
                  Create your first estimate
                </Button>
              </Link>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
