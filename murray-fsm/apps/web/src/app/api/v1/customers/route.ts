// Murray's FSM - Public Customers API v1
// ======================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authenticateAndRateLimit } from '@/lib/api-middleware';
import { applyRateLimitHeaders } from '@/lib/rate-limiter';
import { hasScope } from '@murray-fsm/services';
import { z } from 'zod';
import {
  validateBody,
  validateQuery,
  paginationQuerySchema,
  searchQuerySchema,
  uuidString,
  isoDateString,
} from '@/lib/api-validation';
import { dispatchWebhookEvent } from '@/lib/webhook-dispatch';

// --- Zod Schemas ---

const listCustomersQuerySchema = paginationQuerySchema.merge(searchQuerySchema);

const locationBodySchema = z.object({
  address1: z.string().min(1, 'address1 is required').max(500),
  address2: z.string().max(500).optional(),
  city: z.string().min(1, 'city is required').max(200),
  state: z.string().min(1, 'state is required').max(100),
  postal_code: z.string().regex(/^\d{5}(-\d{4})?$/, 'Must be a valid US ZIP code').optional(),
  country: z.string().max(10).default('US'),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

const createCustomerBodySchema = z.object({
  name: z.string().min(1, 'name is required').max(300),
  email: z.string().email('Invalid email address').max(300).optional(),
  phone: z.string().max(50).optional(),
  company: z.string().max(300).optional(),
  source: z.string().max(100).optional(),
  locations: z.array(locationBodySchema).max(10, 'Too many locations (max 10)').optional(),
});

// GET /api/v1/customers - List customers
export async function GET(request: NextRequest) {
  const { authenticated, auth, rateLimit, error: authError } = await authenticateAndRateLimit(request);

  if (!authenticated || !rateLimit.allowed) return authError!;

  if (!hasScope(auth.scopes!, 'read:customers')) {
    return applyRateLimitHeaders(
      NextResponse.json(
        { error: 'Insufficient permissions', code: 'FORBIDDEN' },
        { status: 403 }
      ),
      rateLimit
    );
  }

  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Validate query parameters
    const queryResult = validateQuery(listCustomersQuerySchema, searchParams);
    if (!queryResult.success) return queryResult.response;

    const { search, limit, offset } = queryResult.data;

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
      // Sanitize search input to prevent PostgREST filter injection
      const sanitized = search.replace(/[%,()\\]/g, '');
      if (sanitized.length > 0) {
        query = query.or(`name.ilike.%${sanitized}%,email.ilike.%${sanitized}%,phone.ilike.%${sanitized}%`);
      }
    }

    const { data: customers, error, count } = await query;

    if (error) throw error;

    return applyRateLimitHeaders(
      NextResponse.json({
        success: true,
        data: {
          customers,
          total: count,
          limit,
          offset,
        },
      }),
      rateLimit
    );
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
  const { authenticated, auth, rateLimit, error: authError } = await authenticateAndRateLimit(request);

  if (!authenticated || !rateLimit.allowed) return authError!;

  if (!hasScope(auth.scopes!, 'write:customers')) {
    return applyRateLimitHeaders(
      NextResponse.json(
        { error: 'Insufficient permissions', code: 'FORBIDDEN' },
        { status: 403 }
      ),
      rateLimit
    );
  }

  try {
    const supabase = await createClient();
    const body = await request.json();

    // Validate request body
    const bodyResult = validateBody(createCustomerBodySchema, body);
    if (!bodyResult.success) return bodyResult.response;

    const validated = bodyResult.data;

    // Create customer
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert({
        owner_id: auth.ownerId,
        name: validated.name,
        email: validated.email,
        phone: validated.phone,
        company: validated.company,
        source: validated.source || 'api',
      })
      .select()
      .single();

    if (customerError) throw customerError;

    // Create locations if provided
    if (validated.locations && validated.locations.length > 0) {
      const locationsToInsert = validated.locations.map((loc, index) => ({
        owner_id: auth.ownerId,
        customer_id: customer.id,
        address1: loc.address1,
        address2: loc.address2,
        city: loc.city,
        state: loc.state,
        postal_code: loc.postal_code,
        country: loc.country,
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

    // Fire-and-forget: notify webhook subscribers
    dispatchWebhookEvent(auth.ownerId!, 'customer.created', {
      customer: completeCustomer,
    });

    return applyRateLimitHeaders(
      NextResponse.json({
        success: true,
        data: { customer: completeCustomer },
      }, { status: 201 }),
      rateLimit
    );
  } catch (error) {
    console.error('Create customer error:', error);
    return NextResponse.json(
      { error: 'Failed to create customer', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
