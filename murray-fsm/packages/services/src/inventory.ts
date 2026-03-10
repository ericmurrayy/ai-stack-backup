// Murray's FSM - Inventory Service
// ==================================
// Inventory calculations: margins, stock levels, valuations, reorder suggestions

import type { InventoryItem } from '@murray-fsm/shared';

// ============================================================================
// Types
// ============================================================================

export interface InventoryValue {
  totalCost: number;
  totalRetail: number;
  totalMargin: number;
}

export interface InventoryStats {
  totalItems: number;
  totalActiveItems: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalValue: InventoryValue;
  avgMarginPercent: number;
  categoryCounts: Record<string, number>;
}

export interface ReorderSuggestion {
  item: InventoryItem;
  currentQty: number;
  reorderPoint: number;
  suggestedQty: number;
  estimatedCost: number;
}

// ============================================================================
// Margin Calculation
// ============================================================================

/**
 * Calculate margin percentage from cost and price in cents.
 *
 * @param costCents  - Cost in cents
 * @param priceCents - Selling price in cents
 * @returns Margin percentage (e.g., 40.0 for 40%). Returns 0 if price is 0.
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
 * Only includes active, non-deleted items.
 */
export function getLowStockItems(items: InventoryItem[]): InventoryItem[] {
  return items.filter(
    (item) => item.is_active && !item.deleted && isLowStock(item)
  );
}

// ============================================================================
// Inventory Valuation
// ============================================================================

/**
 * Calculate the total inventory value across all items.
 * All values returned in cents.
 *
 * @param items - Inventory items to value
 * @returns totalCost (sum of cost * qty), totalRetail (sum of price * qty),
 *          totalMargin (totalRetail - totalCost)
 */
export function calculateInventoryValue(
  items: InventoryItem[]
): InventoryValue {
  let totalCost = 0;
  let totalRetail = 0;

  for (const item of items) {
    if (item.deleted) continue;
    totalCost += item.cost_cents * item.qty_on_hand;
    totalRetail += item.price_cents * item.qty_on_hand;
  }

  return {
    totalCost,
    totalRetail,
    totalMargin: totalRetail - totalCost,
  };
}

// ============================================================================
// Inventory Stats
// ============================================================================

/**
 * Calculate aggregate inventory statistics.
 *
 * @param items - All inventory items
 * @returns Aggregated stats including counts, values, and category breakdown
 */
export function getInventoryStats(items: InventoryItem[]): InventoryStats {
  const activeItems = items.filter((i) => i.is_active && !i.deleted);
  const lowStock = getLowStockItems(items);
  const outOfStock = activeItems.filter((i) => i.qty_on_hand <= 0);
  const totalValue = calculateInventoryValue(activeItems);

  // Category breakdown
  const categoryCounts: Record<string, number> = {};
  for (const item of activeItems) {
    const cat = item.category ?? 'Uncategorized';
    categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
  }

  // Average margin across all active items with a price > 0
  const itemsWithPrice = activeItems.filter((i) => i.price_cents > 0);
  const avgMarginPercent =
    itemsWithPrice.length > 0
      ? Math.round(
          (itemsWithPrice.reduce(
            (sum, i) => sum + calculateMargin(i.cost_cents, i.price_cents),
            0
          ) /
            itemsWithPrice.length) *
            100
        ) / 100
      : 0;

  return {
    totalItems: items.length,
    totalActiveItems: activeItems.length,
    lowStockCount: lowStock.length,
    outOfStockCount: outOfStock.length,
    totalValue,
    avgMarginPercent,
    categoryCounts,
  };
}

// ============================================================================
// Reorder Suggestions
// ============================================================================

/**
 * Generate reorder suggestions for items that need restocking.
 *
 * An item needs reorder when:
 *   - It is active and not deleted
 *   - qty_on_hand <= reorder_point
 *   - reorder_qty > 0
 *
 * The suggested quantity is the item's configured reorder_qty, or enough to
 * bring stock back to (reorder_point * 2) if reorder_qty is not set.
 *
 * @param items - All inventory items
 * @returns Array of reorder suggestions sorted by estimated cost descending
 */
export function calculateReorderSuggestions(
  items: InventoryItem[]
): ReorderSuggestion[] {
  const suggestions: ReorderSuggestion[] = [];

  for (const item of items) {
    if (!item.is_active || item.deleted) continue;
    if (item.qty_on_hand > item.reorder_point) continue;

    // Determine how many to order
    const suggestedQty =
      item.reorder_qty > 0
        ? item.reorder_qty
        : Math.max(1, item.reorder_point * 2 - item.qty_on_hand);

    suggestions.push({
      item,
      currentQty: item.qty_on_hand,
      reorderPoint: item.reorder_point,
      suggestedQty,
      estimatedCost: suggestedQty * item.cost_cents,
    });
  }

  // Sort by estimated cost descending (highest cost first)
  suggestions.sort((a, b) => b.estimatedCost - a.estimatedCost);

  return suggestions;
}
