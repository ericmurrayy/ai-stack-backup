// Murray's FSM - Agreements Service
// ====================================
// Service agreement expiration, recurring revenue, value calculations, and stats

import type { ServiceAgreement, BillingCycle } from '@murray-fsm/shared';
import { parseISO, differenceInDays, isBefore, addDays } from 'date-fns';

// ============================================================================
// Types
// ============================================================================

export interface AgreementStats {
  total: number;
  activeCount: number;
  mrr: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
}

// ============================================================================
// Agreement Status Checks
// ============================================================================

/**
 * Check if a service agreement is currently active.
 * An agreement is active when its status is 'active' AND the end_date
 * has not passed.
 *
 * @param agreement - The service agreement to check
 * @returns true if the agreement is active and not past its end date
 */
export function isAgreementActive(agreement: ServiceAgreement): boolean {
  if (agreement.status !== 'active') return false;
  if (!agreement.end_date) return true;

  const endDate = parseISO(agreement.end_date);
  const today = new Date();

  return !isBefore(endDate, today);
}

/**
 * Check if a service agreement is expiring within a given number of days.
 *
 * @param agreement - The service agreement to check
 * @param withinDays - Number of days to look ahead (default: 30)
 * @returns true if the agreement ends within the specified period
 */
export function isAgreementExpiring(
  agreement: ServiceAgreement,
  withinDays: number = 30
): boolean {
  if (!agreement.end_date) return false;
  if (agreement.status !== 'active') return false;

  const endDate = parseISO(agreement.end_date);
  const today = new Date();
  const daysUntilExpiry = differenceInDays(endDate, today);

  return daysUntilExpiry >= 0 && daysUntilExpiry <= withinDays;
}

// ============================================================================
// Agreement Value Calculations
// ============================================================================

/**
 * Normalize an agreement's price to a monthly value based on its billing cycle.
 *
 * Conversion:
 * - monthly: price_cents as-is
 * - quarterly: price_cents / 3
 * - annual: price_cents / 12
 *
 * @param agreement - The service agreement
 * @returns Monthly value in cents
 */
export function calculateAgreementValue(agreement: ServiceAgreement): number {
  switch (agreement.billing_cycle) {
    case 'monthly':
      return agreement.price_cents;
    case 'quarterly':
      return Math.round(agreement.price_cents / 3);
    case 'annual':
      return Math.round(agreement.price_cents / 12);
    default:
      return agreement.price_cents;
  }
}

/**
 * Calculate Monthly Recurring Revenue (MRR) from active service agreements.
 *
 * Only counts agreements that are currently active (status is 'active' and
 * end_date has not passed). Normalizes all billing cycles to monthly using
 * calculateAgreementValue.
 *
 * @param agreements - Array of service agreements
 * @returns Monthly recurring revenue in cents
 */
export function calculateRecurringRevenue(
  agreements: ServiceAgreement[]
): number {
  return agreements
    .filter((agreement) => isAgreementActive(agreement))
    .reduce((sum, agreement) => sum + calculateAgreementValue(agreement), 0);
}

// ============================================================================
// Agreement Filtering
// ============================================================================

/**
 * Filter agreements that are expiring within a given number of days.
 *
 * @param agreements - All service agreements
 * @param withinDays - Number of days to look ahead (default: 30)
 * @returns Agreements expiring within the period
 */
export function getExpiringAgreements(
  agreements: ServiceAgreement[],
  withinDays: number = 30
): ServiceAgreement[] {
  return agreements.filter((agreement) =>
    isAgreementExpiring(agreement, withinDays)
  );
}

// ============================================================================
// Agreement Statistics
// ============================================================================

/**
 * Compute aggregate statistics across a set of service agreements.
 *
 * @param agreements - All service agreements
 * @returns AgreementStats with total count, active count, MRR, and
 *          breakdowns by type and status
 */
export function getAgreementStats(agreements: ServiceAgreement[]): AgreementStats {
  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let activeCount = 0;

  for (const agreement of agreements) {
    // Count by type
    const type = agreement.type || 'unknown';
    byType[type] = (byType[type] || 0) + 1;

    // Count by status
    const status = agreement.status || 'unknown';
    byStatus[status] = (byStatus[status] || 0) + 1;

    // Count active
    if (isAgreementActive(agreement)) {
      activeCount++;
    }
  }

  const mrr = calculateRecurringRevenue(agreements);

  return {
    total: agreements.length,
    activeCount,
    mrr,
    byType,
    byStatus,
  };
}
