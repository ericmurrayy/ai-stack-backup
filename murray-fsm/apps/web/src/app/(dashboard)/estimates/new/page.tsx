// Murray's FSM - New Estimate (GBB) Page
// ========================================
// Good-Better-Best estimate builder
// This is the feature that ServiceTitan uses to increase avg ticket size

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  FileText,
  Plus,
  Trash2,
  DollarSign,
  CheckCircle,
  Shield,
  Crown,
  Star,
  ArrowLeft,
  Send,
  Save,
} from 'lucide-react';

// ---------- Types ----------

interface LineItem {
  id: string;
  name: string;
  description: string;
  qty: number;
  unit_price_cents: number;
}

interface GBBTier {
  id: string;
  tier: 'good' | 'better' | 'best';
  label: string;
  tagline: string;
  lineItems: LineItem[];
  recommended: boolean;
}

const tierConfig = {
  good: {
    icon: CheckCircle,
    color: 'border-slate-300 bg-white',
    headerBg: 'bg-slate-100',
    headerText: 'text-slate-800',
    badgeColor: 'bg-slate-200 text-slate-700',
    description: 'Basic repair — gets the job done',
  },
  better: {
    icon: Star,
    color: 'border-blue-400 bg-white ring-2 ring-blue-100',
    headerBg: 'bg-blue-600',
    headerText: 'text-white',
    badgeColor: 'bg-blue-100 text-blue-800',
    description: 'Standard quality — best value',
  },
  best: {
    icon: Crown,
    color: 'border-yellow-400 bg-white',
    headerBg: 'bg-gradient-to-r from-yellow-500 to-amber-600',
    headerText: 'text-white',
    badgeColor: 'bg-yellow-100 text-yellow-800',
    description: 'Premium solution — lifetime peace of mind',
  },
};

function generateId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function formatCentsInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

