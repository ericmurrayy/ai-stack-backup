'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface PaymentSectionProps {
  token: string;
  jobId: string;
  jobNumber: string;
  amountDueCents: number;
  customerName: string;
}

export function PaymentSection({ token, jobId, jobNumber, amountDueCents, customerName }: PaymentSectionProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  if (amountDueCents <= 0) {
    return null;
  }

  const formattedAmount = `$${(amountDueCents / 100).toFixed(2)}`;

  async function handlePayNow() {
    setLoading(true);
    setError(null);
    setPaymentStatus('processing');
    try {
      const res = await fetch(`/api/portal/${token}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId, amount_cents: amountDueCents }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Payment request failed (${res.status})`);
      }
      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      setClientSecret(data.clientSecret || null);
      setPaymentStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setPaymentStatus('failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-slate-900">Job #{jobNumber}</h3>
          <p className="text-sm text-slate-500">Amount due: {formattedAmount}</p>
        </div>
        <div className="flex items-center gap-3">
          {paymentStatus === 'idle' && (
            <Button
              variant="primary"
              size="sm"
              onClick={handlePayNow}
              loading={loading}
              disabled={loading}
            >
              Pay {formattedAmount}
            </Button>
          )}
          {paymentStatus === 'processing' && (
            <span className="text-sm text-slate-500">Processing payment...</span>
          )}
          {paymentStatus === 'success' && (
            <div className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
              Payment link created! Opening payment form...
            </div>
          )}
          {paymentStatus === 'failed' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-600">{error}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePayNow}
                disabled={loading}
              >
                Retry
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
