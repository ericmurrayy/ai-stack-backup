'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Send,
  CheckCircle,
  Clock,
  AlertCircle,
  ExternalLink,
  MoreVertical
} from 'lucide-react';

interface Invoice {
  id: string;
  invoice_number: string;
  total: number;
  status: string;
  due_date: string;
  created_at: string;
  customer?: {
    name: string;
    email?: string;
    phone?: string;
  };
  job?: {
    title: string;
  };
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: 'Draft', color: 'gray', icon: Clock },
  sent: { label: 'Sent', color: 'blue', icon: Send },
  viewed: { label: 'Viewed', color: 'yellow', icon: Clock },
  paid: { label: 'Paid', color: 'green', icon: CheckCircle },
  overdue: { label: 'Overdue', color: 'red', icon: AlertCircle },
  cancelled: { label: 'Cancelled', color: 'gray', icon: Clock },
};

export function InvoiceList() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchInvoices();
  }, [filter]);

  async function fetchInvoices() {
    try {
      const url = filter === 'all'
        ? '/api/invoices'
        : `/api/invoices?status=${filter}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices || []);
      }
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
    } finally {
      setLoading(false);
    }
  }

  async function sendInvoice(invoiceId: string) {
    try {
      const res = await fetch('/api/invoices/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId,
          channels: ['whatsapp'],
        }),
      });

      if (res.ok) {
        fetchInvoices();
      }
    } catch (error) {
      console.error('Failed to send invoice:', error);
    }
  }

  async function markPaid(invoiceId: string) {
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark-paid',
          invoiceId,
        }),
      });

      if (res.ok) {
        fetchInvoices();
      }
    } catch (error) {
      console.error('Failed to mark invoice paid:', error);
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {/* Filter Tabs */}
      <div className="border-b px-4 py-3 flex gap-2">
        {['all', 'draft', 'sent', 'overdue', 'paid'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1 text-sm rounded-full transition-colors ${
              filter === status
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Invoice List */}
      <div className="divide-y">
        {invoices.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No invoices found
          </div>
        ) : (
          invoices.map((invoice) => {
            const status = statusConfig[invoice.status] || statusConfig.draft;
            const StatusIcon = status.icon;

            return (
              <div
                key={invoice.id}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full bg-${status.color}-100`}>
                      <StatusIcon className={`h-4 w-4 text-${status.color}-600`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {invoice.invoice_number}
                        </span>
                        <Badge variant={status.color as any}>
                          {status.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500">
                        {invoice.customer?.name || 'Unknown Customer'}
                        {invoice.job && ` • ${invoice.job.title}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatCurrency(invoice.total)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Due {formatDate(invoice.due_date)}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      {invoice.status === 'draft' && (
                        <Button
                          size="sm"
                          onClick={() => sendInvoice(invoice.id)}
                        >
                          <Send className="h-4 w-4 mr-1" />
                          Send
                        </Button>
                      )}
                      {['sent', 'overdue', 'viewed'].includes(invoice.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => markPaid(invoice.id)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Mark Paid
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
