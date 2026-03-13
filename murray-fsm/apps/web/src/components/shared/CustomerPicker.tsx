// Murray's FSM - Customer Picker (autocomplete)
// ==============================================
// Searches customers table with debounced input and dropdown selection

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Search, User, X, Phone, Mail } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

interface CustomerPickerProps {
  selectedCustomer: Customer | null;
  onSelect: (customer: Customer | null) => void;
  placeholder?: string;
}

export function CustomerPicker({
  selectedCustomer,
  onSelect,
  placeholder = 'Search customer by name, phone, or email...',
}: CustomerPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchCustomers = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('customers')
        .select('id, name, phone, email, address')
        .or(`name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .eq('deleted', false)
        .order('name')
        .limit(8);

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

    // Debounce search
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchCustomers(value);
    }, 250);
  };

  const handleSelect = (customer: Customer) => {
    onSelect(customer);
    setQuery('');
    setOpen(false);
  };

  const handleClear = () => {
    onSelect(null);
    setQuery('');
    setResults([]);
  };

  // Show all customers when focusing empty input
  const handleFocus = () => {
    setOpen(true);
    if (!query.trim() && results.length === 0) {
      searchCustomers(''); // Will show nothing
      // Load recent customers instead
      const supabase = createClient();
      supabase
        .from('customers')
        .select('id, name, phone, email, address')
        .eq('deleted', false)
        .order('updated_at', { ascending: false })
        .limit(8)
        .then(({ data }) => {
          if (data) setResults(data);
        });
    }
  };

  if (selectedCustomer) {
    return (
      <div className="flex items-center gap-3 px-3 py-2 border border-slate-300 rounded-lg bg-slate-50">
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
          {selectedCustomer.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-slate-900 text-sm truncate">
            {selectedCustomer.name}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            {selectedCustomer.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {selectedCustomer.phone}
              </span>
            )}
            {selectedCustomer.email && (
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3" />
                {selectedCustomer.email}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear customer"
          className="p-1 hover:bg-slate-200 rounded-md transition-colors"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>
    );
  }

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
          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Dropdown */}
      {open && (results.length > 0 || query.trim()) && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {results.length > 0 ? (
            results.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => handleSelect(customer)}
                className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-sm shrink-0">
                  {customer.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 text-sm truncate">
                    {customer.name}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    {customer.phone && <span>{customer.phone}</span>}
                    {customer.email && <span>{customer.email}</span>}
                  </div>
                </div>
              </button>
            ))
          ) : query.trim() && !loading ? (
            <div className="px-4 py-3 text-sm text-slate-500 text-center">
              <User className="w-5 h-5 mx-auto mb-1 text-slate-300" />
              No customers found for &ldquo;{query}&rdquo;
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
