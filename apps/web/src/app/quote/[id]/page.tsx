'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/Input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FileText,
  CheckCircle,
  Clock,
  X,
  Calendar,
  Sparkles,
  Phone,
  Mail,
  AlertTriangle
} from 'lucide-react';

interface QuoteItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category?: string;
}

interface Quote {
  id: string;
  quote_number: string;
  customer_name: string;
  items: QuoteItem[];
  subtotal: number;
  tax: number;
  tax_rate: number;
  total: number;
  status: string;
  valid_until: string;
  notes?: string;
  job_description?: string;
  ai_generated?: boolean;
  created_at: string;
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  draft: { color: 'bg-gray-100 text-gray-800', icon: <Clock className="h-4 w-4" />, label: 'Draft' },
  sent: { color: 'bg-blue-100 text-blue-800', icon: <FileText className="h-4 w-4" />, label: 'Pending' },
  viewed: { color: 'bg-purple-100 text-purple-800', icon: <FileText className="h-4 w-4" />, label: 'Viewed' },
  accepted: { color: 'bg-green-100 text-green-800', icon: <CheckCircle className="h-4 w-4" />, label: 'Accepted' },
  rejected: { color: 'bg-red-100 text-red-800', icon: <X className="h-4 w-4" />, label: 'Declined' },
  expired: { color: 'bg-yellow-100 text-yellow-800', icon: <AlertTriangle className="h-4 w-4" />, label: 'Expired' },
};

export default function QuoteViewPage() {
  const params = useParams();
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [preferredDate, setPreferredDate] = useState('');

  useEffect(() => {
    const fetchQuote = async () => {
      try {
        const response = await fetch(`/api/quotes/${params.id}`);
        if (!response.ok) {
          throw new Error('Quote not found');
        }
        const data = await response.json();
        setQuote(data.quote);

        // Mark as viewed
        if (data.quote?.status === 'sent') {
          await fetch(`/api/quotes/${params.id}/view`, { method: 'POST' });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load quote');
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchQuote();
    }
  }, [params.id]);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const response = await fetch(`/api/quotes/${params.id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredDate: preferredDate || undefined }),
      });

      if (response.ok) {
        const data = await response.json();
        setShowScheduleDialog(false);
        // Refresh quote to show accepted status
        setQuote(prev => prev ? { ...prev, status: 'accepted' } : null);
      }
    } catch (err) {
      console.error('Failed to accept quote:', err);
    } finally {
      setAccepting(false);
    }
  };

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

  const isExpired = quote && new Date(quote.valid_until) < new Date() && quote.status !== 'accepted';
  const canAccept = quote && !isExpired && !['accepted', 'rejected', 'expired'].includes(quote.status);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Quote Not Found</CardTitle>
            <CardDescription>
              {error || 'This quote does not exist or has been removed.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const statusInfo = statusConfig[quote.status] || statusConfig.draft;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Company Header */}
        <div className="mb-8 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white font-bold text-2xl">M</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Murray&apos;s Field Service</h1>
          <p className="text-gray-500">Professional Home Services</p>
        </div>

        {/* Quote Card */}
        <Card className="shadow-lg">
          <CardHeader className="border-b bg-gray-50">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  Quote #{quote.quote_number}
                  {quote.ai_generated && (
                    <span title="AI Generated">
                      <Sparkles className="h-4 w-4 text-yellow-500" aria-label="AI Generated" />
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  Prepared for {quote.customer_name} on {formatDate(quote.created_at)}
                </CardDescription>
              </div>
              <Badge className={`${statusInfo.color} flex items-center gap-1`}>
                {statusInfo.icon}
                {statusInfo.label}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {/* Expiration Warning */}
            {canAccept && (
              <div className={`p-4 rounded-lg ${
                new Date(quote.valid_until) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                  ? 'bg-yellow-50 border border-yellow-200'
                  : 'bg-blue-50 border border-blue-200'
              }`}>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                  <span className="font-medium text-blue-700">
                    Quote Valid Until
                  </span>
                </div>
                <p className="mt-1 text-sm text-blue-600">
                  {formatDate(quote.valid_until)}
                </p>
              </div>
            )}

            {/* Expired Notice */}
            {isExpired && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <span className="font-medium text-red-700">Quote Expired</span>
                </div>
                <p className="mt-1 text-sm text-red-600">
                  This quote expired on {formatDate(quote.valid_until)}. Please contact us for a new quote.
                </p>
              </div>
            )}

            {/* Accepted Notice */}
            {quote.status === 'accepted' && (
              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="font-medium text-green-700">Quote Accepted!</span>
                </div>
                <p className="mt-1 text-sm text-green-600">
                  Thank you! We&apos;ll be in touch to confirm your appointment.
                </p>
              </div>
            )}

            {/* Job Description */}
            {quote.job_description && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-1">Service Description</h4>
                <p className="text-sm text-gray-600">{quote.job_description}</p>
              </div>
            )}

            {/* Line Items */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Estimated Services</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left text-sm font-medium text-gray-500 px-4 py-3">Service</th>
                      <th className="text-center text-sm font-medium text-gray-500 px-4 py-3">Qty</th>
                      <th className="text-right text-sm font-medium text-gray-500 px-4 py-3">Price</th>
                      <th className="text-right text-sm font-medium text-gray-500 px-4 py-3">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {quote.items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3">
                          <div className="text-gray-900">{item.description}</div>
                          {item.category && (
                            <div className="text-xs text-gray-500">{item.category}</div>
                          )}
                        </td>
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
                  <span className="text-gray-900">{formatCurrency(quote.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Tax ({quote.tax_rate}%)</span>
                  <span className="text-gray-900">{formatCurrency(quote.tax)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Estimated Total</span>
                  <span className="text-blue-600">{formatCurrency(quote.total)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {quote.notes && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-1">Additional Notes</h4>
                <p className="text-sm text-gray-600">{quote.notes}</p>
              </div>
            )}

            {/* Accept/Decline Buttons */}
            {canAccept && (
              <div className="pt-4 space-y-3">
                <Button
                  className="w-full h-12 text-lg bg-green-600 hover:bg-green-700"
                  size="lg"
                  onClick={() => setShowScheduleDialog(true)}
                >
                  <CheckCircle className="mr-2 h-5 w-5" />
                  Accept Quote
                </Button>
                <p className="text-center text-sm text-gray-500">
                  By accepting, you agree to the estimated pricing. Final invoice may vary based on actual work performed.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact Info */}
        <div className="mt-8 text-center text-sm text-gray-500 space-y-2">
          <p>Questions about this quote?</p>
          <div className="flex justify-center gap-6">
            <a href="tel:+15551234567" className="flex items-center gap-1 hover:text-blue-600">
              <Phone className="h-4 w-4" />
              (555) 123-4567
            </a>
            <a href="mailto:quotes@murrayfsm.com" className="flex items-center gap-1 hover:text-blue-600">
              <Mail className="h-4 w-4" />
              quotes@murrayfsm.com
            </a>
          </div>
        </div>
      </div>

      {/* Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept Quote</DialogTitle>
            <DialogDescription>
              Would you like to schedule a preferred date for the service?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Preferred Service Date (Optional)</label>
              <Input
                type="date"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
              <p className="text-xs text-gray-500">
                We&apos;ll contact you to confirm the exact time
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAccept} disabled={accepting} className="bg-green-600 hover:bg-green-700">
              {accepting ? 'Processing...' : 'Confirm & Accept'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
