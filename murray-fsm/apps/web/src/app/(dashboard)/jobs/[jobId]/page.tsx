// Murray's FSM - Job Detail / Closeout Page
// ============================================
// View job details, add notes/photos, create invoice, collect payment.

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCents, formatDateTime, jobStatusConfig } from '@/lib/utils';
import { Calendar, MapPin, Phone, Mail, FileText, DollarSign, Camera, Clock } from 'lucide-react';
import { JobActions } from './JobActions';

interface Props {
  params: { jobId: string };
}

async function getJob(jobId: string) {
  const supabase = createClient();

  const { data: job, error } = await supabase
    .from('jobs')
    .select(`
      *,
      customer:customers(id, name, phone, email),
      location:locations(id, address1, address2, city, state, postal_code, lat, lng, access_notes)
    `)
    .eq('id', jobId)
    .eq('deleted', false)
    .single();

  if (error) return null;

  // Fetch related data in parallel
  const [
    { data: lineItems },
    { data: photos },
    { data: payments },
    { data: signatures },
  ] = await Promise.all([
    supabase
      .from('line_items')
      .select('*')
      .eq('job_id', jobId)
      .eq('deleted', false)
      .order('kind')
      .order('sort_order'),
    supabase
      .from('job_photos')
      .select('*')
      .eq('job_id', jobId)
      .eq('deleted', false)
      .order('captured_at', { ascending: false }),
    supabase
      .from('payments')
      .select('*')
      .eq('job_id', jobId)
      .eq('deleted', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('job_signatures')
      .select('*')
      .eq('job_id', jobId)
      .eq('deleted', false),
  ]);

  return {
    ...job,
    lineItems: lineItems ?? [],
    photos: photos ?? [],
    payments: payments ?? [],
    signatures: signatures ?? [],
  };
}

export default async function JobDetailPage({ params }: Props) {
  const job = await getJob(params.jobId);

  if (!job) {
    return (
      <div>
        <Header title="Job Not Found" />
        <div className="p-6 text-center text-slate-500">This job doesn't exist or has been deleted.</div>
      </div>
    );
  }

  const statusConfig = jobStatusConfig[job.status] ?? { label: job.status, color: 'bg-slate-100 text-slate-800' };
  const estimateItems = job.lineItems.filter((i: { kind: string }) => i.kind === 'estimate');
  const invoiceItems = job.lineItems.filter((i: { kind: string }) => i.kind === 'invoice');
  const totalPaid = job.payments
    .filter((p: { status: string }) => p.status === 'succeeded')
    .reduce((sum: number, p: { amount_cents: number }) => sum + p.amount_cents, 0);
  const balanceDue = (job.total_invoice_cents || 0) - totalPaid;

  return (
    <div>
      <Header title={job.title} />

      <div className="p-6 space-y-6">
        {/* Status bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
            {job.service_type && (
              <span className="text-sm text-slate-500">{job.service_type}</span>
            )}
          </div>
          <JobActions jobId={job.id} currentStatus={job.status} balanceDue={balanceDue} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Schedule */}
            <Card>
              <CardHeader><CardTitle>Schedule</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {job.scheduled_start && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>Start: {formatDateTime(job.scheduled_start)}</span>
                    </div>
                  )}
                  {job.scheduled_end && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span>End: {formatDateTime(job.scheduled_end)}</span>
                    </div>
                  )}
                  {job.arrived_at && (
                    <div className="text-green-600">Arrived: {formatDateTime(job.arrived_at)}</div>
                  )}
                  {job.completed_at && (
                    <div className="text-green-600">Completed: {formatDateTime(job.completed_at)}</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Line Items */}
            {(estimateItems.length > 0 || invoiceItems.length > 0) && (
              <Card padding="none">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Line Items
                  </h3>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left px-6 py-2 text-xs font-medium text-slate-500">Type</th>
                      <th className="text-left px-6 py-2 text-xs font-medium text-slate-500">Item</th>
                      <th className="text-right px-6 py-2 text-xs font-medium text-slate-500">Qty</th>
                      <th className="text-right px-6 py-2 text-xs font-medium text-slate-500">Price</th>
                      <th className="text-right px-6 py-2 text-xs font-medium text-slate-500">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {job.lineItems.map((item: {
                      id: string; kind: string; name: string; description: string;
                      qty: number; unit_price_cents: number; total_cents: number;
                    }) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-6 py-2">
                          <Badge variant={item.kind === 'invoice' ? 'info' : 'default'}>
                            {item.kind}
                          </Badge>
                        </td>
                        <td className="px-6 py-2">
                          <div className="font-medium">{item.name}</div>
                          {item.description && (
                            <div className="text-xs text-slate-500">{item.description}</div>
                          )}
                        </td>
                        <td className="px-6 py-2 text-right">{item.qty}</td>
                        <td className="px-6 py-2 text-right">{formatCents(item.unit_price_cents)}</td>
                        <td className="px-6 py-2 text-right font-medium">{formatCents(item.total_cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-6 py-3 border-t bg-slate-50 flex justify-between text-sm">
                  <span className="font-medium">
                    {invoiceItems.length > 0 ? 'Invoice Total' : 'Estimate Total'}
                  </span>
                  <span className="font-bold">
                    {formatCents(invoiceItems.length > 0 ? job.total_invoice_cents : job.total_estimate_cents)}
                  </span>
                </div>
              </Card>
            )}

            {/* Notes */}
            {(job.internal_notes || job.customer_notes || job.problem_description) && (
              <Card>
                <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {job.problem_description && (
                    <div>
                      <div className="font-medium text-slate-700">Problem</div>
                      <div className="text-slate-600">{job.problem_description}</div>
                    </div>
                  )}
                  {job.internal_notes && (
                    <div>
                      <div className="font-medium text-slate-700">Internal Notes</div>
                      <div className="text-slate-600">{job.internal_notes}</div>
                    </div>
                  )}
                  {job.customer_notes && (
                    <div>
                      <div className="font-medium text-slate-700">Customer Notes</div>
                      <div className="text-slate-600">{job.customer_notes}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Photos */}
            {job.photos.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    Photos ({job.photos.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    {job.photos.map((photo: { id: string; kind: string; caption: string }) => (
                      <div key={photo.id} className="aspect-square bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                        <div className="text-center">
                          <Camera className="w-8 h-8 mx-auto mb-1" />
                          <div className="text-xs">{photo.kind}</div>
                          {photo.caption && <div className="text-xs mt-1">{photo.caption}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Customer */}
            {job.customer && (
              <Card>
                <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="font-medium text-slate-900">{job.customer.name}</div>
                  {job.customer.phone && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Phone className="w-3 h-3" />
                      {job.customer.phone}
                    </div>
                  )}
                  {job.customer.email && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Mail className="w-3 h-3" />
                      {job.customer.email}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Location */}
            {job.location && (
              <Card>
                <CardHeader><CardTitle>Location</CardTitle></CardHeader>
                <CardContent className="text-sm">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                    <div>
                      <div>{job.location.address1}</div>
                      {job.location.address2 && <div>{job.location.address2}</div>}
                      <div>{job.location.city}, {job.location.state} {job.location.postal_code}</div>
                    </div>
                  </div>
                  {job.location.access_notes && (
                    <div className="mt-2 text-xs text-slate-500">
                      Access: {job.location.access_notes}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Payment Summary */}
            <Card>
              <CardHeader><CardTitle>Payment</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Estimate</span>
                  <span>{formatCents(job.total_estimate_cents || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Invoice</span>
                  <span>{formatCents(job.total_invoice_cents || 0)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Paid</span>
                  <span>{formatCents(totalPaid)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>Balance Due</span>
                  <span className={balanceDue > 0 ? 'text-red-600' : 'text-green-600'}>
                    {formatCents(Math.max(0, balanceDue))}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
