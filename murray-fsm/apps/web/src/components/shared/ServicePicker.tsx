// Murray's FSM - Service/Item Picker (autocomplete)
// ===================================================
// Searches inventory_items table for services/parts the user can add to estimates/invoices

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Search, Package, Tag } from 'lucide-react';

export interface ServiceItem {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price_cents: number;
  cost_cents: number;
  sku: string | null;
}

interface ServicePickerProps {
  onSelect: (item: ServiceItem) => void;
  placeholder?: string;
}

export function ServicePicker({
  onSelect,
  placeholder = 'Search services, parts, or materials...',
}: ServicePickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchItems = useCallback(async (searchQuery: string) => {
    setLoading(true);
    try {
      const supabase = createClient();
      let q = supabase
        .from('inventory_items')
        .select('id, name, description, category, price_cents, cost_cents, sku')
        .eq('is_active', true)
        .eq('deleted', false)
        .order('name')
        .limit(10);

      if (searchQuery.trim()) {
        q = q.or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,sku.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%`);
      }

      const { data } = await q;
      setResults(data || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchItems(value);
    }, 250);
  };

  const handleFocus = () => {
    setOpen(true);
    if (results.length === 0) {
      searchItems('');
    }
  };

  const handleSelect = (item: ServiceItem) => {
    onSelect(item);
    setQuery('');
    setOpen(false);
  };

  const formatPrice = (cents: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="w-full pl-9 pr-3 py-2 border border-dashed border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white hover:border-blue-400 transition-colors"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item)}
              className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-blue-50 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <Package className="w-4 h-4 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900 text-sm truncate">
                    {item.name}
                  </span>
                  {item.category && (
                    <span className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-full shrink-0">
                      <Tag className="w-2.5 h-2.5" />
                      {item.category}
                    </span>
                  )}
                </div>
                {item.description && (
                  <div className="text-xs text-slate-500 truncate">{item.description}</div>
                )}
                {item.sku && (
                  <div className="text-[10px] text-slate-400">SKU: {item.sku}</div>
                )}
              </div>
              <div className="text-sm font-semibold text-slate-900 shrink-0">
                {formatPrice(item.price_cents)}
              </div>
            </button>
          ))}
        </div>
      )}

      {open && results.length === 0 && query.trim() && !loading && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-4 px-3 text-center">
          <Package className="w-5 h-5 mx-auto mb-1 text-slate-300" />
          <p className="text-sm text-slate-500">No items found</p>
          <p className="text-xs text-slate-400 mt-1">
            Add services in Inventory to select them here
          </p>
        </div>
      )}
    </div>
  );
}
