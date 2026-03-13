// Murray's FSM - Add Customer Modal
// =====================================

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/Button';
import { User, Phone, Mail, MapPin, FileText } from 'lucide-react';

interface AddCustomerModalProps {
  open: boolean;
  onClose: () => void;
}

export function AddCustomerModal({ open, onClose }: AddCustomerModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const name = (form.get('name') as string).trim();
    const phone = (form.get('phone') as string).trim() || null;
    const email = (form.get('email') as string).trim() || null;
    const address = (form.get('address') as string).trim() || null;
    const notes = (form.get('notes') as string).trim() || null;

    if (!name) {
      setError('Customer name is required');
      setSaving(false);
      return;
    }

    try {
      const supabase = createClient();

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in');
        setSaving(false);
        return;
      }

      const { error: insertError } = await supabase.from('customers').insert({
        owner_id: user.id,
        name,
        phone,
        email,
        address,
        notes,
      });

      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }

      // Close modal and refresh the page data
      onClose();
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError('An unexpected error occurred');
      setSaving(false);
    }
  }

  const inputStyles =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 transition-colors';

  return (
    <Modal open={open} onClose={onClose} title="Add New Customer" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Name (required) */}
        <div>
          <label htmlFor="customer-name" className="block text-sm font-medium text-slate-700 mb-1">
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              Customer Name <span className="text-red-500">*</span>
            </span>
          </label>
          <input
            id="customer-name"
            name="name"
            type="text"
            required
            autoFocus
            placeholder="e.g. John Smith"
            className={inputStyles}
          />
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="customer-phone" className="block text-sm font-medium text-slate-700 mb-1">
            <span className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              Phone
            </span>
          </label>
          <input
            id="customer-phone"
            name="phone"
            type="tel"
            placeholder="(555) 123-4567"
            className={inputStyles}
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="customer-email" className="block text-sm font-medium text-slate-700 mb-1">
            <span className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              Email
            </span>
          </label>
          <input
            id="customer-email"
            name="email"
            type="email"
            placeholder="john@example.com"
            className={inputStyles}
          />
        </div>

        {/* Address */}
        <div>
          <label htmlFor="customer-address" className="block text-sm font-medium text-slate-700 mb-1">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              Address
            </span>
          </label>
          <input
            id="customer-address"
            name="address"
            type="text"
            placeholder="123 Main St, City, State"
            className={inputStyles}
          />
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="customer-notes" className="block text-sm font-medium text-slate-700 mb-1">
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Notes
            </span>
          </label>
          <textarea
            id="customer-notes"
            name="notes"
            rows={3}
            placeholder="Any additional notes about this customer..."
            className={inputStyles + ' resize-none'}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={saving || isPending}>
            {saving ? 'Adding...' : 'Add Customer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
