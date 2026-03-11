// Murray's FSM - Estimates Search & Filter Bar
// ==============================================

'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Search, X } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
];

interface Props {
  currentStatus: string;
  currentSearch: string;
}

export function EstimatesFilters({ currentStatus, currentSearch }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(currentSearch);

  function navigate(overrides: { status?: string; search?: string }) {
    const p = new URLSearchParams();
    const status = overrides.status ?? currentStatus;
    const q = overrides.search ?? search;

    if (status && status !== 'all') p.set('status', status);
    if (q) p.set('search', q);
    // Always reset to page 1 when filtering
    const qs = p.toString();
    startTransition(() => {
      router.push(`/estimates${qs ? `?${qs}` : ''}`);
    });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate({ search });
  }

  function clearSearch() {
    setSearch('');
    navigate({ search: '' });
  }

  return (
    <div className="px-6 py-3 border-b border-slate-200 flex items-center gap-4">
      {/* Search */}
      <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search estimates..."
          className="w-full pl-9 pr-8 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
        />
        {search && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </form>

      {/* Status Filter */}
      <select
        value={currentStatus}
        onChange={(e) => navigate({ status: e.target.value })}
        className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Loading indicator */}
      {isPending && (
        <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      )}
    </div>
  );
}
