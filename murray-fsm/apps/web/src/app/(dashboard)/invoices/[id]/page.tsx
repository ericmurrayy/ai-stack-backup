// Murray's FSM - Invoice Detail Page
// ====================================
// View and manage a single invoice

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatCents, formatDate } from '@/lib/utils';
import {
  ArrowLeft,
  FileText,
  Send,
  Printer,
  CheckCircle,
  Clock,
  AlertTriangle,
  User,
  Phone,
  Mail,
  Calendar,
  DollarSign,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

// ---------- Types ----------

interface InvoiceDetail {
  id: string;
  invoice_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  status: string;
  total_cents: number;
  paid_cents: number;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface LineItem {
  id: string;
  name: string;
  description: string | null;
  qty: number;
  unit_price_cents: number;
  total_cents: number;
  sort_order: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

const statusConfig: Record<string, { color: string; label: string; icon: typeof Clock }> = {
  draft: { color: 'bg-slate-100 text-slate-800', label: 'Draft', icon: Clock },
  sent: { color: 'bg-blue-100 text-blue-800', label: 'Sent', icon: Send },
  paid: { color: 'bg-green-100 text-green-800', label: 'Paid', icon: CheckCircle },
  overdue: { color: 'bg-red-100 text-red-800', label: 'Overdue', icon: AlertTriangle },
  cancelled: { color: 'bg-slate-100 text-slate-500', label: 'Cancelled', icon: Clock },
};

// ---------- Data Fetching ----------

async function getInvoice(id: string) {
  const supabase = await createClient();

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('deleted', false)
    .single();

  if (error || !invoice) return null;
  return invoice as InvoiceDetail;
}

async function getCustomer(customerId: string | null) {
  if (!customerId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('customers')
    .select('id, name, phone, email, address')
    .eq('id', customerId)
    .single();
  return data as Customer | null;
}

async function getLineItems(invoiceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('line_items')
    .select('*')
    .eq('kind', 'invoice')
    .eq('deleted', false)
    .order('sort_order');
  // Note: line_items don't have invoice_id yet, return all for now
  return (data as LineItem[]) || [];
}

// ---------- Page ----------

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoice(id);

  if (!invoice) notFound();

  const customer = await getCustomer(invoice.customer_id);
  const balanceCents = invoice.total_cents - (invoice.paid_cents || 0);
  const statusInfo = statusConfig[invoice.status] || statusConfig.draft;
  const StatusIcon = statusInfo.icon;

  return (
    <div>
      <Header title="Invoice Details" />

      <div className="p-6 max-w-4xl space-y-6">
        {/* Back + Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/invoices" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-500" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {invoice.invoice_number || 'Invoice'}
              </h1>
              <p className="text-sm text-slate-500">
                Created {formatDate(invoice.created_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Printer className="w-4 h-4" />
              Print
            </Button>
            {invoice.status === 'draft' && (
              <Button size="sm">
                <Send className="w-4 h-4" />
                Send Invoice
              </Button>
            )}
          </div>
        </div>

        {/* Status Banner */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${invoice.status === 'paid' ? 'bg-green-50' : invoice.status === 'overdue' ? 'bg-red-50' : 'bg-blue-50'}`}>
                <StatusIcon className={`w-5 h-5 ${invoice.status === 'paid' ? 'text-green-600' : invoice.status === 'overdue' ? 'text-red-600' : 'text-blue-600'}`} />
              </div>
              <div>
                <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                {invoice.due_date && (
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Due {formatDate(invoice.due_date)}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-slate-900">
                {formatCents(invoice.total_cents)}
              </div>
              {invoice.paid_cents > 0 && balanceCents > 0 && (
                <div className="text-sm text-slate-500">
                  {formatCents(invoice.paid_cents)} paid · {formatCents(balanceCents)} remaining
                </div>
              )}
              {invoice.status === 'paid' && (
                <div className="text-sm text-green-600 font-medium">Fully paid</div>
              )}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-3 gap-6">
          {/* Customer Info */}
          <Card padding="none" className="p-5 col-span-1">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <User className="w-4 h-4" />
              Customer
            </h3>
            {customer ? (
              <div className="space-y-2">
                <p className="font-medium text-slate-900">{customer.name}</p>
                {customer.phone && (
                  <p className="text-sm text-slate-600 flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {customer.phone}
                  </p>
                )}
                {customer.email && (
                  <p className="text-sm text-slate-600 flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {customer.email}
                  </p>
                )}
                {customer.address && (
                  <p className="text-sm text-slate-500 mt-2">{customer.address}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                {invoice.customer_name || 'No customer assigned'}
              </p>
            )}
          </Card>

          {/* Invoice Summary */}
          <Card padding="none" className="p-5 col-span-2">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Payment Summary
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-medium text-slate-900">{formatCents(invoice.total_cents)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Amount Paid</span>
                <span className="font-medium text-green-600">{formatCents(invoice.paid_cents)}</span>
              </div>
              <div className="border-t border-slate-200 pt-3 flex justify-between">
                <span className="font-semibold text-slate-900">Balance Due</span>
                <span className="text-xl font-bold text-slate-900">{formatCents(balanceCents)}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <Card padding="none" className="p-5">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Notes
            </h3>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{invoice.notes}</p>
          </Card>
        )}
      </div>
    </div>
  );
}
