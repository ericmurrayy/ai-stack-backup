import { describe, it, expect } from 'vitest';
import {
  calculateMargin,
  isLowStock,
  getLowStockItems,
  calculateInventoryValue,
  getInventoryStats,
  calculateReorderSuggestions,
} from '../inventory';
import type { InventoryItem } from '@murray-fsm/shared';

// ============================================================================
// Helpers
// ============================================================================

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'item-1',
    owner_id: 'owner-1',
    name: 'Test Item',
    sku: null,
    description: null,
    category: 'Springs',
    unit_of_measure: 'each',
    cost_cents: 1000,
    price_cents: 2000,
    qty_on_hand: 10,
    qty_reserved: 0,
    reorder_point: 5,
    reorder_qty: 10,
    vendor: null,
    vendor_part_number: null,
    location_in_shop: null,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    deleted: false,
    ...overrides,
  };
}

// ============================================================================
// calculateMargin
// ============================================================================

describe('calculateMargin', () => {
  it('should calculate margin for normal cost and price', () => {
    // cost 1000, price 2000 => margin = (2000-1000)/2000 = 50%
    expect(calculateMargin(1000, 2000)).toBe(50);
  });

  it('should return 0 when price is 0', () => {
    expect(calculateMargin(1000, 0)).toBe(0);
  });

  it('should calculate negative margin when cost > price', () => {
    // cost 2000, price 1000 => margin = (1000-2000)/1000 = -100%
    expect(calculateMargin(2000, 1000)).toBe(-100);
  });

  it('should return 0 margin when cost equals price', () => {
    expect(calculateMargin(1000, 1000)).toBe(0);
  });

  it('should handle zero cost', () => {
    // cost 0, price 1000 => margin = 100%
    expect(calculateMargin(0, 1000)).toBe(100);
  });

  it('should round to 2 decimal places', () => {
    // cost 100, price 300 => margin = 200/300 = 66.666... => 66.67
    expect(calculateMargin(100, 300)).toBe(66.67);
  });
});

// ============================================================================
// isLowStock
// ============================================================================

describe('isLowStock', () => {
  it('should return true when qty_on_hand is below reorder point', () => {
    const item = makeItem({ qty_on_hand: 3, reorder_point: 5 });
    expect(isLowStock(item)).toBe(true);
  });

  it('should return true when qty_on_hand equals reorder point', () => {
    const item = makeItem({ qty_on_hand: 5, reorder_point: 5 });
    expect(isLowStock(item)).toBe(true);
  });

  it('should return false when qty_on_hand is above reorder point', () => {
    const item = makeItem({ qty_on_hand: 10, reorder_point: 5 });
    expect(isLowStock(item)).toBe(false);
  });

  it('should return true when qty_on_hand is 0', () => {
    const item = makeItem({ qty_on_hand: 0, reorder_point: 5 });
    expect(isLowStock(item)).toBe(true);
  });

  it('should return true when both are 0', () => {
    const item = makeItem({ qty_on_hand: 0, reorder_point: 0 });
    expect(isLowStock(item)).toBe(true);
  });
});

// ============================================================================
// getLowStockItems
// ============================================================================

describe('getLowStockItems', () => {
  it('should return items at or below reorder point', () => {
    const items = [
      makeItem({ id: '1', qty_on_hand: 3, reorder_point: 5 }),
      makeItem({ id: '2', qty_on_hand: 10, reorder_point: 5 }),
      makeItem({ id: '3', qty_on_hand: 5, reorder_point: 5 }),
    ];
    const low = getLowStockItems(items);
    expect(low).toHaveLength(2);
  });

  it('should exclude inactive items', () => {
    const items = [
      makeItem({ id: '1', qty_on_hand: 3, reorder_point: 5, is_active: false }),
    ];
    const low = getLowStockItems(items);
    expect(low).toHaveLength(0);
  });

  it('should exclude deleted items', () => {
    const items = [
      makeItem({ id: '1', qty_on_hand: 3, reorder_point: 5, deleted: true }),
    ];
    const low = getLowStockItems(items);
    expect(low).toHaveLength(0);
  });

  it('should return empty array for no low stock', () => {
    const items = [
      makeItem({ id: '1', qty_on_hand: 100, reorder_point: 5 }),
    ];
    const low = getLowStockItems(items);
    expect(low).toHaveLength(0);
  });

  it('should return empty array for empty input', () => {
    expect(getLowStockItems([])).toHaveLength(0);
  });
});

// ============================================================================
// calculateInventoryValue
// ============================================================================

describe('calculateInventoryValue', () => {
  it('should calculate total cost, retail, and margin', () => {
    const items = [
      makeItem({ cost_cents: 1000, price_cents: 2000, qty_on_hand: 5 }),
      makeItem({ id: '2', cost_cents: 500, price_cents: 1500, qty_on_hand: 10 }),
    ];
    const value = calculateInventoryValue(items);
    expect(value.totalCost).toBe(1000 * 5 + 500 * 10); // 10000
    expect(value.totalRetail).toBe(2000 * 5 + 1500 * 10); // 25000
    expect(value.totalMargin).toBe(25000 - 10000); // 15000
  });

  it('should skip deleted items', () => {
    const items = [
      makeItem({ cost_cents: 1000, price_cents: 2000, qty_on_hand: 5 }),
      makeItem({ id: '2', cost_cents: 500, price_cents: 1500, qty_on_hand: 10, deleted: true }),
    ];
    const value = calculateInventoryValue(items);
    expect(value.totalCost).toBe(5000);
    expect(value.totalRetail).toBe(10000);
  });

  it('should return zeros for empty array', () => {
    const value = calculateInventoryValue([]);
    expect(value.totalCost).toBe(0);
    expect(value.totalRetail).toBe(0);
    expect(value.totalMargin).toBe(0);
  });

  it('should handle items with zero quantity', () => {
    const items = [makeItem({ qty_on_hand: 0 })];
    const value = calculateInventoryValue(items);
    expect(value.totalCost).toBe(0);
    expect(value.totalRetail).toBe(0);
  });

  it('should handle single item', () => {
    const items = [makeItem({ cost_cents: 100, price_cents: 200, qty_on_hand: 3 })];
    const value = calculateInventoryValue(items);
    expect(value.totalCost).toBe(300);
    expect(value.totalRetail).toBe(600);
    expect(value.totalMargin).toBe(300);
  });
});

