/**
 * Equipment API
 * =============
 * Manage vehicles, tools, and equipment
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'nodejs';

// Validation schemas
const EquipmentTypeSchema = z.enum(['vehicle', 'tool', 'equipment']);
const EquipmentStatusSchema = z.enum(['available', 'in_use', 'maintenance', 'retired']);

const EquipmentCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  type: EquipmentTypeSchema,
  make: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  year: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  serial_number: z.string().max(100).optional().nullable(),
  license_plate: z.string().max(20).optional().nullable(),
  vin: z.string().max(20).optional().nullable(),
  status: EquipmentStatusSchema.default('available'),
  assigned_to: z.string().uuid().optional().nullable(),
  purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  purchase_price_cents: z.coerce.number().int().min(0).optional().nullable(),
  current_value_cents: z.coerce.number().int().min(0).optional().nullable(),
  odometer: z.coerce.number().int().min(0).optional().nullable(),
  fuel_level: z.coerce.number().int().min(0).max(100).optional().nullable(),
  last_service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  next_service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  service_interval_miles: z.coerce.number().int().min(0).optional().nullable(),
  warranty_expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  insurance_expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const EquipmentUpdateSchema = EquipmentCreateSchema.partial().extend({
  id: z.string().uuid('Invalid equipment ID'),
});

const EquipmentQuerySchema = z.object({
  type: EquipmentTypeSchema.optional(),
  status: EquipmentStatusSchema.optional(),
});

/**
 * GET /api/equipment
 * Get all equipment
 */
export async function GET(req: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);

  // Validate query parameters
  const queryResult = EquipmentQuerySchema.safeParse({
    type: searchParams.get('type') || undefined,
    status: searchParams.get('status') || undefined,
  });

  if (!queryResult.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: queryResult.error.flatten() },
      { status: 400 }
    );
  }

  const { type, status } = queryResult.data;

  try {
    let query = supabase
      .from('equipment')
      .select('*, team_members(full_name)')
      .eq('deleted', false)
      .order('name');

    if (type) {
      query = query.eq('type', type);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data: equipment, error } = await query;

    if (error) throw error;

    // Calculate stats
    const items = equipment || [];
    const stats = {
      total: items.length,
      available: items.filter(e => e.status === 'available').length,
      inUse: items.filter(e => e.status === 'in_use').length,
      maintenance: items.filter(e => e.status === 'maintenance').length,
      retired: items.filter(e => e.status === 'retired').length,
      maintenanceDueSoon: items.filter(e => {
        if (!e.next_service_date) return false;
        const daysUntil = Math.ceil(
          (new Date(e.next_service_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        return daysUntil <= 30 && daysUntil > 0;
      }).length,
    };

    // Transform data to include assigned team member name
    const transformedItems = items.map(item => ({
      ...item,
      assigned_to_name: item.team_members?.full_name || null,
      team_members: undefined, // Remove nested object
    }));

    return NextResponse.json({ equipment: transformedItems, stats });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Equipment API] Error:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to fetch equipment', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST /api/equipment
 * Create new equipment
 */
export async function POST(req: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await req.json();

    // Validate input
    const parseResult = EquipmentCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const validatedData = parseResult.data;

    const { data, error } = await supabase
      .from('equipment')
      .insert({
        ...validatedData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, id: data.id }, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Equipment API] Create error:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to create equipment', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/equipment
 * Update equipment
 */
export async function PATCH(req: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await req.json();

    // Validate input
    const parseResult = EquipmentUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { id, ...updates } = parseResult.data;

    const { error } = await supabase
      .from('equipment')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('deleted', false);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Equipment API] Update error:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to update equipment', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/equipment
 * Soft delete equipment
 */
export async function DELETE(req: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  // Validate UUID format
  const uuidResult = z.string().uuid().safeParse(id);
  if (!uuidResult.success) {
    return NextResponse.json({ error: 'Invalid equipment ID format' }, { status: 400 });
  }

  try {
    // Soft delete
    const { error } = await supabase
      .from('equipment')
      .update({ 
        deleted: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Equipment API] Delete error:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to delete equipment', message: errorMessage },
      { status: 500 }
    );
  }
}
