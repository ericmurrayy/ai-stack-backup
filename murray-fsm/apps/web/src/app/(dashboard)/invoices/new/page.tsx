// Murray's FSM - New Invoice Page
// =================================
// Create invoice with customer picker and service/item selection

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CustomerPicker } from '@/components/shared/CustomerPicker';
import { ServicePicker, type ServiceItem } from '@/components/shared/ServicePicker';
import { PriceInput } from '@/components/shared/PriceInput';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Send,
  FileText,
  Calendar,
} from 'lucide-react';

// ---------- Types ----------

interface LineItem {
  id: string;
  name: string;
  description: string;
  qty: number;
  unit_price_cents: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

function generateId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

// ---------- Line Item Editor ----------

function InvoiceLineItemEditor({
  item,
  onChange,
  onRemove,
  onSelectService,
}: {
  item: LineItem;
  onChange: (item: LineItem) => void;
  onRemove: () => void;
  onSelectService: (svc: ServiceItem) => void;
}) {
  const [showServicePicker, setShowServicePicker] = useState(false);

  return (
    <div className="p-3 bg-slate-50 rounded-lg space-y-2">
      {/* Service picker toggle */}
      {!item.name && !showServicePicker && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowServicePicker(true)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Pick from services/inventory
          </button>
          <span className="text-xs text-slate-400">or type below</span>
        </div>
      )}

      {showServicePicker && (
        <ServicePicker
          onSelect={(svc) => {
            onSelectService(svc);
            setShowServicePicker(false);
          }}
          placeholder="Search your services, parts, or materials..."
        />
      )}

      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-2">
          <input
            type="text"
            value={item.name}
            onChange={(e) => onChange({ ...item, name: e.target.value })}
            placeholder="Item or service name"
            className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            value={item.description}
            onChange={(e) => onChange({ ...item, description: e.target.value })}
            placeholder="Description (optional)"
            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={item.qty}
            onChange={(e) => onChange({ ...item, qty: Math.max(1, parseInt(e.target.value) || 1) })}
            min={1}
            aria-label="Quantity"
            className="w-16 px-2 py-1.5 text-sm text-center border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-xs text-slate-400">×</span>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
            <PriceInput
              cents={item.unit_price_cents}
              onChange={(c) => onChange({ ...item, unit_price_cents: c })}
              aria-label="Unit price"
              className="w-24 pl-6 pr-2 py-1.5 text-sm text-right border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <span className="text-sm font-medium text-slate-700 w-20 text-right">
            {formatCents(item.qty * item.unit_price_cents)}
          </span>
          <button
            onClick={onRemove}
            title="Remove line item"
            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Main Component ----------

export default function NewInvoicePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [notes, setNotes] = useState('');
  const [dueInDays, setDueInDays] = useState(30);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: generateId(), name: '', description: '', qty: 1, unit_price_cents: 0 },
  ]);

  const total = lineItems.reduce(
    (sum, item) => sum + item.qty * item.unit_price_cents,
    0
  );

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: generateId(), name: '', description: '', qty: 1, unit_price_cents: 0 },
    ]);
  };

  const saveInvoice = async (sendImmediately = false) => {
    if (!selectedCustomer) {
      alert('Please select a customer');
      return;
    }

    const validItems = lineItems.filter((i) => i.name.trim());
    if (validItems.length === 0) {
      alert('Please add at least one line item');
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + dueInDays);

      // Generate invoice number
      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;

      const { data: invoice, error } = await supabase
        .from('invoices')
        .insert({
          customer_id: selectedCustomer.id,
          customer_name: selectedCustomer.name,
          invoice_number: invoiceNumber,
          status: sendImmediately ? 'sent' : 'draft',
          total_cents: total,
          paid_cents: 0,
          due_date: dueDate.toISOString(),
          notes: notes || null,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Insert line items
      if (invoice) {
        const items = validItems.map((item, idx) => ({
          job_id: null,
          kind: 'invoice' as const,
          name: item.name,
          description: item.description || null,
          qty: item.qty,
          unit_price_cents: item.unit_price_cents,
          total_cents: item.qty * item.unit_price_cents,
          sort_order: idx,
        }));

        await supabase.from('line_items').insert(items);
      }

      router.push('/invoices');
      router.refresh();
    } catch (error) {
      console.error('Error saving invoice:', error);
      alert('Error saving invoice. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Create Invoice</h1>
            <p className="text-sm text-slate-500">
              Create and send a professional invoice to your customer
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => saveInvoice(false)}
            disabled={saving}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Draft'}
          </Button>
          <Button
            onClick={() => saveInvoice(true)}
            disabled={saving}
          >
            <Send className="w-4 h-4" />
            {saving ? 'Sending...' : 'Save & Send'}
          </Button>
        </div>
      </div>

      {/* Invoice Details */}
      <Card padding="none" className="p-6">
        <div className="grid grid-cols-2 gap-6">
          {/* Customer Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Customer *
            </label>
            <CustomerPicker
              selectedCustomer={selectedCustomer}
              onSelect={setSelectedCustomer}
            />
          </div>

          {/* Due Date */}
          <div>
            <label htmlFor="dueInDays" className="block text-sm font-medium text-slate-700 mb-1">
              Payment Due (days)
            </label>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="dueInDays"
                  type="number"
                  value={dueInDays}
                  onChange={(e) => setDueInDays(parseInt(e.target.value) || 30)}
                  min={1}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="text-sm text-slate-500">
                Due by {new Date(Date.now() + dueInDays * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="col-span-2">
            <label htmlFor="invoiceNotes" className="block text-sm font-medium text-slate-700 mb-1">
              Notes (shown on invoice)
            </label>
            <textarea
              id="invoiceNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment terms, thank you message, etc."
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>
      </Card>

      {/* Line Items */}
      <Card padding="none" className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-400" />
            Line Items
          </h3>
          <div className="text-sm text-slate-500">
            {lineItems.filter((i) => i.name.trim()).length} items
          </div>
        </div>

        <div className="space-y-2">
          {lineItems.map((item, index) => (
            <InvoiceLineItemEditor
              key={item.id}
              item={item}
              onChange={(updated) => {
                const items = [...lineItems];
                items[index] = updated;
                setLineItems(items);
              }}
              onRemove={() =>
                setLineItems(lineItems.filter((_, i) => i !== index))
              }
              onSelectService={(svc) => {
                const items = [...lineItems];
                items[index] = {
                  ...item,
                  name: svc.name,
                  description: svc.description || '',
                  unit_price_cents: svc.price_cents,
                };
                setLineItems(items);
              }}
            />
          ))}

          <button
            onClick={addLineItem}
            className="w-full py-2.5 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Line Item
          </button>
        </div>

        {/* Total */}
        <div className="mt-6 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Subtotal</span>
            <span className="text-sm text-slate-700">{formatCents(total)}</span>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
            <span className="text-base font-bold text-slate-900">Total Due</span>
            <span className="text-2xl font-bold text-slate-900">{formatCents(total)}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
