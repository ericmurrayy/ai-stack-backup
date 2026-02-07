// Murray's FSM - Customers API
// =============================
// Schema: supabase/schema.sql — customers table
// Columns: id, owner_id, name, phone, email, notes, created_at, updated_at, deleted
// Address data lives in the `locations` table (linked via customer_id)

import { createAdminClient, createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Normalize phone number to E.164 format
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return phone;
}

export async function POST(request: Request) {
  try {
    const authClient = createClient();
    const supabase = createAdminClient();

    // Get current user
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, phone, email, notes } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Normalize phone for dedup check
    const normalizedPhone = phone ? normalizePhone(phone) : null;

    // Check if customer with this phone already exists (if phone provided)
    if (normalizedPhone) {
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('owner_id', user.id)
        .eq('phone', normalizedPhone)
        .eq('deleted', false)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: 'A customer with this phone number already exists', existing_id: existing.id },
          { status: 409 }
        );
      }
    }

    // Create customer — only columns that exist in schema
    const { data: customer, error } = await supabase
      .from('customers')
      .insert({
        owner_id: user.id,
        name,
        phone: normalizedPhone,
        email: email || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating customer:', error);
      return NextResponse.json(
        { error: 'Failed to create customer' },
        { status: 500 }
      );
    }

    // If address data was provided, create a location record
    if (body.address1 || body.city) {
      await supabase.from('locations').insert({
        owner_id: user.id,
        customer_id: customer.id,
        address1: body.address1 || body.address || '',
        address2: body.address2 || null,
        city: body.city || '',
        state: body.state || '',
        postal_code: body.postal_code || body.zip || '',
        access_notes: body.access_notes || null,
      });
    }

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error('Customer creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const authClient = createClient();
    const supabase = createAdminClient();

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: customers, error } = await supabase
      .from('customers')
      .select('*, locations(id, address1, city, state, postal_code)')
      .eq('owner_id', user.id)
      .eq('deleted', false)
      .order('name');

    if (error) {
      console.error('Error fetching customers:', error);
      return NextResponse.json(
        { error: 'Failed to fetch customers' },
        { status: 500 }
      );
    }

    return NextResponse.json(customers);
  } catch (error) {
    console.error('Customer fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
