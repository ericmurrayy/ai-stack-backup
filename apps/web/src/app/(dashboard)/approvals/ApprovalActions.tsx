// Murray's FSM - Approval Actions Component
// ==========================================
// Approve, reject, or edit-and-approve actions from the queue.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { CheckCircle, XCircle, Pencil, ChevronDown, ChevronUp } from 'lucide-react';

interface ApprovalActionsProps {
  actionId: string;
  payload: Record<string, unknown>;
  kind: string;
}

export function ApprovalActions({ actionId, payload, kind }: ApprovalActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editedPayload, setEditedPayload] = useState(JSON.stringify(payload, null, 2));
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showPayload, setShowPayload] = useState(false);

  const handleApprove = async (overrides?: Record<string, unknown>) => {
    setLoading('approve');
    try {
      const body: Record<string, unknown> = { actionId };
      if (overrides) body.payloadOverrides = overrides;

      const response = await fetch('/api/approvals/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to approve');
      }

      router.refresh();
    } catch (error) {
      console.error('Approval error:', error);
      alert(error instanceof Error ? error.message : 'Failed to approve action');
    } finally {
      setLoading(null);
      setShowEdit(false);
    }
  };

  const handleReject = async () => {
    setLoading('reject');
    try {
      const response = await fetch('/api/approvals/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, reason: rejectReason || undefined }),
      });

      if (!response.ok) throw new Error('Failed to reject');
      router.refresh();
    } catch (error) {
      console.error('Rejection error:', error);
      alert('Failed to reject action');
    } finally {
      setLoading(null);
      setShowRejectInput(false);
    }
  };

  const handleEditApprove = () => {
    try {
      const parsed = JSON.parse(editedPayload);
      handleApprove(parsed);
    } catch {
      alert('Invalid JSON in payload editor');
    }
  };

  return (
    <div className="space-y-2">
      {/* Main action buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowRejectInput(!showRejectInput)}
          disabled={loading !== null}
        >
          <XCircle className="w-4 h-4" />
          Reject
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setShowEdit(!showEdit);
            setShowPayload(false);
          }}
          disabled={loading !== null}
        >
          <Pencil className="w-4 h-4" />
          Edit
        </Button>
        <Button
          variant="success"
          size="sm"
          onClick={() => handleApprove()}
          loading={loading === 'approve' && !showEdit}
          disabled={loading !== null}
        >
          <CheckCircle className="w-4 h-4" />
          Approve
        </Button>
      </div>

      {/* Payload preview toggle */}
      <button
        onClick={() => {
          setShowPayload(!showPayload);
          setShowEdit(false);
        }}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
      >
        {showPayload ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {showPayload ? 'Hide' : 'Show'} payload
      </button>

      {/* Read-only payload view */}
      {showPayload && !showEdit && (
        <pre className="text-xs bg-slate-50 border rounded p-3 max-h-48 overflow-auto text-slate-600">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}

      {/* Edit panel */}
      {showEdit && (
        <div className="border rounded-lg p-3 bg-slate-50 space-y-2">
          <label className="text-xs font-medium text-slate-600">
            Edit payload before approving:
          </label>
          <textarea
            className="w-full h-40 text-xs font-mono bg-white border rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={editedPayload}
            onChange={(e) => setEditedPayload(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEdit(false)}
            >
              Cancel
            </Button>
            <Button
              variant="success"
              size="sm"
              onClick={handleEditApprove}
              loading={loading === 'approve'}
            >
              <CheckCircle className="w-4 h-4" />
              Save & Approve
            </Button>
          </div>
        </div>
      )}

      {/* Reject reason input */}
      {showRejectInput && (
        <div className="border rounded-lg p-3 bg-red-50 space-y-2">
          <input
            type="text"
            placeholder="Reason (optional)"
            className="w-full text-sm border rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleReject()}
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRejectInput(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleReject}
              loading={loading === 'reject'}
            >
              Confirm Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
