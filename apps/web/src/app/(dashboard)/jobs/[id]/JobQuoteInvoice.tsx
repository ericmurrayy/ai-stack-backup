'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  FileText,
  DollarSign,
  Send,
  CheckCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  Plus,
  Mail,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react';

interface Quote {
  id: string;
  quote_number: string;
  status: string;
  total: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  total: number;
}

interface JobQuoteInvoiceProps {
  jobId: string;
  quote?: Quote | null;
  invoice?: Invoice | null;
  jobStatus: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  quotedAmount?: number;
  jobDescription?: string;
}

const statusConfig: Record<string, { variant: 'default' | 'success' | 'warning' | 'danger' | 'info'; label: string }> = {
  draft: { variant: 'default', label: 'Draft' },
  sent: { variant: 'info', label: 'Sent' },
  viewed: { variant: 'info', label: 'Viewed' },
  accepted: { variant: 'success', label: 'Accepted' },
  rejected: { variant: 'danger', label: 'Rejected' },
  expired: { variant: 'warning', label: 'Expired' },
  paid: { variant: 'success', label: 'Paid' },
  overdue: { variant: 'danger', label: 'Overdue' },
  cancelled: { variant: 'default', label: 'Cancelled' },
};

export function JobQuoteInvoice({
  jobId,
  quote,
  invoice,
  jobStatus,
  customerId,
  customerName,
  customerPhone,
  customerEmail,
  quotedAmount,
  jobDescription = 'Service Request',
}: JobQuoteInvoiceProps) {
  const router = useRouter();
  const [generatingQuote, setGeneratingQuote] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [sendingQuote, setSendingQuote] = useState(false);
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateQuote = async () => {
    if (!customerId || !customerName) {
      setError('Customer information is missing');
      return;
    }

    setGeneratingQuote(true);
    setError(null);
    try {
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          job_id: jobId, // Some implementations might check this
          customerId,
          customerName,
          customerPhone,
          customerEmail,
          jobDescription,
          urgency: 'normal',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate quote');
      }

      router.refresh();
    } catch (err: any) {
      console.error('Failed to generate quote:', err);
      setError(err.message || 'Failed to generate quote');
    } finally {
      setGeneratingQuote(false);
    }
  };

  const sendQuote = async () => {
    if (!quote) return;

    setSendingQuote(true);
    setError(null);
    try {
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          quoteId: quote.id,
          channels: ['email', 'whatsapp'], // Default to available channels
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send quote');
      }

      router.refresh();
    } catch (err: any) {
      console.error('Failed to send quote:', err);
      setError('Failed to send quote');
    } finally {
      setSendingQuote(false);
    }
  };

  const generateInvoice = async () => {
    setGeneratingInvoice(true);
    setError(null);
    try {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-from-job',
          jobId: jobId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate invoice');
      }

      router.refresh();
    } catch (err: any) {
      console.error('Failed to generate invoice:', err);
      setError(err.message || 'Failed to generate invoice');
    } finally {
      setGeneratingInvoice(false);
    }
  };

  const sendInvoice = async () => {
    if (!invoice) return;

    setSendingInvoice(true);
    setError(null);
    try {
      // Assuming api/invoices/send exists based on finding
      const response = await fetch('/api/invoices/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          channels: ['email', 'whatsapp'],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send invoice');
      }

      router.refresh();
    } catch (err: any) {
      console.error('Failed to send invoice:', err);
      setError('Failed to send invoice');
    } finally {
      setSendingInvoice(false);
    }
  };

  const canGenerateQuote = !quote && ['new', 'contacted', 'scheduled'].includes(jobStatus);
  const canGenerateInvoice = !invoice && ['in_progress', 'completed'].includes(jobStatus);

  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-slate-400" />
        Billing
      </h3>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-md flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Quote Section */}
        <div className="p-3 bg-slate-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Quote</span>
            {quote && (
              <Badge variant={statusConfig[quote.status]?.variant || 'default'}>
                {statusConfig[quote.status]?.label || quote.status}
              </Badge>
            )}
          </div>

          {quote ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">#{quote.quote_number}</span>
                <span className="font-semibold text-slate-900">
                  ${quote.total.toLocaleString()}
                </span>
              </div>

              <div className="flex gap-2">
                <a
                  href={`/quote/${quote.id}`}
                  className="flex-1 inline-flex justify-center items-center gap-1.5 py-1.5 px-3 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View
                </a>

                {quote.status === 'draft' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 bg-white"
                    onClick={sendQuote}
                    disabled={sendingQuote}
                  >
                    {sendingQuote ? (
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Send
                  </Button>
                )}
              </div>
            </div>
          ) : canGenerateQuote ? (
            <Button
              variant="outline"
              size="sm"
              onClick={generateQuote}
              disabled={generatingQuote}
              className="w-full bg-white"
            >
              {generatingQuote ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Generating AI Quote...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Generate Quote
                </>
              )}
            </Button>
          ) : (
            <div className="text-sm text-slate-400 italic text-center py-2">No quote available</div>
          )}
        </div>

        {/* Invoice Section */}
        <div className="p-3 bg-slate-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Invoice</span>
            {invoice && (
              <Badge variant={statusConfig[invoice.status]?.variant || 'default'}>
                {statusConfig[invoice.status]?.label || invoice.status}
              </Badge>
            )}
          </div>

          {invoice ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">#{invoice.invoice_number}</span>
                <span className="font-semibold text-slate-900">
                  ${invoice.total.toLocaleString()}
                </span>
              </div>

              <div className="flex gap-2">
                <a
                  href={`/invoice/${invoice.id}`}
                  className="flex-1 inline-flex justify-center items-center gap-1.5 py-1.5 px-3 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View
                </a>

                {invoice.status === 'draft' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 bg-white"
                    onClick={sendInvoice}
                    disabled={sendingInvoice}
                  >
                    {sendingInvoice ? (
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Send
                  </Button>
                )}
              </div>
            </div>
          ) : canGenerateInvoice ? (
            <Button
              variant="outline"
              size="sm"
              onClick={generateInvoice}
              disabled={generatingInvoice}
              className="w-full bg-white"
            >
              {generatingInvoice ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Creating Invoice...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Generate Invoice
                </>
              )}
            </Button>
          ) : (
            <div className="text-sm text-slate-400 italic text-center py-2">No invoice available</div>
          )}
        </div>

        {/* Total if quoted but no invoice yet */}
        {quotedAmount && !invoice && (
          <div className="pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Estimated Value</span>
              <span className="text-lg font-bold text-green-600">
                ${quotedAmount.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
