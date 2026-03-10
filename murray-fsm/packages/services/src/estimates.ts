// Murray's FSM - Estimates Service
// ==================================
// Estimate numbering, totals, and expiration checks

import type { Estimate, EstimateItem } from '@murray-fsm/shared';
import { isBefore, parseISO, startOfDay } from 'date-fns';

// ============================================================================
// Estimate Numbering
// ============================================================================

/**
 * Generate the next sequential estimate number in EST-XXXX format.
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
 * @returns subtotal in cents and the number of items
 */
export function calculateEstimateTotals(
  items: EstimateItem[]
): { subtotal: number; itemCount: number } {
  const subtotal = items.reduce((sum, item) => sum + item.total_cents, 0);

  return {
    subtotal,
    itemCount: items.length,
  };
}

// ============================================================================
// Expiration Check
// ============================================================================

/**
 * Check if an estimate has expired based on its valid_until date.
 * An estimate without a valid_until date is never considered expired.
 */
export function isEstimateExpired(estimate: Estimate): boolean {
  if (!estimate.valid_until) return false;

  const validUntil = parseISO(estimate.valid_until);
  const today = startOfDay(new Date());

  return isBefore(validUntil, today);
}
