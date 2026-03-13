// Murray's FSM - Estimate Detail Page
// =====================================
// View a single estimate with line items

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
  Star,
  User,
  Phone,
  Mail,
  Calendar,
  ArrowRightCircle,
  XCircle,
  Eye,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

// ---------- Types ----------

interface EstimateDetail {
  id: string;
  title: string;
  estimate_number: string | null;
  customer_id: string;
  status: string;
  total_cents: number;
  notes: string | null;
  valid_until: string | null;
  sent_at: string | null;
  approved_at: string | null;
  converted_job_id: string | null;
  created_at: string;
}

interface EstimateItem {
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
  viewed: { color: 'bg-indigo-100 text-indigo-800', label: 'Viewed', icon: Eye },
  approved: { color: 'bg-green-100 text-green-800', label: 'Approved', icon: CheckCircle },
  rejected: { color: 'bg-red-100 text-red-800', label: 'Rejected', icon: XCircle },
  expired: { color: 'bg-yellow-100 text-yellow-800', label: 'Expired', icon: Clock },
};

// ---------- Data Fetching ----------

async function getEstimate(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('estimates')
    .select('*')
    .eq('id', id)
    .eq('deleted', false)
    .single();

  if (error || !data) return null;
  return data as EstimateDetail;
}

async function getEstimateItems(estimateId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('estimate_items')
    .select('*')
    .eq('estimate_id', estimateId)
    .eq('deleted', false)
    .order('sort_order');

  return (data as EstimateItem[]) || [];
}

async function getCustomer(customerId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('customers')
    .select('id, name, phone, email, address')
    .eq('id', customerId)
    .single();
  return data as Customer | null;
}

// ---------- Page ----------

export default async function EstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const estimate = await getEstimate(id);

  if (!estimate) notFound();

  const [items, customer] = await Promise.all([
    getEstimateItems(id),
    getCustomer(estimate.customer_id),
  ]);

  const statusInfo = statusConfig[estimate.status] || statusConfig.draft;
  const StatusIcon = statusInfo.icon;
  const isExpired = estimate.valid_until && new Date(estimate.valid_until) < new Date();

  return (
    <div>
      <Header title="Estimate Details" />

      <div className="p-6 max-w-4xl space-y-6">
        {/* Back + Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/estimates" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-500" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {estimate.title}
              </h1>
              <p className="text-sm text-slate-500">
                {estimate.estimate_number || 'No number'} · Created {formatDate(estimate.created_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Printer className="w-4 h-4" />
              Print
            </Button>
            {estimate.status === 'draft' && (
              <Button size="sm">
                <Send className="w-4 h-4" />
                Send Estimate
              </Button>
            )}
            {estimate.status === 'approved' && !estimate.converted_job_id && (
              <Link href={`/estimates/${estimate.id}/convert`}>
                <Button variant="success" size="sm">
                  <ArrowRightCircle className="w-4 h-4" />
                  Convert to Job
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Status Banner */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${estimate.status === 'approved' ? 'bg-green-50' : estimate.status === 'rejected' ? 'bg-red-50' : 'bg-blue-50'}`}>
                <StatusIcon className={`w-5 h-5 ${estimate.status === 'approved' ? 'text-green-600' : estimate.status === 'rejected' ? 'text-red-600' : 'text-blue-600'}`} />
              </div>
              <div>
                <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                  {estimate.sent_at && (
                    <span className="flex items-center gap-1">
                      <Send className="w-3 h-3" />
                      Sent {formatDate(estimate.sent_at)}
                    </span>
                  )}
                  {estimate.approved_at && (
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Approved {formatDate(estimate.approved_at)}
                    </span>
                  )}
                  {estimate.valid_until && (
                    <span className={`flex items-center gap-1 ${isExpired ? 'text-red-500' : ''}`}>
                      <Calendar className="w-3 h-3" />
                      {isExpired ? 'Expired' : 'Valid until'} {formatDate(estimate.valid_until)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-slate-900">
                {formatCents(estimate.total_cents)}
              </div>
              <div className="text-sm text-slate-500">Total Estimate</div>
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
                <Link
                  href={`/customers/${customer.id}`}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  View Customer →
                </Link>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No customer linked</p>
            )}
          </Card>

          {/* Line Items */}
          <Card padding="none" className="p-5 col-span-2">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Line Items ({items.length})
            </h3>
            {items.length > 0 ? (
              <div className="space-y-1">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 uppercase tracking-wider px-2 py-1">
                  <div className="col-span-6">Item</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-2 text-right">Price</div>
                  <div className="col-span-2 text-right">Total</div>
                </div>
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-12 gap-2 items-center px-2 py-2.5 rounded-lg hover:bg-slate-50 text-sm"
                  >
                    <div className="col-span-6">
                      <div className="font-medium text-slate-900">{item.name}</div>
                      {item.description && (
                        <div className="text-xs text-slate-500">{item.description}</div>
                      )}
                    </div>
                    <div className="col-span-2 text-center text-slate-600">{item.qty}</div>
                    <div className="col-span-2 text-right text-slate-600">
                      {formatCents(item.unit_price_cents)}
                    </div>
                    <div className="col-span-2 text-right font-medium text-slate-900">
                      {formatCents(item.total_cents || item.qty * item.unit_price_cents)}
                    </div>
                  </div>
                ))}
                {/* Total Row */}
                <div className="grid grid-cols-12 gap-2 items-center px-2 py-3 border-t border-slate-200 mt-2">
                  <div className="col-span-10 text-right font-semibold text-slate-900">Total</div>
                  <div className="col-span-2 text-right text-lg font-bold text-slate-900">
                    {formatCents(estimate.total_cents)}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No line items recorded</p>
            )}
          </Card>
        </div>

        {/* Notes */}
        {estimate.notes && (
          <Card padding="none" className="p-5">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Star className="w-4 h-4" />
              Notes
            </h3>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{estimate.notes}</p>
          </Card>
        )}
      </div>
    </div>
  );
}
