/**
 * Referrals API
 * =============
 * Track and manage customer referrals
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'nodejs';

// Validation schemas
const ReferralCreateSchema = z.object({
  referrer_customer_id: z.string().uuid('Invalid referrer customer ID'),
  referred_name: z.string().min(1, 'Referred name is required').max(200),
  referred_phone: z.string().regex(/^(\+?1?[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/).optional().nullable(),
  referred_email: z.string().email().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
}).refine(
  (data) => data.referred_phone || data.referred_email,
  { message: 'Either phone or email is required', path: ['referred_phone'] }
);

const ReferralUpdateSchema = z.object({
  id: z.string().uuid('Invalid referral ID'),
  status: z.enum(['pending', 'contacted', 'converted', 'expired']).optional(),
  referred_customer_id: z.string().uuid().optional().nullable(),
  converted_job_id: z.string().uuid().optional().nullable(),
  referrer_reward_cents: z.coerce.number().int().min(0).optional(),
  referrer_reward_paid: z.boolean().optional(),
  referred_discount_cents: z.coerce.number().int().min(0).optional(),
  notes: z.string().max(1000).optional().nullable(),
});

const ReferralQuerySchema = z.object({
  status: z.enum(['pending', 'contacted', 'converted', 'expired']).optional(),
  referrer_id: z.string().uuid().optional(),
  code: z.string().max(50).optional(),
  program: z.enum(['true', 'false']).optional(),
  stats: z.enum(['true', 'false']).optional(),
});

/**
 * GET /api/referrals
 * Get referrals with optional filters
 */
export async function GET(req: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);

  // Validate query params
  const queryResult = ReferralQuerySchema.safeParse({
    status: searchParams.get('status') || undefined,
    referrer_id: searchParams.get('referrer_id') || undefined,
    code: searchParams.get('code') || undefined,
    program: searchParams.get('program') || undefined,
    stats: searchParams.get('stats') || undefined,
  });

  if (!queryResult.success) {
    return NextResponse.json(
      { error: 'Invalid parameters', details: queryResult.error.flatten() },
      { status: 400 }
    );
  }

  const { status, referrer_id, code, program, stats } = queryResult.data;

  // Return program settings (static config for now, could be from DB)
  if (program === 'true') {
    return NextResponse.json({
      program: {
        id: 'default',
        name: 'Friends & Family Referral Program',
        description: 'Refer a friend and you both save! You get $50 credit, they get $25 off.',
        is_active: true,
        referrer_reward_type: 'credit',
        referrer_reward_cents: 5000,
        referrer_min_job_value_cents: 10000,
        referee_reward_type: 'discount',
        referee_reward_cents: 2500,
        referral_expiry_days: 90,
      },
    });
  }

  // Return stats
  if (stats === 'true') {
    try {
      const { data } = await supabase
        .from('referrals')
        .select('status, referrer_reward_cents, referrer_reward_paid')
        .eq('deleted', false);

      const referrals = data || [];
      const converted = referrals.filter(r => r.status === 'converted');
      const rewarded = referrals.filter(r => r.referrer_reward_paid);

      return NextResponse.json({
        stats: {
          totalReferrals: referrals.length,
          pending: referrals.filter(r => r.status === 'pending').length,
          contacted: referrals.filter(r => r.status === 'contacted').length,
          converted: converted.length,
          expired: referrals.filter(r => r.status === 'expired').length,
          conversionRate: referrals.length > 0 ? Math.round((converted.length / referrals.length) * 100) : 0,
          totalRewardsIssued: rewarded.reduce((sum, r) => sum + (r.referrer_reward_cents || 0), 0),
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Referrals API] Stats error:', errorMessage);
      return NextResponse.json(
        { error: 'Failed to fetch stats', message: errorMessage },
        { status: 500 }
      );
    }
  }

  // Get by code
  if (code) {
    try {
      const { data, error } = await supabase
        .from('referrals')
        .select('*, customers!referrer_customer_id(name, email, phone)')
        .eq('referral_code', code)
        .eq('deleted', false)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return NextResponse.json({ referral: null });
        }
        throw error;
      }

      return NextResponse.json({ 
        referral: {
          ...data,
          referrer_name: (data.customers as any)?.name || null,
          referrer_email: (data.customers as any)?.email || null,
          referrer_phone: (data.customers as any)?.phone || null,
          customers: undefined,
        }
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Referrals API] Lookup error:', errorMessage);
      return NextResponse.json(
        { error: 'Failed to lookup referral', message: errorMessage },
        { status: 500 }
      );
    }
  }

  // Get referrals list
  try {
    let query = supabase
      .from('referrals')
      .select('*, customers!referrer_customer_id(name, email, phone)')
      .eq('deleted', false)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }
    if (referrer_id) {
      query = query.eq('referrer_customer_id', referrer_id);
    }

    const { data: referrals, error } = await query.limit(50);

    if (error) throw error;

    // Transform to include referrer info
    const transformedReferrals = (referrals || []).map(r => ({
      ...r,
      referrer_name: (r.customers as any)?.name || null,
      referrer_email: (r.customers as any)?.email || null,
      referrer_phone: (r.customers as any)?.phone || null,
      customers: undefined,
    }));

    return NextResponse.json({ referrals: transformedReferrals });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Referrals API] Error:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to fetch referrals', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST /api/referrals
 * Create a new referral
 */
export async function POST(req: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await req.json();

    // Validate input
    const parseResult = ReferralCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const validatedData = parseResult.data;

    // Get referrer name for code generation
    const { data: referrer } = await supabase
      .from('customers')
      .select('name')
      .eq('id', validatedData.referrer_customer_id)
      .single();

    // Generate referral code
    const prefix = referrer?.name
      ? referrer.name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X')
      : 'REF';
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const referralCode = `${prefix}-${random}`;

    // Calculate expiry (90 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    const { data, error } = await supabase
      .from('referrals')
      .insert({
        referral_code: referralCode,
        referrer_customer_id: validatedData.referrer_customer_id,
        referred_name: validatedData.referred_name,
        referred_email: validatedData.referred_email,
        referred_phone: validatedData.referred_phone,
        status: 'pending',
        referrer_reward_cents: 5000, // $50 default
        referred_discount_cents: 2500, // $25 default
        expires_at: expiresAt.toISOString(),
        notes: validatedData.notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id, referral_code')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      id: data.id,
      referral_code: data.referral_code,
    }, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Referrals API] Create error:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to create referral', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/referrals
 * Update a referral
 */
export async function PATCH(req: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await req.json();

    // Validate input
    const parseResult = ReferralUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { id, ...updates } = parseResult.data;

    const { error } = await supabase
      .from('referrals')
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
    console.error('[Referrals API] Update error:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to update referral', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/referrals
 * Soft delete a referral
 */
export async function DELETE(req: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Referral ID is required' }, { status: 400 });
  }

  const uuidResult = z.string().uuid().safeParse(id);
  if (!uuidResult.success) {
    return NextResponse.json({ error: 'Invalid referral ID format' }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from('referrals')
      .update({
        deleted: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Referrals API] Delete error:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to delete referral', message: errorMessage },
      { status: 500 }
    );
  }
}
