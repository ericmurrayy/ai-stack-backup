// Murray's FSM - Inventory Service
// ==================================
// Inventory calculations: margins, stock levels, valuations

import type { InventoryItem } from '@murray-fsm/shared';

// ============================================================================
// Margin Calculation
// ============================================================================

/**
 * Calculate margin percentage from cost and price in cents.
 *
 * @param costCents - Cost in cents
 * @param priceCents - Selling price in cents
 * @returns Margin percentage (e.g., 40.0 for 40%)
 */
export function calculateMargin(costCents: number, priceCents: number): number {
  if (priceCents === 0) return 0;
  return Math.round(((priceCents - costCents) / priceCents) * 10000) / 100;
}

// ============================================================================
// Stock Level Checks
// ============================================================================

/**
 * Check if an item is at or below its reorder point.
 */
export function isLowStock(item: InventoryItem): boolean {
  return item.qty_on_hand <= item.reorder_point;
}

/**
 * Filter items that are at or below their reorder point.
 */
export function getLowStockItems(items: InventoryItem[]): InventoryItem[] {
  return items.filter(isLowStock);
}

// ============================================================================
// Inventory Valuation
// ============================================================================

/**
 * Calculate the total inventory value across all items.
 * All values returned in cents.
 *
 * @returns totalCost (sum of cost * qty), totalRetail (sum of price * qty),
 *          totalMargin (totalRetail - totalCost)
 */
export function calculateInventoryValue(
  items: InventoryItem[]
): { totalCost: number; totalRetail: number; totalMargin: number } {
  let totalCost = 0;
  let totalRetail = 0;

  for (const item of items) {
    totalCost += item.cost_cents * item.qty_on_hand;
    totalRetail += item.price_cents * item.qty_on_hand;
  }

  return {
    totalCost,
    totalRetail,
    totalMargin: totalRetail - totalCost,
  };
}
