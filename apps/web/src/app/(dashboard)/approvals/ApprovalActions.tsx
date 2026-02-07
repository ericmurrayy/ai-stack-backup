// Murray's FSM - Approval Actions Component
// ==========================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { CheckCircle, XCircle } from 'lucide-react';

interface ApprovalActionsProps {
  actionId: string;
}

export function ApprovalActions({ actionId }: ApprovalActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);

  const handleApprove = async () => {
    setLoading('approve');
    try {
      const response = await fetch('/api/approvals/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to approve');
      }

      router.refresh();
    } catch (error) {
      console.error('Approval error:', error);
      alert('Failed to approve action');
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async () => {
    setLoading('reject');
    try {
      const response = await fetch('/api/approvals/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to reject');
      }

      router.refresh();
    } catch (error) {
      console.error('Rejection error:', error);
      alert('Failed to reject action');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleReject}
        loading={loading === 'reject'}
        disabled={loading !== null}
      >
        <XCircle className="w-4 h-4" />
        Reject
      </Button>
      <Button
        variant="success"
        size="sm"
        onClick={handleApprove}
        loading={loading === 'approve'}
        disabled={loading !== null}
      >
        <CheckCircle className="w-4 h-4" />
        Approve
      </Button>
    </div>
  );
}
