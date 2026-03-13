// Murray's FSM - Confirm Dialog Component
// =========================================

'use client';

import { Modal } from './modal';
import { Button } from './Button';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type ConfirmVariant = 'default' | 'danger';

interface ConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  loading?: boolean;
  className?: string;
}

export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title = 'Confirm',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  loading = false,
  className,
}: ConfirmDialogProps) {
  const isDanger = variant === 'danger';

  return (
    <Modal open={open} onClose={onCancel} size="sm" className={className}>
      <div className="space-y-4">
        {/* Icon + Title */}
        <div className="flex items-start gap-3">
          {isDanger && (
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
          )}
          <div>
            <h3 className={cn('text-lg font-semibold text-slate-900', isDanger && 'text-red-900')}>
              {title}
            </h3>
            <p className="mt-1 text-sm text-slate-600">{message}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={isDanger ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
