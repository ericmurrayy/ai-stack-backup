// Murray's FSM - Settings API
// ============================
// Save business settings.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient();
    const body = await request.json();

    // Get current user's owner_id
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Build update object from allowed fields
    const allowedFields = [
      'business_name', 'business_phone', 'business_email', 'business_address',
      'license_number', 'default_job_duration_minutes', 'buffer_between_jobs_minutes',
      'max_jobs_per_day', 'stripe_account_id', 'hourly_rate_cents',
      'service_call_fee_cents', 'tax_rate', 'primary_color', 'secondary_color',
      'business_logo_url',
    ];

    const numericFields = [
      'default_job_duration_minutes', 'buffer_between_jobs_minutes', 'max_jobs_per_day',
      'hourly_rate_cents', 'service_call_fee_cents',
    ];

    const updates: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined && body[key] !== '') {
        if (numericFields.includes(key)) {
          updates[key] = parseInt(body[key]) || 0;
        } else if (key === 'tax_rate') {
          updates[key] = parseFloat(body[key]) || 0;
        } else {
          updates[key] = body[key];
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Upsert settings
    const { error } = await supabase
      .from('business_settings')
      .upsert({
        owner_id: user.id,
        ...updates,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'owner_id' });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settings error:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
