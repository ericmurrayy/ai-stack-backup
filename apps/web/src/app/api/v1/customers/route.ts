// Murray's FSM - Public Customers API v1
// ======================================
// Standardized request/response contracts with Zod validation.

import { NextRequest } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { hasScope } from '@murray-fsm/services';
import { CustomerCreateSchema, CustomerListQuerySchema } from '@murray-fsm/shared';
import { createClient } from '@/lib/supabase/server';
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiValidationError,
  apiInternalError,
  generateRequestId,
  paginationMeta,
} from '@/lib/api-response';

// GET /api/v1/customers - List customers
export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  const auth = await authenticateApiRequest(request);

  if (!auth.authenticated) {
    return apiUnauthorized(auth.error || 'Unauthorized', requestId);
  }

  if (!hasScope(auth.scopes!, 'read:customers')) {
    return apiForbidden('Insufficient permissions — requires read:customers', requestId);
  }

  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Validate query params
    const parsed = CustomerListQuerySchema.safeParse({
      search: searchParams.get('search') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    });

    if (!parsed.success) {
      return apiValidationError(parsed.error, requestId);
    }

    const { search, limit, offset } = parsed.data;

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
      const sanitized = search.replace(/[%_\\]/g, '\\$&');
      query = query.or(`name.ilike.%${sanitized}%,email.ilike.%${sanitized}%,phone.ilike.%${sanitized}%`);
    }

    const { data: customers, error, count } = await query;

    if (error) throw error;

    return apiSuccess(
      { customers },
      paginationMeta(count, limit, offset),
      200,
      requestId,
    );
  } catch (error) {
    return apiInternalError(error, 'Customers:GET', requestId);
  }
}

// POST /api/v1/customers - Create customer
export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const auth = await authenticateApiRequest(request);

  if (!auth.authenticated) {
    return apiUnauthorized(auth.error || 'Unauthorized', requestId);
  }

  if (!hasScope(auth.scopes!, 'write:customers')) {
    return apiForbidden('Insufficient permissions — requires write:customers', requestId);
  }

  try {
    const supabase = await createClient();
    const body = await request.json();

    // Validate with Zod
    const parsed = CustomerCreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiValidationError(parsed.error, requestId);
    }

    const { name, email, phone, source } = parsed.data;

    // Create customer
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert({
        owner_id: auth.ownerId,
        name,
        email,
        phone,
        source: source || 'api',
      })
      .select()
      .single();

    if (customerError) throw customerError;

    // Create locations if provided
    const locations = (body as any).locations;
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

    return apiSuccess({ customer: completeCustomer }, undefined, 201, requestId);
  } catch (error) {
    return apiInternalError(error, 'Customers:POST', requestId);
  }
}
