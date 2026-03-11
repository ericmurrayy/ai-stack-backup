// Murray's FSM - Loading Skeleton Components
// =============================================
// Reusable skeleton components for loading states

import React from 'react';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-slate-200 rounded ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

export function SkeletonText({ className = '' }: SkeletonProps) {
  return <Skeleton className={`h-4 ${className}`} />;
}

export function SkeletonCard({ className = '' }: SkeletonProps) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-6 ${className}`}>
      <div className="space-y-3">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-200 px-6 py-4 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-b border-slate-100 px-6 py-4 flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Named alias skeletons (requested by Task 2)
// ---------------------------------------------------------------------------

/**
 * TableSkeleton - A realistic data-table skeleton with header cells and body
 * rows that mimic column-aligned content.
 */
export function TableSkeleton({
  rows = 8,
  cols = 6,
  className = '',
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  // Use varied widths so the skeleton looks like real data
  const widths = ['w-3/4', 'w-1/2', 'w-2/3', 'w-1/3', 'w-2/5', 'w-1/4'];

  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}
    >
      {/* Table header row */}
      <div className="border-b border-slate-200 bg-slate-50 px-6 py-3 flex items-center gap-6">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1 max-w-[120px]" />
        ))}
      </div>

      {/* Table body rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="border-b border-slate-100 px-6 py-4 flex items-center gap-6"
        >
          {Array.from({ length: cols }).map((_, colIdx) => (
            <div key={colIdx} className="flex-1">
              <Skeleton
                className={`h-4 ${widths[(rowIdx + colIdx) % widths.length]}`}
              />
              {/* Occasionally add a second small line for two-line cells */}
              {colIdx === 0 && rowIdx % 3 === 0 && (
                <Skeleton className="h-3 w-1/3 mt-1.5" />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * CardSkeleton - A rectangular skeleton card for card-based layouts.
 * Shows an icon-sized circle, a title line, a value line, and a subtitle.
 */
export function CardSkeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 shadow-sm p-5 ${className}`}
    >
      <div className="flex items-start gap-4">
        {/* Icon placeholder */}
        <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />

        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
    </div>
  );
}

/**
 * StatSkeleton - Small skeleton for stat number cards (e.g. the 5-across
 * stats row at the top of Jobs).
 */
export function StatSkeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 ${className}`}
    >
      <Skeleton className="h-3 w-20 mb-2" />
      <Skeleton className="h-7 w-14" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page-level composite skeletons
// ---------------------------------------------------------------------------

export function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatSkeleton key={i} />
        ))}
      </div>

      {/* Table */}
      <TableSkeleton rows={8} cols={5} />
    </div>
  );
}

/**
 * JobsPageSkeleton - Matches the exact layout of the Jobs page
 * (5 stat cards + full-width table with 7 columns).
 */
export function JobsPageSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <Skeleton className="h-8 w-24" />

      {/* 5 stat cards */}
      <div className="grid grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <StatSkeleton key={i} />
        ))}
      </div>

      {/* Jobs table */}
      <TableSkeleton rows={10} cols={7} />
    </div>
  );
}
