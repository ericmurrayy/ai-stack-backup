'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/separator';
import {
  FileText,
  Download,
  CreditCard,
  CheckCircle,
  Clock,
  AlertTriangle,
  Building2,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name?: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  tax_rate: number;
  total: number;
  status: string;
  due_date: string;
  paid_at?: string;
  payment_link?: string;
  notes?: string;
  created_at: string;
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  draft: { color: 'bg-gray-100 text-gray-800', icon: <Clock className="h-4 w-4" />, label: 'Draft' },
  sent: { color: 'bg-blue-100 text-blue-800', icon: <FileText className="h-4 w-4" />, label: 'Sent' },
  viewed: { color: 'bg-purple-100 text-purple-800', icon: <FileText className="h-4 w-4" />, label: 'Viewed' },
  paid: { color: 'bg-green-100 text-green-800', icon: <CheckCircle className="h-4 w-4" />, label: 'Paid' },
  overdue: { color: 'bg-red-100 text-red-800', icon: <AlertTriangle className="h-4 w-4" />, label: 'Overdue' },
  cancelled: { color: 'bg-gray-100 text-gray-800', icon: <Clock className="h-4 w-4" />, label: 'Cancelled' },
};

export default function InvoiceViewPage() {
  const params = useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const response = await fetch(`/api/invoices/${params.id}`);
        if (!response.ok) {
          throw new Error('Invoice not found');
        }
        const data = await response.json();
        setInvoice(data.invoice);

        // Mark as viewed
        if (data.invoice?.status === 'sent') {
          await fetch(`/api/invoices/${params.id}/view`, { method: 'POST' });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load invoice');
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchInvoice();
    }
  }, [params.id]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Invoice Not Found</CardTitle>
            <CardDescription>
              {error || 'This invoice does not exist or has been removed.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const statusInfo = statusConfig[invoice.status] || statusConfig.draft;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Company Header */}
        <div className="mb-8 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white font-bold text-2xl">M</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Murray&apos;s Field Service</h1>
          <p className="text-gray-500">Professional Home Services</p>
        </div>

        {/* Invoice Card */}
        <Card className="shadow-lg">
          <CardHeader className="border-b bg-gray-50">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-xl">Invoice #{invoice.invoice_number}</CardTitle>
                <CardDescription>
                  Issued on {formatDate(invoice.created_at)}
                </CardDescription>
              </div>
              <Badge className={`${statusInfo.color} flex items-center gap-1`}>
                {statusInfo.icon}
                {statusInfo.label}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {/* Due Date Warning */}
            {invoice.status !== 'paid' && (
              <div className={`p-4 rounded-lg ${
                invoice.status === 'overdue' ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-200'
              }`}>
                <div className="flex items-center gap-2">
                  <Clock className={`h-5 w-5 ${invoice.status === 'overdue' ? 'text-red-500' : 'text-blue-500'}`} />
                  <span className={`font-medium ${invoice.status === 'overdue' ? 'text-red-700' : 'text-blue-700'}`}>
                    {invoice.status === 'overdue' ? 'Payment Overdue' : 'Payment Due'}
                  </span>
                </div>
                <p className={`mt-1 text-sm ${invoice.status === 'overdue' ? 'text-red-600' : 'text-blue-600'}`}>
                  Due by {formatDate(invoice.due_date)}
                </p>
              </div>
            )}

            {/* Paid Confirmation */}
            {invoice.status === 'paid' && (
              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="font-medium text-green-700">Payment Received</span>
                </div>
                {invoice.paid_at && (
                  <p className="mt-1 text-sm text-green-600">
                    Paid on {formatDate(invoice.paid_at)}
                  </p>
                )}
              </div>
            )}

            {/* Line Items */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Services</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left text-sm font-medium text-gray-500 px-4 py-3">Description</th>
                      <th className="text-center text-sm font-medium text-gray-500 px-4 py-3">Qty</th>
                      <th className="text-right text-sm font-medium text-gray-500 px-4 py-3">Price</th>
                      <th className="text-right text-sm font-medium text-gray-500 px-4 py-3">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {invoice.items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3 text-gray-900">{item.description}</td>
                        <td className="px-4 py-3 text-center text-gray-600">{item.quantity}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(item.unitPrice)}</td>
                        <td className="px-4 py-3 text-right text-gray-900 font-medium">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="text-gray-900">{formatCurrency(invoice.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Tax ({invoice.tax_rate}%)</span>
                  <span className="text-gray-900">{formatCurrency(invoice.tax)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-blue-600">{formatCurrency(invoice.total)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-1">Notes</h4>
                <p className="text-sm text-gray-600">{invoice.notes}</p>
              </div>
            )}

            {/* Payment Button */}
            {invoice.status !== 'paid' && invoice.status !== 'cancelled' && invoice.payment_link && (
              <div className="pt-4">
                <a
                  href={invoice.payment_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-12 text-lg inline-flex items-center justify-center bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  <CreditCard className="mr-2 h-5 w-5" />
                  Pay {formatCurrency(invoice.total)} Now
                </a>
                <p className="text-center text-sm text-gray-500 mt-2">
                  Secure payment powered by Stripe
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact Info */}
        <div className="mt-8 text-center text-sm text-gray-500 space-y-2">
          <p>Questions about this invoice?</p>
          <div className="flex justify-center gap-6">
            <a href="tel:+15551234567" className="flex items-center gap-1 hover:text-blue-600">
              <Phone className="h-4 w-4" />
              (555) 123-4567
            </a>
            <a href="mailto:support@murrayfsm.com" className="flex items-center gap-1 hover:text-blue-600">
              <Mail className="h-4 w-4" />
              support@murrayfsm.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
