// Murray's FSM - Invoices Page (with pagination)
// ================================================

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatCents, formatDate } from '@/lib/utils';
import {
  FileText,
  CheckCircle,
  Clock,
  Send,
  Eye,
  Plus,
  AlertTriangle,
  Printer,
  ChevronLeft,
  ChevronRight,
  Inbox,
} from 'lucide-react';
import Link from 'next/link';
import { InvoicesFilters } from './InvoicesFilters';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25; // matches DEFAULTS.PAGE_SIZE from @murray-fsm/shared

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InvoiceRow {
  id: string;
  invoice_number: string | null;
  customer_name: string | null;
  status: string;
  total_cents: number;
  paid_cents: number;
  due_date: string | null;
  created_at: string;
}

interface InvoicesResult {
  invoices: InvoiceRow[];
  totalCount: number;
}

const invoiceStatusConfig: Record<string, { color: string; label: string }> = {
  draft: { color: 'bg-slate-100 text-slate-800', label: 'Draft' },
  sent: { color: 'bg-blue-100 text-blue-800', label: 'Sent' },
  paid: { color: 'bg-green-100 text-green-800', label: 'Paid' },
  overdue: { color: 'bg-red-100 text-red-800', label: 'Overdue' },
  cancelled: { color: 'bg-slate-100 text-slate-500', label: 'Cancelled' },
};

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getInvoices(opts: {
  page: number;
  status?: string;
  search?: string;
}): Promise<InvoicesResult> {
  const supabase = await createClient();

  const from = (opts.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('invoices')
    .select('id, invoice_number, customer_name, status, total_cents, paid_cents, due_date, created_at', {
      count: 'exact',
    })
    .eq('deleted', false)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (opts.status && opts.status !== 'all') {
    query = query.eq('status', opts.status);
  }

  if (opts.search) {
    query = query.or(
      `customer_name.ilike.%${opts.search}%,invoice_number.ilike.%${opts.search}%`
    );
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching invoices:', error);
    return { invoices: [], totalCount: 0 };
  }

  return {
    invoices: (data as InvoiceRow[]) || [],
    totalCount: count ?? 0,
  };
}

async function getInvoiceStats() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('invoices')
    .select('status, total_cents')
    .eq('deleted', false);

  if (error || !data) {
    return { total: 0, draft: 0, sent: 0, paid: 0, overdue: 0, cancelled: 0, totalOutstanding: 0, totalPaid: 0 };
  }

  return {
    total: data.length,
    draft: data.filter((i) => i.status === 'draft').length,
    sent: data.filter((i) => i.status === 'sent').length,
    paid: data.filter((i) => i.status === 'paid').length,
    overdue: data.filter((i) => i.status === 'overdue').length,
    cancelled: data.filter((i) => i.status === 'cancelled').length,
    totalOutstanding: data
      .filter((i) => ['sent', 'overdue'].includes(i.status))
      .reduce((sum, i) => sum + (i.total_cents || 0), 0),
    totalPaid: data
      .filter((i) => i.status === 'paid')
      .reduce((sum, i) => sum + (i.total_cents || 0), 0),
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
  return `/invoices${qs ? `?${qs}` : ''}`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; search?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page || '1', 10) || 1);
  const statusFilter = params.status || 'all';
  const searchQuery = params.search || '';

  const [{ invoices, totalCount }, stats] = await Promise.all([
    getInvoices({ page: currentPage, status: statusFilter, search: searchQuery }),
    getInvoiceStats(),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div>
      <Header title="Invoices" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-50">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">
                  {formatCents(stats.totalOutstanding)}
                </div>
                <div className="text-sm text-slate-500">Outstanding</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCents(stats.totalPaid)}
                </div>
                <div className="text-sm text-slate-500">Paid</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-50">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
                <div className="text-sm text-slate-500">Overdue</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
                <div className="text-sm text-slate-500">Total Invoices</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Invoices Table */}
        <Card padding="none">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">All Invoices</h2>
            <Link href="/invoices/new">
              <Button size="sm">
                <Plus className="w-4 h-4" />
                Create Invoice
              </Button>
            </Link>
          </div>

          {/* Search & Filter Bar */}
          <InvoicesFilters currentStatus={statusFilter} currentSearch={searchQuery} />

          {invoices.length === 0 ? (
            /* ---- Empty state ---- */
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 mb-4">
                <Inbox className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">
                No invoices found
              </h3>
              <p className="text-sm text-slate-500 mb-6 text-center max-w-xs">
                {currentPage > 1
                  ? 'There are no invoices on this page. Try going back to an earlier page.'
                  : 'No invoices match the current filters. Create an estimate to generate an invoice.'}
              </p>
              {currentPage > 1 ? (
                <Link href="/invoices?page=1">
                  <Button variant="outline" size="sm">
                    <ChevronLeft className="w-4 h-4" />
                    Back to first page
                  </Button>
                </Link>
              ) : (
                <Link href="/invoices/new">
                  <Button size="sm">
                    <Plus className="w-4 h-4" />
                    Create Invoice
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
                      Invoice
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Due Date
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
                  {invoices.map((invoice) => {
                    const statusInfo =
                      invoiceStatusConfig[invoice.status] || invoiceStatusConfig.draft;
                    const balanceCents = invoice.total_cents - (invoice.paid_cents || 0);

                    return (
                      <tr key={invoice.id} className="hover:bg-slate-50">
                        {/* Invoice Number */}
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900">
                            {invoice.invoice_number || 'No number'}
                          </div>
                        </td>

                        {/* Customer */}
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-slate-900">
                            {invoice.customer_name ?? 'Unknown'}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          <Badge className={statusInfo.color}>
                            {statusInfo.label}
                          </Badge>
                        </td>

                        {/* Amount */}
                        <td className="px-6 py-4 text-right">
                          <div className="font-semibold text-slate-900">
                            {formatCents(invoice.total_cents)}
                          </div>
                          {invoice.paid_cents > 0 && balanceCents > 0 && (
                            <div className="text-xs text-slate-500">
                              {formatCents(balanceCents)} due
                            </div>
                          )}
                        </td>

                        {/* Due Date */}
                        <td className="px-6 py-4 text-sm">
                          {invoice.due_date ? (
                            <span
                              className={
                                invoice.status === 'overdue'
                                  ? 'text-red-600 font-medium'
                                  : 'text-slate-500'
                              }
                            >
                              {formatDate(invoice.due_date)}
                            </span>
                          ) : (
                            <span className="text-slate-400">&mdash;</span>
                          )}
                        </td>

                        {/* Created */}
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {formatDate(invoice.created_at)}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/invoices/${invoice.id}`}
                              className="p-1.5 hover:bg-slate-100 rounded-md transition-colors"
                              title="View"
                            >
                              <Eye className="w-4 h-4 text-slate-400" />
                            </Link>
                            {invoice.status === 'sent' && (
                              <button
                                className="p-1.5 hover:bg-blue-50 rounded-md transition-colors"
                                title="Resend"
                              >
                                <Send className="w-4 h-4 text-blue-500" />
                              </button>
                            )}
                            <button
                              className="p-1.5 hover:bg-slate-100 rounded-md transition-colors"
                              title="Print"
                            >
                              <Printer className="w-4 h-4 text-slate-400" />
                            </button>
                          </div>
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
                invoices
              </p>

              {/* Page navigation */}
              <div className="flex items-center gap-2">
                {currentPage > 1 ? (
                  <Link
                    href={buildPaginationUrl(currentPage - 1, statusFilter, searchQuery)}
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
                    href={buildPaginationUrl(currentPage + 1, statusFilter, searchQuery)}
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
