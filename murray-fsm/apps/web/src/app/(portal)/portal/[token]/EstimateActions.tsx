'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface EstimateActionsProps {
  token: string;
  estimateId: string;
  estimateNumber: string;
  totalCents: number;
}

export function EstimateActions({ token, estimateId, estimateNumber, totalCents }: EstimateActionsProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<'approved' | 'declined' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/${token}/estimates/${estimateId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to approve estimate (${res.status})`);
      }
      setResult('approved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function handleDecline() {
    if (!window.confirm('Are you sure you want to decline this estimate?')) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/${token}/estimates/${estimateId}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to decline estimate (${res.status})`);
      }
      setResult('declined');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  if (result === 'approved') {
    return (
      <Badge variant="success">
        ✓ Approved
      </Badge>
    );
  }

  if (result === 'declined') {
    return (
      <Badge variant="danger">
        ✗ Declined
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="text-xs text-red-600 mr-2">{error}</span>
      )}
      {loading ? (
        <span className="text-sm text-slate-500">Processing...</span>
      ) : (
        <>
          <Button size="sm" variant="danger" onClick={handleDecline} disabled={loading}>
            Decline
          </Button>
          <Button size="sm" variant="primary" onClick={handleApprove} disabled={loading}>
            Approve
          </Button>
        </>
      )}
    </div>
  );
}
