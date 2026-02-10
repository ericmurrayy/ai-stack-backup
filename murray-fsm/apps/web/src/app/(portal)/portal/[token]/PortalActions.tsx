// Murray's FSM - Portal Actions Client Component
// ================================================
// Handles estimate approve/decline and invoice payment.

'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface PortalActionsProps {
  token: string;
  primaryColor: string;
}

export function EstimateActions({
  token,
  jobId,
  primaryColor,
}: {
  token: string;
  jobId: string;
  primaryColor: string;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const handleAction = async (action: 'approve' | 'decline') => {
    setLoading(action);
    try {
      const response = await fetch('/api/portal/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, jobId, action }),
      });

      if (response.ok) {
        setResult(action === 'approve' ? 'Estimate approved! Invoice created.' : 'Estimate declined.');
      } else {
        const data = await response.json();
        setResult(data.error || 'Something went wrong');
      }
    } catch {
      setResult('Failed to process. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  if (result) {
    return <span className="text-sm text-slate-600">{result}</span>;
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handleAction('decline')}
        disabled={loading !== null}
        className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 flex items-center gap-1"
      >
        {loading === 'decline' && <Loader2 className="w-3 h-3 animate-spin" />}
        Decline
      </button>
      <button
        onClick={() => handleAction('approve')}
        disabled={loading !== null}
        className="px-3 py-1.5 text-sm font-medium text-white rounded-lg disabled:opacity-50 flex items-center gap-1"
        style={{ backgroundColor: primaryColor }}
      >
        {loading === 'approve' && <Loader2 className="w-3 h-3 animate-spin" />}
        Approve
      </button>
    </div>
  );
}

export function PayButton({
  token,
  jobId,
  primaryColor,
}: {
  token: string;
  jobId: string;
  primaryColor: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/portal/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, jobId }),
      });

      const data = await response.json();

      if (response.ok && data.data?.checkoutUrl) {
        // Redirect to Stripe Checkout
        window.location.href = data.data.checkoutUrl;
      } else {
        setError(data.error || 'Payment failed');
      }
    } catch {
      setError('Failed to start payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handlePay}
        disabled={loading}
        className="px-3 py-1 text-sm font-medium text-white rounded disabled:opacity-50 flex items-center gap-1"
        style={{ backgroundColor: primaryColor }}
      >
        {loading && <Loader2 className="w-3 h-3 animate-spin" />}
        Pay
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

export function PayNowButton({
  token,
  jobIds,
  primaryColor,
  label,
}: {
  token: string;
  jobIds: string[];
  primaryColor: string;
  label: string;
}) {
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    if (jobIds.length === 0) return;
    setLoading(true);
    // Pay first unpaid invoice
    try {
      const response = await fetch('/api/portal/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, jobId: jobIds[0] }),
      });
      const data = await response.json();
      if (data.data?.checkoutUrl) {
        window.location.href = data.data.checkoutUrl;
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handlePay}
      disabled={loading}
      className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 flex items-center gap-1"
      style={{ backgroundColor: primaryColor }}
    >
      {loading && <Loader2 className="w-3 h-3 animate-spin" />}
      {label}
    </button>
  );
}
