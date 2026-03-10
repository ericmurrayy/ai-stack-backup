// Murray's FSM - Invoice Generation Page
// ========================================
// Convert approved estimates into invoices and track payment

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatCents, formatDate, formatRelativeTime } from '@/lib/utils';
import {
  FileText,
  DollarSign,
  CheckCircle,
  Clock,
  Send,
  Download,
  Eye,
  Plus,
  CreditCard,
  AlertTriangle,
  Printer,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';

// ---------- Types ----------

interface Invoice {
  id: string;
  title: string;
  status: string;
  total_cents: number;
  customer_name: string | null;
  customer_email: string | null;
  sent_at: string | null;
  approved_at: string | null;
  created_at: string;
  valid_until: string | null;
  notes: string | null;
  estimate_id: string;
  job_title: string | null;
}

const invoiceStatusConfig: Record<string, { color: string; label: string }> = {
  draft: { color: 'bg-slate-100 text-slate-800', label: 'Draft' },
  sent: { color: 'bg-blue-100 text-blue-800', label: 'Sent' },
  viewed: { color: 'bg-purple-100 text-purple-800', label: 'Viewed' },
  approved: { color: 'bg-green-100 text-green-800', label: 'Paid' },
  declined: { color: 'bg-red-100 text-red-800', label: 'Declined' },
  overdue: { color: 'bg-red-100 text-red-800', label: 'Overdue' },
};

// ---------- Data Fetcher ----------

async function getInvoiceData() {
  const supabase = createClient();

  // In Murray's FSM, invoices are estimates that have been sent/approved
  // An "approved" estimate = paid invoice, "sent" = outstanding invoice
  const { data } = await supabase
    .from('estimates')
    .select(`
      id, title, status, total_cents, notes, sent_at, approved_at, created_at, valid_until,
      customer:customers(name, email),
      converted_job:jobs!estimates_converted_job_id_fkey(title)
    `)
    .eq('deleted', false)
    .in('status', ['sent', 'approved', 'declined'])
    .order('created_at', { ascending: false });

  const invoices: Invoice[] = (data || []).map((e: any) => ({
    id: e.id,
    title: e.title,
    status: e.valid_until && new Date(e.valid_until) < new Date() && e.status === 'sent' ? 'overdue' : e.status,
    total_cents: e.total_cents || 0,
    customer_name: Array.isArray(e.customer) ? e.customer[0]?.name : e.customer?.name ?? null,
    customer_email: Array.isArray(e.customer) ? e.customer[0]?.email : e.customer?.email ?? null,
    sent_at: e.sent_at,
    approved_at: e.approved_at,
    created_at: e.created_at,
    valid_until: e.valid_until,
    notes: e.notes,
    estimate_id: e.id,
    job_title: Array.isArray(e.converted_job) ? e.converted_job[0]?.title : e.converted_job?.title ?? null,
  }));

  const stats = {
    totalOutstanding: invoices
      .filter(i => ['sent', 'overdue'].includes(i.status))
      .reduce((sum, i) => sum + i.total_cents, 0),
    totalPaid: invoices
      .filter(i => i.status === 'approved')
      .reduce((sum, i) => sum + i.total_cents, 0),
    overdue: invoices.filter(i => i.status === 'overdue').length,
    outstanding: invoices.filter(i => i.status === 'sent').length,
    paid: invoices.filter(i => i.status === 'approved').length,
    total: invoices.length,
  };

  return { invoices, stats };
}

// ---------- Page ----------

export default async function InvoicesPage() {
  const { invoices, stats } = await getInvoiceData();

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
                <div className="text-2xl font-bold text-yellow-600">{formatCents(stats.totalOutstanding)}</div>
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
                <div className="text-2xl font-bold text-green-600">{formatCents(stats.totalPaid)}</div>
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

        {/* Filters + Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg">
              All ({stats.total})
            </button>
            <button className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg">
              Outstanding ({stats.outstanding})
            </button>
            <button className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg">
              Paid ({stats.paid})
            </button>
            {stats.overdue > 0 && (
              <button className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg">
                Overdue ({stats.overdue})
              </button>
            )}
          </div>
          <Link href="/estimates/new">
            <Button>
              <Plus className="w-4 h-4" />
              Create Invoice
            </Button>
          </Link>
        </div>

        {/* Invoices Table */}
        <Card padding="none">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Invoice</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Customer</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">Amount</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Sent</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Due</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {invoices.map((invoice) => {
                const statusInfo = invoiceStatusConfig[invoice.status] || invoiceStatusConfig.draft;
                return (
                  <tr key={invoice.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{invoice.title}</div>
                      {invoice.job_title && (
                        <div className="text-xs text-slate-500 mt-0.5">{invoice.job_title}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-900">{invoice.customer_name ?? 'Unknown'}</div>
                      {invoice.customer_email && (
                        <div className="text-xs text-slate-500">{invoice.customer_email}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-semibold text-slate-900">{formatCents(invoice.total_cents)}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {invoice.sent_at ? formatRelativeTime(invoice.sent_at) : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {invoice.valid_until ? (
                        <span className={invoice.status === 'overdue' ? 'text-red-600 font-medium' : 'text-slate-500'}>
                          {formatDate(invoice.valid_until)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button className="p-1.5 hover:bg-slate-100 rounded-md transition-colors" title="View">
                          <Eye className="w-4 h-4 text-slate-400" />
                        </button>
                        {invoice.status === 'sent' && (
                          <button className="p-1.5 hover:bg-blue-50 rounded-md transition-colors" title="Resend">
                            <Send className="w-4 h-4 text-blue-500" />
                          </button>
                        )}
                        <button className="p-1.5 hover:bg-slate-100 rounded-md transition-colors" title="Print">
                          <Printer className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <div className="text-slate-500 font-medium">No invoices yet</div>
                    <div className="text-sm text-slate-400 mt-1">
                      Create an estimate and send it to generate an invoice
                    </div>
                    <Link href="/estimates/new" className="inline-block mt-4">
                      <Button>
                        <Plus className="w-4 h-4" />
                        Create Your First Invoice
                      </Button>
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
