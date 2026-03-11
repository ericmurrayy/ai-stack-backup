// Murray's FSM - Estimates Page (with pagination)
// =================================================

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
  ChevronLeft,
  ChevronRight,
  Inbox,
} from 'lucide-react';
import Link from 'next/link';
import { EstimatesFilters } from './EstimatesFilters';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25; // matches DEFAULTS.PAGE_SIZE from @murray-fsm/shared

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface EstimatesResult {
  estimates: Estimate[];
  totalCount: number;
}

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getEstimates(opts: {
  page: number;
  status?: string;
  search?: string;
}): Promise<EstimatesResult> {
  const supabase = await createClient();

  const from = (opts.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('estimates')
    .select(
      `
      *,
      customer:customers(name, phone, email)
    `,
      { count: 'exact' }
    )
    .eq('deleted', false)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (opts.status && opts.status !== 'all') {
    query = query.eq('status', opts.status);
  }

  if (opts.search) {
    query = query.or(
      `customer_name.ilike.%${opts.search}%,estimate_number.ilike.%${opts.search}%`
    );
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching estimates:', error);
    return { estimates: [], totalCount: 0 };
  }

  return {
    estimates: (data as Estimate[]) || [],
    totalCount: count ?? 0,
  };
}

async function getEstimateStats() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('estimates')
    .select('status, total_cents')
    .eq('deleted', false);

  if (error || !data)
    return {
      total: 0,
      draft: 0,
      sentPending: 0,
      approved: 0,
      totalValue: 0,
      approvedValue: 0,
    };

  return {
    total: data.length,
    draft: data.filter((e) => e.status === 'draft').length,
    sentPending: data.filter(
      (e) => e.status === 'sent' || e.status === 'viewed'
    ).length,
    approved: data.filter((e) => e.status === 'approved').length,
    totalValue: data.reduce((sum, e) => sum + (e.total_cents || 0), 0),
    approvedValue: data
      .filter((e) => e.status === 'approved')
      .reduce((sum, e) => sum + (e.total_cents || 0), 0),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPaginationUrl(
  page: number,
  status: string,
  search: string
): string {
  const p = new URLSearchParams();
  if (page > 1) p.set('page', String(page));
  if (status && status !== 'all') p.set('status', status);
  if (search) p.set('search', search);
  const qs = p.toString();
  return `/estimates${qs ? `?${qs}` : ''}`;
}

// ---------------------------------------------------------------------------
// Estimate Card
// ---------------------------------------------------------------------------

function EstimateCard({ estimate }: { estimate: Estimate }) {
  return (
    <tr className="hover:bg-slate-50">
      {/* Estimate Number */}
      <td className="px-6 py-4">
        <div className="font-medium text-slate-900">
          {estimate.estimate_number || 'No number'}
        </div>
        <div className="text-sm text-slate-500 truncate max-w-[200px]">
          {estimate.title}
        </div>
      </td>

      {/* Customer */}
      <td className="px-6 py-4">
        <div className="text-sm font-medium text-slate-900">
          {estimate.customer?.name || 'Unknown'}
        </div>
      </td>

      {/* Status */}
      <td className="px-6 py-4">
        <Badge className={statusColors[estimate.status]}>
          {statusLabels[estimate.status]}
        </Badge>
      </td>

      {/* Total */}
      <td className="px-6 py-4">
        <div className="text-sm font-semibold text-slate-900">
          {formatCents(estimate.total_cents)}
        </div>
      </td>

      {/* Valid Until */}
      <td className="px-6 py-4">
        {estimate.valid_until ? (
          <div className="text-sm text-slate-500">
            {formatDate(estimate.valid_until, 'MMM d, yyyy')}
          </div>
        ) : (
          <span className="text-slate-400 text-sm">-</span>
        )}
      </td>

      {/* Created */}
      <td className="px-6 py-4">
        <div className="text-sm text-slate-500 flex items-center gap-1">
          <Clock className="w-3 h-3 text-slate-400" />
          {formatRelativeTime(estimate.created_at)}
        </div>
      </td>

      {/* Actions */}
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
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
                Convert
              </Button>
            </Link>
          )}
          <Link
            href={`/estimates/${estimate.id}`}
            className="text-primary-600 hover:text-primary-800 text-sm font-medium"
          >
            View
          </Link>
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function EstimatesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; search?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page || '1', 10) || 1);
  const statusFilter = params.status || 'all';
  const searchQuery = params.search || '';

  const [{ estimates, totalCount }, stats] = await Promise.all([
    getEstimates({
      page: currentPage,
      status: statusFilter,
      search: searchQuery,
    }),
    getEstimateStats(),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

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
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {stats.total}
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Clock className="w-4 h-4" />
              Draft
            </div>
            <div className="text-2xl font-bold text-slate-600 mt-1">
              {stats.draft}
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Send className="w-4 h-4" />
              Sent / Pending
            </div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {stats.sentPending}
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <CheckCircle className="w-4 h-4" />
              Approved
            </div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {stats.approved}
            </div>
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

        {/* Estimates Table */}
        <Card padding="none">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              All Estimates
            </h2>
            <Link href="/estimates/new">
              <Button size="sm">
                <Plus className="w-4 h-4" />
                New Estimate
              </Button>
            </Link>
          </div>

          {/* Search & Filter Bar */}
          <EstimatesFilters
            currentStatus={statusFilter}
            currentSearch={searchQuery}
          />

          {estimates.length === 0 ? (
            /* ---- Empty state ---- */
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 mb-4">
                <Inbox className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">
                No estimates found
              </h3>
              <p className="text-sm text-slate-500 mb-6 text-center max-w-xs">
                {currentPage > 1
                  ? 'There are no estimates on this page. Try going back to an earlier page.'
                  : 'No estimates match the current filters. Create a new estimate to get started.'}
              </p>
              {currentPage > 1 ? (
                <Link href="/estimates?page=1">
                  <Button variant="outline" size="sm">
                    <ChevronLeft className="w-4 h-4" />
                    Back to first page
                  </Button>
                </Link>
              ) : (
                <Link href="/estimates/new">
                  <Button size="sm">
                    <Plus className="w-4 h-4" />
                    Create Estimate
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
                      Estimate
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Valid Until
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {estimates.map((estimate) => (
                    <EstimateCard key={estimate.id} estimate={estimate} />
                  ))}
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
                </span>{' '}
                -{' '}
                <span className="font-medium text-slate-700">
                  {Math.min(currentPage * PAGE_SIZE, totalCount)}
                </span>{' '}
                of{' '}
                <span className="font-medium text-slate-700">
                  {totalCount}
                </span>{' '}
                estimates
              </p>

              {/* Page navigation */}
              <div className="flex items-center gap-2">
                {currentPage > 1 ? (
                  <Link
                    href={buildPaginationUrl(
                      currentPage - 1,
                      statusFilter,
                      searchQuery
                    )}
                  >
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
                  <Link
                    href={buildPaginationUrl(
                      currentPage + 1,
                      statusFilter,
                      searchQuery
                    )}
                  >
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
