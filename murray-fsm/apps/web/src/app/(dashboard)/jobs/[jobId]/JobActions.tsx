// Murray's FSM - Job Actions Component
// ======================================
// Status transitions, invoice creation, and payment collection.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import {
  Play, CheckCircle, FileText, DollarSign, MessageSquare, Star
} from 'lucide-react';

interface JobActionsProps {
  jobId: string;
  currentStatus: string;
  balanceDue: number;
}

export function JobActions({ jobId, currentStatus, balanceDue }: JobActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const updateStatus = async (newStatus: string) => {
    setLoading(newStatus);
    try {
      const response = await fetch(`/api/v1/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          ...(newStatus === 'in_progress' ? { started_at: new Date().toISOString() } : {}),
          ...(newStatus === 'completed' ? { completed_at: new Date().toISOString() } : {}),
        }),
      });

      if (!response.ok) throw new Error('Failed to update status');
      router.refresh();
    } catch (error) {
      console.error('Status update error:', error);
      alert('Failed to update job status');
    } finally {
      setLoading(null);
    }
  };

  const createInvoice = async () => {
    setLoading('invoice');
    try {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, autoSend: true }),
      });

      if (!response.ok) throw new Error('Failed to create invoice');
      router.refresh();
    } catch (error) {
      console.error('Invoice error:', error);
      alert('Failed to create invoice');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Status transitions */}
      {currentStatus === 'scheduled' && (
        <Button
          variant="primary"
          size="sm"
          onClick={() => updateStatus('in_progress')}
          loading={loading === 'in_progress'}
          disabled={loading !== null}
        >
          <Play className="w-4 h-4" />
          Start Job
        </Button>
      )}

      {currentStatus === 'in_progress' && (
        <Button
          variant="success"
          size="sm"
          onClick={() => updateStatus('completed')}
          loading={loading === 'completed'}
          disabled={loading !== null}
        >
          <CheckCircle className="w-4 h-4" />
          Complete Job
        </Button>
      )}

      {/* Invoice */}
      {(currentStatus === 'completed' || currentStatus === 'in_progress') && (
        <Button
          variant="outline"
          size="sm"
          onClick={createInvoice}
          loading={loading === 'invoice'}
          disabled={loading !== null}
        >
          <FileText className="w-4 h-4" />
          Create Invoice
        </Button>
      )}

      {/* Payment (balance > 0) */}
      {balanceDue > 0 && (
        <Button
          variant="outline"
          size="sm"
          disabled={loading !== null}
          onClick={() => alert('Payment collection requires Stripe setup. Use the mobile app or send an invoice link.')}
        >
          <DollarSign className="w-4 h-4" />
          Collect Payment
        </Button>
      )}
    </div>
  );
}
