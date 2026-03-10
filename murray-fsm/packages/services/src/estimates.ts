// Murray's FSM - Estimates Service
// ==================================
// Estimate numbering, totals, expiration, stats, and conversion checks

import type { Estimate, EstimateItem } from '@murray-fsm/shared';
import {
  differenceInDays,
  isBefore,
  parseISO,
  startOfDay,
} from 'date-fns';

// ============================================================================
// Types
// ============================================================================

export interface EstimateTotals {
  subtotalCents: number;
  itemCount: number;
}

export interface EstimateStats {
  total: number;
  byStatus: Record<string, number>;
  approvalRate: number;
  avgValueCents: number;
}

// ============================================================================
// Estimate Numbering
// ============================================================================

/**
 * Generate the next sequential estimate number in EST-XXXX format.
 *
 * Parses all existing estimate numbers to find the current maximum,
 * then returns the next number in the sequence.
 *
 * @param existingNumbers - Array of existing estimate number strings (e.g., ["EST-0001", "EST-0002"])
 * @returns Next estimate number (e.g., "EST-0003")
 */
export function generateEstimateNumber(existingNumbers: string[]): string {
  let maxNum = 0;

  for (const num of existingNumbers) {
    const match = num.match(/^EST-(\d+)$/);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (parsed > maxNum) {
        maxNum = parsed;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `EST-${String(nextNum).padStart(4, '0')}`;
}

// ============================================================================
// Estimate Totals
// ============================================================================

/**
 * Calculate the subtotal and item count for an estimate's line items.
 *
 * Sums the total_cents of each line item and returns the aggregate
 * subtotal alongside the number of items.
 *
 * @param items - Array of estimate line items
 * @returns Object with subtotalCents and itemCount
 */
export function calculateEstimateTotals(
  items: EstimateItem[]
): EstimateTotals {
  const subtotalCents = items.reduce((sum, item) => sum + item.total_cents, 0);

  return {
    subtotalCents,
    itemCount: items.length,
  };
}

// ============================================================================
// Expiration Check
// ============================================================================

/**
 * Check if an estimate has expired based on its valid_until date.
 * An estimate without a valid_until date is never considered expired.
 *
 * @param estimate - The estimate to check
 * @returns True if the estimate's valid_until date is in the past
 */
export function isEstimateExpired(estimate: Estimate): boolean {
  if (!estimate.valid_until) return false;

  const validUntil = parseISO(estimate.valid_until);
  const today = startOfDay(new Date());

  return isBefore(validUntil, today);
}

// ============================================================================
// Estimate Stats
// ============================================================================

/**
 * Compute aggregate statistics for a collection of estimates.
 *
 * Returns the total count, a breakdown by status, the approval rate
 * (approved / (approved + rejected)), and the average estimate value in cents.
 *
 * @param estimates - Array of estimates to aggregate
 * @returns EstimateStats object
 */
export function getEstimateStats(estimates: Estimate[]): EstimateStats {
  const total = estimates.length;

  // Count by status
  const byStatus: Record<string, number> = {};
  for (const est of estimates) {
    byStatus[est.status] = (byStatus[est.status] ?? 0) + 1;
  }

  // Approval rate: approved / (approved + rejected)
  const approved = byStatus['approved'] ?? 0;
  const rejected = byStatus['rejected'] ?? 0;
  const decided = approved + rejected;
  const approvalRate = decided > 0 ? approved / decided : 0;

  // Average value
  const avgValueCents =
    total > 0
      ? Math.round(
          estimates.reduce((sum, est) => sum + (est.total_cents ?? 0), 0) /
            total
        )
      : 0;

  return {
    total,
    byStatus,
    approvalRate,
    avgValueCents,
  };
}

// ============================================================================
// Conversion Check
// ============================================================================

/**
 * Determine whether an estimate can be converted into a job.
 *
 * An estimate is convertible only when its status is 'approved' and
 * it has not already been linked to a job via converted_job_id.
 *
 * @param estimate - The estimate to check
 * @returns True if the estimate can be converted to a job
 */
export function canConvertToJob(estimate: Estimate): boolean {
  return estimate.status === 'approved' && !estimate.converted_job_id;
}

// ============================================================================
// Estimate Age
// ============================================================================

/**
 * Calculate the age of an estimate in days since its creation.
 *
 * @param estimate - The estimate to measure
 * @returns Number of days since the estimate was created
 */
export function getEstimateAge(estimate: Estimate): number {
  const created = parseISO(estimate.created_at);
  const now = new Date();

  return differenceInDays(now, created);
}
