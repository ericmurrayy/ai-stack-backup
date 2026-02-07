/**
 * Service Contracts API
 * =====================
 * Manage maintenance contracts with customers
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'nodejs';

// Validation schemas
const RecurrenceFrequencySchema = z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'biannual', 'annual']);

const ContractCreateSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID'),
  location_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional().nullable(),
  service_type: z.string().max(100).optional().nullable(),
  frequency: RecurrenceFrequencySchema,
  day_of_week: z.coerce.number().int().min(0).max(6).optional().nullable(),
  day_of_month: z.coerce.number().int().min(1).max(31).optional().nullable(),
  month_of_year: z.coerce.number().int().min(1).max(12).optional().nullable(),
  preferred_time_start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().nullable(),
  preferred_time_end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().nullable(),
  duration_minutes: z.coerce.number().int().min(15).max(480).default(60),
  base_price_cents: z.coerce.number().int().min(0).default(0),
  auto_generate_invoice: z.boolean().default(true),
  auto_send_reminder: z.boolean().default(true),
  reminder_days_before: z.coerce.number().int().min(0).max(30).default(3),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const ContractUpdateSchema = ContractCreateSchema.partial().extend({
  id: z.string().uuid('Invalid contract ID'),
  is_active: z.boolean().optional(),
});

const ContractQuerySchema = z.object({
  customer_id: z.string().uuid().optional(),
  is_active: z.enum(['true', 'false']).optional(),
  expiring_soon: z.enum(['true', 'false']).optional(),
});

/**
 * GET /api/contracts
 * Get all contracts with optional filters
 */
export async function GET(req: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);

  // Validate query parameters
  const queryResult = ContractQuerySchema.safeParse({
    customer_id: searchParams.get('customer_id') || undefined,
    is_active: searchParams.get('is_active') || undefined,
    expiring_soon: searchParams.get('expiring_soon') || undefined,
  });

  if (!queryResult.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: queryResult.error.flatten() },
      { status: 400 }
    );
  }

  const { customer_id, is_active, expiring_soon } = queryResult.data;

  try {
    let query = supabase
      .from('maintenance_contracts')
      .select(`
        *,
        customers(name, email, phone),
        locations(address1, city, state, postal_code)
      `)
      .eq('deleted', false)
      .order('created_at', { ascending: false });

    if (customer_id) {
      query = query.eq('customer_id', customer_id);
    }
    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }
    if (expiring_soon === 'true') {
      const thirtyDays = new Date();
      thirtyDays.setDate(thirtyDays.getDate() + 30);
      query = query
        .eq('is_active', true)
        .not('end_date', 'is', null)
        .lte('end_date', thirtyDays.toISOString().split('T')[0]);
    }

    const { data: contracts, error } = await query;

    if (error) throw error;

    // Calculate stats
    const items = contracts || [];
    const activeContracts = items.filter(c => c.is_active);

    const stats = {
      total: items.length,
      active: activeContracts.length,
      inactive: items.filter(c => !c.is_active).length,
      totalMonthlyValue: activeContracts.reduce((sum, c) => {
        // Convert to monthly value based on frequency
        const basePrice = c.base_price_cents || 0;
        switch (c.frequency) {
          case 'daily': return sum + (basePrice * 30);
          case 'weekly': return sum + (basePrice * 4);
          case 'biweekly': return sum + (basePrice * 2);
          case 'monthly': return sum + basePrice;
          case 'quarterly': return sum + (basePrice / 3);
          case 'biannual': return sum + (basePrice / 6);
          case 'annual': return sum + (basePrice / 12);
          default: return sum + basePrice;
        }
      }, 0),
      expiringThisMonth: items.filter(c => {
        if (!c.end_date || !c.is_active) return false;
        const endDate = new Date(c.end_date);
        const now = new Date();
        return endDate.getMonth() === now.getMonth() && endDate.getFullYear() === now.getFullYear();
      }).length,
    };

    // Transform data to flatten nested objects
    const transformedContracts = items.map(contract => ({
      ...contract,
      customer_name: contract.customers?.name || null,
      customer_email: contract.customers?.email || null,
      customer_phone: contract.customers?.phone || null,
      location_address: contract.locations 
        ? `${contract.locations.address1}, ${contract.locations.city}, ${contract.locations.state} ${contract.locations.postal_code}`
        : null,
      customers: undefined,
      locations: undefined,
    }));

    return NextResponse.json({ contracts: transformedContracts, stats });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Contracts API] Error:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to fetch contracts', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST /api/contracts
 * Create a new maintenance contract
 */
export async function POST(req: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await req.json();

    // Validate input
    const parseResult = ContractCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const validatedData = parseResult.data;

    // Calculate next service date
    const nextServiceDate = validatedData.start_date;

    const { data, error } = await supabase
      .from('maintenance_contracts')
      .insert({
        ...validatedData,
        next_service_date: nextServiceDate,
        is_active: true,
        total_services_completed: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, id: data.id }, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Contracts API] Create error:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to create contract', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/contracts
 * Update a contract
 */
export async function PATCH(req: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await req.json();

    // Validate input
    const parseResult = ContractUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { id, ...updates } = parseResult.data;

    const { error } = await supabase
      .from('maintenance_contracts')
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
    console.error('[Contracts API] Update error:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to update contract', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/contracts
 * Soft delete a contract
 */
export async function DELETE(req: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Contract ID is required' }, { status: 400 });
  }

  // Validate UUID
  const uuidResult = z.string().uuid().safeParse(id);
  if (!uuidResult.success) {
    return NextResponse.json({ error: 'Invalid contract ID format' }, { status: 400 });
  }

  try {
    // Soft delete
    const { error } = await supabase
      .from('maintenance_contracts')
      .update({
        deleted: true,
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Contracts API] Delete error:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to delete contract', message: errorMessage },
      { status: 500 }
    );
  }
}
