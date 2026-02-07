// Murray's FSM - Inventory Export API
// ====================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/inventory/export - Export inventory as CSV
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: items, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('owner_id', user.id)
      .eq('is_active', true)
      .order('category')
      .order('name');

    if (error) throw error;

    // Generate CSV
    const headers = ['SKU', 'Name', 'Category', 'Quantity', 'Reorder Point', 'Cost ($)', 'Price ($)', 'Supplier', 'Value ($)'];
    const rows = (items || []).map(item => [
      item.sku,
      `"${(item.name || '').replace(/"/g, '""')}"`,
      item.category,
      item.quantity_on_hand,
      item.reorder_point,
      (item.cost_cents / 100).toFixed(2),
      (item.price_cents / 100).toFixed(2),
      `"${(item.supplier || '').replace(/"/g, '""')}"`,
      ((item.quantity_on_hand * item.cost_cents) / 100).toFixed(2),
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="inventory-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting inventory:', error);
    return NextResponse.json(
      { error: 'Failed to export inventory' },
      { status: 500 }
    );
  }
}
