// Murray's FSM - Payments Page (with pagination)
// ================================================

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatCents, formatRelativeTime, paymentStatusConfig } from '@/lib/utils';
import { CreditCard, DollarSign, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { PaymentsFilters } from './PaymentsFilters';
import Link from 'next/link';
import type { Payment, Job } from '@/types/database';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaymentWithJob extends Payment {
  job: Job | null;
}

interface PaymentsResult {
  payments: PaymentWithJob[];
  totalCount: number;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getPayments(opts: {
  page: number;
  search?: string;
  method?: string;
}): Promise<PaymentsResult> {
  const supabase = await createClient();

  const from = (opts.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('payments')
    .select('*, job:jobs(*)', { count: 'exact' })
    .eq('deleted', false)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (opts.method && opts.method !== 'all') {
    query = query.eq('payment_method', opts.method);
  }

  if (opts.search) {
    query = query.or(
      `customer_name.ilike.%${opts.search}%`
    );
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching payments:', error);
    return { payments: [], totalCount: 0 };
  }

  return {
    payments: (data as PaymentWithJob[]) || [],
    totalCount: count ?? 0,
  };
}

async function getPaymentStats() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('payments')
    .select('amount_cents, status')
    .eq('deleted', false);

  if (error || !data) {
    return { total: 0, succeeded: 0, pending: 0, count: 0 };
  }

  return {
    count: data.length,
    total: data.reduce((sum, p) => sum + p.amount_cents, 0),
    succeeded: data
      .filter((p) => p.status === 'succeeded')
      .reduce((sum, p) => sum + p.amount_cents, 0),
    pending: data
      .filter((p) => p.status === 'pending' || p.status === 'processing')
      .reduce((sum, p) => sum + p.amount_cents, 0),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPaginationUrl(page: number, method: string, search: string): string {
  const p = new URLSearchParams();
  if (page > 1) p.set('page', String(page));
  if (method && method !== 'all') p.set('method', method);
  if (search) p.set('search', search);
  const qs = p.toString();
  return `/payments${qs ? `?${qs}` : ''}`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; method?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page || '1', 10) || 1);
  const methodFilter = params.method || 'all';
  const searchQuery = params.search || '';

  const [{ payments, totalCount }, stats] = await Promise.all([
    getPayments({ page: currentPage, method: methodFilter, search: searchQuery }),
    getPaymentStats(),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div>
      <Header title="Payments" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-sm text-slate-500">Total Payments</div>
            <div className="text-2xl font-bold text-slate-900">{stats.count}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">Collected</div>
            <div className="text-2xl font-bold text-green-600">
              {formatCents(stats.succeeded)}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">Pending</div>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCents(stats.pending)}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">Total Volume</div>
            <div className="text-2xl font-bold text-slate-900">
              {formatCents(stats.total)}
            </div>
          </Card>
        </div>

        {/* Payments Table */}
        <Card padding="none">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Payment History</h2>
            <p className="text-sm text-slate-500">
              All payments
            </p>
          </div>

          {/* Search & Filter Bar */}
          <PaymentsFilters currentMethod={methodFilter} currentSearch={searchQuery} />

          {payments.length === 0 ? (
            /* ---- Empty state ---- */
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 mb-4">
                {currentPage > 1 ? (
                  <Inbox className="h-8 w-8 text-slate-400" />
                ) : (
                  <DollarSign className="h-8 w-8 text-slate-400" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">
                {currentPage > 1 ? 'No payments on this page' : 'No payments found'}
              </h3>
              <p className="text-sm text-slate-500 mb-6 text-center max-w-xs">
                {currentPage > 1
                  ? 'There are no payments on this page. Try going back to an earlier page.'
                  : 'No payments match the current filters. Payments will appear here after customers pay.'}
              </p>
              {currentPage > 1 && (
                <Link href="/payments?page=1">
                  <Button variant="outline" size="sm">
                    <ChevronLeft className="w-4 h-4" />
                    Back to first page
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
                      Payment
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Method
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {payments.map((payment) => {
                    const statusConfig = paymentStatusConfig[payment.status] || {
                      label: payment.status,
                      color: 'bg-slate-100 text-slate-800',
                    };

                    const methodLabels: Record<string, string> = {
                      cash: 'Cash',
                      check: 'Check',
                      credit_card: 'Credit Card',
                      ach: 'ACH',
                      other: 'Other',
                    };

                    return (
                      <tr key={payment.id} className="hover:bg-slate-50">
                        {/* Payment */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-100 rounded-lg">
                              <CreditCard className="w-5 h-5 text-slate-600" />
                            </div>
                            <div>
                              <div className="font-mono text-sm text-slate-900">
                                {payment.stripe_payment_intent_id
                                  ? `${payment.stripe_payment_intent_id.slice(0, 20)}...`
                                  : `#${payment.id.slice(0, 8)}`}
                              </div>
                              <div className="text-xs text-slate-500">
                                {payment.provider || payment.payment_method || '-'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Customer */}
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-slate-900">
                            {payment.customer_name || 'Unknown'}
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900">
                            {formatCents(payment.amount_cents)}
                          </div>
                        </td>

                        {/* Method */}
                        <td className="px-6 py-4">
                          <span className="text-sm text-slate-700">
                            {(payment.payment_method && methodLabels[payment.payment_method]) || payment.payment_method || '-'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          <Badge className={statusConfig.color}>
                            {statusConfig.label}
                          </Badge>
                        </td>

                        {/* Date */}
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {formatRelativeTime(payment.payment_date || payment.created_at)}
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
                payments
              </p>

              {/* Page navigation */}
              <div className="flex items-center gap-2">
                {currentPage > 1 ? (
                  <Link href={buildPaginationUrl(currentPage - 1, methodFilter, searchQuery)}>
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
                  <Link href={buildPaginationUrl(currentPage + 1, methodFilter, searchQuery)}>
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
