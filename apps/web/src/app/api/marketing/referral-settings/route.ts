// Murray's FSM - Referral Program Settings API
// =============================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/marketing/referral-settings - Get referral program settings
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: settings, error } = await supabase
      .from('business_settings')
      .select('referral_reward_cents, min_job_value_cents, referral_expiry_days')
      .eq('owner_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return NextResponse.json({
      settings: settings || {
        referral_reward_cents: 5000, // $50 default
        min_job_value_cents: 10000, // $100 default
        referral_expiry_days: 30,
      },
    });
  } catch (error) {
    console.error('Error fetching referral settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch referral settings' },
      { status: 500 }
    );
  }
}

// PUT /api/marketing/referral-settings - Update referral program settings
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      referral_reward_cents,
      min_job_value_cents,
      expiry_days,
    } = body;

    const { data: settings, error } = await supabase
      .from('business_settings')
      .upsert({
        owner_id: user.id,
        referral_reward_cents: referral_reward_cents || 5000,
        min_job_value_cents: min_job_value_cents || 10000,
        referral_expiry_days: expiry_days || 30,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error updating referral settings:', error);
    return NextResponse.json(
      { error: 'Failed to update referral settings' },
      { status: 500 }
    );
  }
}
