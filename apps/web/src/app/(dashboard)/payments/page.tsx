// Murray's FSM - Payments Page
// ==============================

import { createAdminClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCents, formatRelativeTime, paymentStatusConfig } from '@/lib/utils';
import { CreditCard, DollarSign, CheckCircle, Clock, XCircle } from 'lucide-react';
import type { Payment, Job } from '@/types/database';

interface PaymentWithJob extends Payment {
  job: Job | null;
}

async function getPayments(): Promise<PaymentWithJob[]> {
  const supabase = createAdminClient();

  // Note: payments table may not exist in the current database schema
  const { data, error } = await supabase
    .from('payments')
    .select(`
      *,
      job:jobs(*)
    `)
    .eq('deleted', false)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    // Silently return empty if table doesn't exist
    if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
      return [];
    }
    console.error('Error fetching payments:', error);
    return [];
  }

  return data || [];
}

export default async function PaymentsPage() {
  const payments = await getPayments();

  const stats = {
    total: payments.reduce((sum, p) => sum + p.amount_cents, 0),
    succeeded: payments
      .filter((p) => p.status === 'succeeded')
      .reduce((sum, p) => sum + p.amount_cents, 0),
    pending: payments
      .filter((p) => p.status === 'pending' || p.status === 'processing')
      .reduce((sum, p) => sum + p.amount_cents, 0),
    count: payments.length,
  };

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
              All Stripe payments
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Payment
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Job
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Amount
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

                  return (
                    <tr key={payment.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 rounded-lg">
                            <CreditCard className="w-5 h-5 text-slate-600" />
                          </div>
                          <div>
                            <div className="font-mono text-sm text-slate-900">
                              {payment.stripe_payment_intent_id?.slice(0, 20)}...
                            </div>
                            <div className="text-xs text-slate-500">
                              {payment.provider}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {payment.job ? (
                          <div className="text-sm text-slate-900">
                            {payment.job.title}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">
                          {formatCents(payment.amount_cents)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {formatRelativeTime(payment.created_at)}
                      </td>
                    </tr>
                  );
                })}

                {payments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <div className="text-slate-500">No payments yet</div>
                      <div className="text-sm text-slate-400">
                        Payments will appear here after customers pay
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
