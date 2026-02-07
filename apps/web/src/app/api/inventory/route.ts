// Murray's FSM - Inventory API
// =============================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/inventory - List all inventory items
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const lowStock = searchParams.get('low_stock') === 'true';

    let query = supabase
      .from('inventory_items')
      .select('*')
      .eq('owner_id', user.id)
      .eq('is_active', true)
      .order('name');

    if (category) {
      query = query.eq('category', category);
    }

    const { data: items, error } = await query;

    if (error) throw error;

    let result = items || [];

    // Filter low stock items if requested
    if (lowStock) {
      result = result.filter(item => item.quantity_on_hand <= item.reorder_point);
    }

    return NextResponse.json({ items: result });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory' },
      { status: 500 }
    );
  }
}

// POST /api/inventory - Create a new inventory item
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      sku,
      name,
      category,
      quantity_on_hand,
      reorder_point,
      cost_cents,
      price_cents,
      supplier,
      description,
      location,
    } = body;

    // Validate required fields
    if (!sku || !name || !category) {
      return NextResponse.json(
        { error: 'SKU, name, and category are required' },
        { status: 400 }
      );
    }

    // Check for duplicate SKU
    const { data: existing } = await supabase
      .from('inventory_items')
      .select('id')
      .eq('owner_id', user.id)
      .eq('sku', sku)
      .eq('is_active', true)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'An item with this SKU already exists' },
        { status: 400 }
      );
    }

    const { data: item, error } = await supabase
      .from('inventory_items')
      .insert({
        owner_id: user.id,
        sku,
        name,
        category,
        quantity_on_hand: quantity_on_hand || 0,
        reorder_point: reorder_point || 0,
        cost_cents: cost_cents || 0,
        price_cents: price_cents || 0,
        supplier: supplier || null,
        description: description || null,
        location: location || null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('Error creating inventory item:', error);
    return NextResponse.json(
      { error: 'Failed to create inventory item' },
      { status: 500 }
    );
  }
}