// ============================================================================
// getInventoryStats
// ============================================================================

describe('getInventoryStats', () => {
  it('should aggregate all stats correctly', () => {
    const items = [
      makeItem({ id: '1', category: 'Springs', qty_on_hand: 3, reorder_point: 5 }),
      makeItem({ id: '2', category: 'Springs', qty_on_hand: 20, reorder_point: 5 }),
      makeItem({ id: '3', category: 'Panels', qty_on_hand: 0, reorder_point: 2 }),
    ];
    const stats = getInventoryStats(items);
    expect(stats.totalItems).toBe(3);
    expect(stats.totalActiveItems).toBe(3);
    expect(stats.lowStockCount).toBe(2); // item 1 and 3
    expect(stats.outOfStockCount).toBe(1); // item 3
    expect(stats.categoryCounts['Springs']).toBe(2);
    expect(stats.categoryCounts['Panels']).toBe(1);
  });

  it('should exclude inactive/deleted items from active count', () => {
    const items = [
      makeItem({ id: '1' }),
      makeItem({ id: '2', is_active: false }),
      makeItem({ id: '3', deleted: true }),
    ];
    const stats = getInventoryStats(items);
    expect(stats.totalItems).toBe(3);
    expect(stats.totalActiveItems).toBe(1);
  });

  it('should calculate average margin', () => {
    const items = [
      makeItem({ id: '1', cost_cents: 500, price_cents: 1000 }), // 50% margin
      makeItem({ id: '2', cost_cents: 200, price_cents: 1000 }), // 80% margin
    ];
    const stats = getInventoryStats(items);
    // Average = (50 + 80) / 2 = 65
    expect(stats.avgMarginPercent).toBe(65);
  });

  it('should return 0 avg margin when no items have price', () => {
    const items = [makeItem({ price_cents: 0 })];
    const stats = getInventoryStats(items);
    expect(stats.avgMarginPercent).toBe(0);
  });

  it('should handle empty array', () => {
    const stats = getInventoryStats([]);
    expect(stats.totalItems).toBe(0);
    expect(stats.totalActiveItems).toBe(0);
    expect(stats.lowStockCount).toBe(0);
    expect(stats.outOfStockCount).toBe(0);
  });

  it('should use Uncategorized for null categories', () => {
    const items = [makeItem({ category: null })];
    const stats = getInventoryStats(items);
    expect(stats.categoryCounts['Uncategorized']).toBe(1);
  });
});

// ============================================================================
// calculateReorderSuggestions
// ============================================================================

describe('calculateReorderSuggestions', () => {
  it('should suggest reorder for low-stock items', () => {
    const items = [
      makeItem({ id: '1', qty_on_hand: 3, reorder_point: 5, reorder_qty: 10, cost_cents: 500 }),
    ];
    const suggestions = calculateReorderSuggestions(items);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].suggestedQty).toBe(10);
    expect(suggestions[0].estimatedCost).toBe(10 * 500);
  });

  it('should not suggest reorder for well-stocked items', () => {
    const items = [
      makeItem({ qty_on_hand: 20, reorder_point: 5 }),
    ];
    const suggestions = calculateReorderSuggestions(items);
    expect(suggestions).toHaveLength(0);
  });

  it('should skip inactive items', () => {
    const items = [
      makeItem({ qty_on_hand: 1, reorder_point: 5, is_active: false }),
    ];
    const suggestions = calculateReorderSuggestions(items);
    expect(suggestions).toHaveLength(0);
  });

  it('should skip deleted items', () => {
    const items = [
      makeItem({ qty_on_hand: 1, reorder_point: 5, deleted: true }),
    ];
    const suggestions = calculateReorderSuggestions(items);
    expect(suggestions).toHaveLength(0);
  });

  it('should use reorder_point * 2 - qty when reorder_qty is 0', () => {
    const items = [
      makeItem({ qty_on_hand: 2, reorder_point: 5, reorder_qty: 0, cost_cents: 100 }),
    ];
    const suggestions = calculateReorderSuggestions(items);
    expect(suggestions).toHaveLength(1);
    // max(1, 5*2 - 2) = max(1, 8) = 8
    expect(suggestions[0].suggestedQty).toBe(8);
    expect(suggestions[0].estimatedCost).toBe(8 * 100);
  });

  it('should sort suggestions by estimated cost descending', () => {
    const items = [
      makeItem({ id: '1', qty_on_hand: 1, reorder_point: 5, reorder_qty: 5, cost_cents: 100 }),
      makeItem({ id: '2', qty_on_hand: 1, reorder_point: 5, reorder_qty: 5, cost_cents: 1000 }),
    ];
    const suggestions = calculateReorderSuggestions(items);
    expect(suggestions[0].estimatedCost).toBeGreaterThan(suggestions[1].estimatedCost);
  });

  it('should return empty array for empty input', () => {
    expect(calculateReorderSuggestions([])).toHaveLength(0);
  });
});
