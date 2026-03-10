// Murray's FSM - Agreements Service
// ====================================
// Service agreement expiration, recurring revenue, and filtering

import type { ServiceAgreement } from '@murray-fsm/shared';
import { differenceInDays, parseISO } from 'date-fns';

// ============================================================================
// Expiration Check
// ============================================================================

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
// Recurring Revenue
// ============================================================================

/**
 * Calculate Monthly Recurring Revenue (MRR) and Annual Recurring Revenue (ARR)
 * from active service agreements.
 *
 * Normalizes all billing cycles to monthly:
 * - monthly: price_cents as-is
 * - quarterly: price_cents / 3
 * - annual: price_cents / 12
 *
 * @returns monthly and annual revenue in cents
 */
export function calculateRecurringRevenue(
  agreements: ServiceAgreement[]
): { monthly: number; annual: number } {
  let monthlyRevenue = 0;

  for (const agreement of agreements) {
    if (agreement.status !== 'active') continue;

    switch (agreement.billing_cycle) {
      case 'monthly':
        monthlyRevenue += agreement.price_cents;
        break;
      case 'quarterly':
        monthlyRevenue += Math.round(agreement.price_cents / 3);
        break;
      case 'annual':
        monthlyRevenue += Math.round(agreement.price_cents / 12);
        break;
    }
  }

  return {
    monthly: monthlyRevenue,
    annual: monthlyRevenue * 12,
  };
}

// ============================================================================
// Expiring Agreements Filter
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
