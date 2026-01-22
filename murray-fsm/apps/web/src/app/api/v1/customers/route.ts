// Murray's FSM - Public Customers API v1
// ======================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { hasScope } from '@murray-fsm/services';

// GET /api/v1/customers - List customers
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);

  if (!auth.authenticated) {
    return NextResponse.json(
      { error: auth.error, code: 'UNAUTHORIZED' },
      { status: auth.statusCode || 401 }
    );
  }

  if (!hasScope(auth.scopes!, 'read:customers')) {
    return NextResponse.json(
      { error: 'Insufficient permissions', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('customers')
      .select(`
        id, name, email, phone, company, source, tags,
        lifetime_value_cents, total_jobs, created_at, updated_at,
        locations(id, address1, city, state, postal_code)
      `, { count: 'exact' })
      .eq('owner_id', auth.ownerId)
      .eq('deleted', false)
      .order('name')
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data: customers, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: {
        customers,
        total: count,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Customers API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customers', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// POST /api/v1/customers - Create customer
export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request);

  if (!auth.authenticated) {
    return NextResponse.json(
      { error: auth.error, code: 'UNAUTHORIZED' },
      { status: auth.statusCode || 401 }
    );
  }

  if (!hasScope(auth.scopes!, 'write:customers')) {
    return NextResponse.json(
      { error: 'Insufficient permissions', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  try {
    const supabase = createClient();
    const body = await request.json();

    const { name, email, phone, company, source, locations } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'name is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Create customer
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert({
        owner_id: auth.ownerId,
        name,
        email,
        phone,
        company,
        source: source || 'api',
      })
      .select()
      .single();

    if (customerError) throw customerError;

    // Create locations if provided
    if (locations && Array.isArray(locations) && locations.length > 0) {
      const locationsToInsert = locations.map((loc: Record<string, unknown>, index: number) => ({
        owner_id: auth.ownerId,
        customer_id: customer.id,
        address1: loc.address1,
        address2: loc.address2,
        city: loc.city,
        state: loc.state,
        postal_code: loc.postal_code,
        country: loc.country || 'US',
        lat: loc.lat,
        lng: loc.lng,
        is_primary: index === 0,
      }));

      await supabase.from('locations').insert(locationsToInsert);
    }

    // Fetch complete customer with locations
    const { data: completeCustomer } = await supabase
      .from('customers')
      .select(`*, locations(*)`)
      .eq('id', customer.id)
      .single();

    return NextResponse.json({
      success: true,
      data: { customer: completeCustomer },
    }, { status: 201 });
  } catch (error) {
    console.error('Create customer error:', error);
    return NextResponse.json(
      { error: 'Failed to create customer', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
