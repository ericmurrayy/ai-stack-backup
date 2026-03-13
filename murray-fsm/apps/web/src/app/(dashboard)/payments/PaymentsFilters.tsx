// Murray's FSM - Payments Search & Filter Bar
// =============================================

'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Search, X } from 'lucide-react';

const METHOD_OPTIONS = [
  { value: 'all', label: 'All Methods' },
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'ach', label: 'ACH' },
  { value: 'other', label: 'Other' },
];

interface Props {
  currentMethod: string;
  currentSearch: string;
}

export function PaymentsFilters({ currentMethod, currentSearch }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(currentSearch);

  function navigate(overrides: { method?: string; search?: string }) {
    const p = new URLSearchParams();
    const method = overrides.method ?? currentMethod;
    const q = overrides.search ?? search;

    if (method && method !== 'all') p.set('method', method);
    if (q) p.set('search', q);
    // Always reset to page 1 when filtering
    const qs = p.toString();
    startTransition(() => {
      router.push(`/payments${qs ? `?${qs}` : ''}`);
    });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate({ search });
  }

  function clearFilters() {
    setSearch('');
    navigate({ search: '', method: 'all' });
  }

  const hasFilters = currentMethod !== 'all' || currentSearch;

  return (
    <div className="px-6 py-3 border-b border-slate-200 flex items-center gap-4">
      {/* Search */}
      <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by customer name..."
          className="w-full pl-9 pr-8 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
        />
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              navigate({ search: '' });
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </form>

      {/* Payment Method Filter */}
      <select
        value={currentMethod}
        onChange={(e) => navigate({ method: e.target.value })}
        className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
      >
        {METHOD_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Clear All Filters */}
      {hasFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          Clear filters
        </button>
      )}

      {/* Loading indicator */}
      {isPending && (
        <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      )}
    </div>
  );
}