function parseDollarsToCents(dollars: string): number {
  const num = parseFloat(dollars);
  return isNaN(num) ? 0 : Math.round(num * 100);
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

function LineItemEditor({
  item,
  onChange,
  onRemove,
}: {
  item: LineItem;
  onChange: (item: LineItem) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
      <div className="flex-1 space-y-2">
        <input
          type="text"
          value={item.name}
          onChange={(e) => onChange({ ...item, name: e.target.value })}
          placeholder="Item name (e.g. Water Heater, Labor)"
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
          <input
            type="text"
            value={formatCentsInput(item.unit_price_cents)}
            onChange={(e) => onChange({ ...item, unit_price_cents: parseDollarsToCents(e.target.value) })}
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
  );
}

// ---------- GBB Tier Card ----------

function GBBTierCard({
  tier,
  onUpdate,
}: {
  tier: GBBTier;
  onUpdate: (tier: GBBTier) => void;
}) {
  const config = tierConfig[tier.tier];
  const TierIcon = config.icon;
  const total = tier.lineItems.reduce((sum, item) => sum + item.qty * item.unit_price_cents, 0);

  const addLineItem = () => {
    onUpdate({
      ...tier,
      lineItems: [
        ...tier.lineItems,
        { id: generateId(), name: '', description: '', qty: 1, unit_price_cents: 0 },
      ],
    });
  };

  const updateLineItem = (index: number, item: LineItem) => {
    const items = [...tier.lineItems];
    items[index] = item;
    onUpdate({ ...tier, lineItems: items });
  };

  const removeLineItem = (index: number) => {
    onUpdate({
      ...tier,
      lineItems: tier.lineItems.filter((_, i) => i !== index),
    });
  };

  return (
    <div className={`border-2 rounded-xl overflow-hidden transition-all ${config.color}`}>
      {/* Tier Header */}
      <div className={`px-4 py-3 ${config.headerBg} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <TierIcon className={`w-5 h-5 ${config.headerText}`} />
          <div>
            <input
              type="text"
              value={tier.label}
              onChange={(e) => onUpdate({ ...tier, label: e.target.value })}
              className={`bg-transparent font-semibold text-lg focus:outline-none ${config.headerText} placeholder:opacity-70`}
              placeholder={`${tier.tier.charAt(0).toUpperCase() + tier.tier.slice(1)} Option`}
            />
            <input
              type="text"
              value={tier.tagline}
              onChange={(e) => onUpdate({ ...tier, tagline: e.target.value })}
              className={`block bg-transparent text-sm focus:outline-none ${config.headerText} opacity-80 placeholder:opacity-50 w-full`}
              placeholder={config.description}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tier.recommended && (
            <Badge className="bg-white/20 text-white text-xs font-semibold">
              RECOMMENDED
            </Badge>
          )}
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={tier.recommended}
              onChange={(e) => onUpdate({ ...tier, recommended: e.target.checked })}
              className="rounded border-white/30"
            />
            <span className={`text-xs ${config.headerText} opacity-75`}>Recommended</span>
          </label>
        </div>
      </div>

      {/* Line Items */}
      <div className="p-4 space-y-2">
        {tier.lineItems.map((item, index) => (
          <LineItemEditor
            key={item.id}
            item={item}
            onChange={(updated) => updateLineItem(index, updated)}
            onRemove={() => removeLineItem(index)}
          />
        ))}

        <button
          onClick={addLineItem}
          className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Add Line Item
        </button>
      </div>

      {/* Total */}
      <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-600">Total</span>
        <span className="text-xl font-bold text-slate-900">{formatCents(total)}</span>
      </div>
    </div>
  );
}

// ---------- Main Component ----------

export default function NewEstimatePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [estimateTitle, setEstimateTitle] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [validDays, setValidDays] = useState(30);
  const [useGBB, setUseGBB] = useState(true);

  // GBB Tiers
  const [tiers, setTiers] = useState<GBBTier[]>([
    {
      id: generateId(),
      tier: 'good',
      label: 'Good',
      tagline: 'Basic repair — gets the job done',
      lineItems: [{ id: generateId(), name: '', description: '', qty: 1, unit_price_cents: 0 }],
      recommended: false,
    },
    {
      id: generateId(),
      tier: 'better',
      label: 'Better',
      tagline: 'Standard quality — best value',
      lineItems: [{ id: generateId(), name: '', description: '', qty: 1, unit_price_cents: 0 }],
      recommended: true,
    },
    {
      id: generateId(),
      tier: 'best',
      label: 'Best',
      tagline: 'Premium solution — lifetime peace of mind',
      lineItems: [{ id: generateId(), name: '', description: '', qty: 1, unit_price_cents: 0 }],
      recommended: false,
    },
  ]);

  // Single estimate (no GBB)
  const [singleLineItems, setSingleLineItems] = useState<LineItem[]>([
    { id: generateId(), name: '', description: '', qty: 1, unit_price_cents: 0 },
  ]);

  const updateTier = (index: number, tier: GBBTier) => {
    const updated = [...tiers];
    updated[index] = tier;
    setTiers(updated);
  };

  const saveEstimate = async (sendImmediately = false) => {
    if (!estimateTitle.trim()) {
      alert('Please enter an estimate title');
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();

      if (useGBB) {
        // Create 3 separate estimates (one per tier) linked by title prefix
        for (const tier of tiers) {
          const total = tier.lineItems.reduce(
            (sum, item) => sum + item.qty * item.unit_price_cents,
            0
          );

          const validUntil = new Date();
          validUntil.setDate(validUntil.getDate() + validDays);

          const { data: estimate, error } = await supabase
            .from('estimates')
            .insert({
              title: `${estimateTitle} — ${tier.label}`,
              customer_id: selectedCustomerId,
              status: sendImmediately ? 'sent' : 'draft',
              total_cents: total,
              notes: `${tier.tagline}\n\n${notes}${tier.recommended ? '\n\n★ RECOMMENDED OPTION' : ''}`,
              valid_until: validUntil.toISOString().split('T')[0],
              sent_at: sendImmediately ? new Date().toISOString() : null,
            })
            .select('id')
            .single();

          if (error) throw error;

          // Insert line items
          if (estimate) {
            const items = tier.lineItems
              .filter(item => item.name.trim())
              .map((item, idx) => ({
                estimate_id: estimate.id,
                name: item.name,
                description: item.description || null,
                qty: item.qty,
                unit_price_cents: item.unit_price_cents,
                total_cents: item.qty * item.unit_price_cents,
                sort_order: idx,
              }));

            if (items.length > 0) {
              await supabase.from('estimate_items').insert(items);
            }
          }
        }
      } else {
        // Single estimate
        const total = singleLineItems.reduce(
          (sum, item) => sum + item.qty * item.unit_price_cents,
          0
        );

        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + validDays);

        const { data: estimate, error } = await supabase
          .from('estimates')
          .insert({
            title: estimateTitle,
            customer_id: selectedCustomerId,
            status: sendImmediately ? 'sent' : 'draft',
            total_cents: total,
            notes: notes || null,
            valid_until: validUntil.toISOString().split('T')[0],
            sent_at: sendImmediately ? new Date().toISOString() : null,
          })
          .select('id')
          .single();

        if (error) throw error;

        if (estimate) {
          const items = singleLineItems
            .filter(item => item.name.trim())
            .map((item, idx) => ({
              estimate_id: estimate.id,
              name: item.name,
              description: item.description || null,
              qty: item.qty,
              unit_price_cents: item.unit_price_cents,
              total_cents: item.qty * item.unit_price_cents,
              sort_order: idx,
            }));

          if (items.length > 0) {
            await supabase.from('estimate_items').insert(items);
          }
        }
      }

      router.push('/estimates');
      router.refresh();
    } catch (error) {
      console.error('Error saving estimate:', error);
      alert('Error saving estimate. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const singleTotal = singleLineItems.reduce(
    (sum, item) => sum + item.qty * item.unit_price_cents,
    0
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">New Estimate</h1>
            <p className="text-sm text-slate-500">
              Create a Good-Better-Best presentation or single estimate
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => saveEstimate(false)}
            disabled={saving}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Draft'}
          </Button>
          <Button
            onClick={() => saveEstimate(true)}
            disabled={saving}
          >
            <Send className="w-4 h-4" />
            {saving ? 'Sending...' : 'Save & Send'}
          </Button>
        </div>
      </div>

      {/* Estimate Details */}
      <Card padding="none" className="p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Estimate Title *
            </label>
            <input
              type="text"
              value={estimateTitle}
              onChange={(e) => setEstimateTitle(e.target.value)}
              placeholder="e.g. Water Heater Replacement, AC Repair"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Customer
            </label>
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Search customer by name or phone..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Valid for (days)
            </label>
            <input
              type="number"
              value={validDays}
              onChange={(e) => setValidDays(parseInt(e.target.value) || 30)}
              min={1}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes (internal)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes about this estimate..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </Card>

      {/* GBB Toggle */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setUseGBB(true)}
          className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors ${
            useGBB
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
          }`}
        >
          <Star className="w-4 h-4" />
          Good · Better · Best
        </button>
        <button
          onClick={() => setUseGBB(false)}
          className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors ${
            !useGBB
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-4 h-4" />
          Single Estimate
        </button>
      </div>

      {/* GBB Tiers */}
      {useGBB ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {tiers.map((tier, index) => (
            <GBBTierCard
              key={tier.id}
              tier={tier}
              onUpdate={(updated) => updateTier(index, updated)}
            />
          ))}
        </div>
      ) : (
        /* Single Estimate */
        <Card padding="none" className="p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Line Items</h3>
          <div className="space-y-2">
            {singleLineItems.map((item, index) => (
              <LineItemEditor
                key={item.id}
                item={item}
                onChange={(updated) => {
                  const items = [...singleLineItems];
                  items[index] = updated;
                  setSingleLineItems(items);
                }}
                onRemove={() =>
                  setSingleLineItems(singleLineItems.filter((_, i) => i !== index))
                }
              />
            ))}
            <button
              onClick={() =>
                setSingleLineItems([
                  ...singleLineItems,
                  { id: generateId(), name: '', description: '', qty: 1, unit_price_cents: 0 },
                ])
              }
              className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Line Item
            </button>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between">
            <span className="text-sm font-medium text-slate-600">Total</span>
            <span className="text-xl font-bold text-slate-900">{formatCents(singleTotal)}</span>
          </div>
        </Card>
      )}
    </div>
  );
}
