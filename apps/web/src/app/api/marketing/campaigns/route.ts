// Murray's FSM - Marketing Campaigns API
// =======================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/marketing/campaigns - List all campaigns
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: campaigns, error } = await supabase
      .from('marketing_campaigns')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ campaigns: campaigns || [] });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaigns' },
      { status: 500 }
    );
  }
}

// POST /api/marketing/campaigns - Create a new campaign
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      campaign_type,
      subject,
      message,
      scheduled_at,
    } = body;

    // Validate required fields
    if (!name || !campaign_type) {
      return NextResponse.json(
        { error: 'Name and campaign type are required' },
        { status: 400 }
      );
    }

    const { data: campaign, error } = await supabase
      .from('marketing_campaigns')
      .insert({
        owner_id: user.id,
        name,
        campaign_type,
        subject: subject || null,
        message: message || null,
        status: scheduled_at ? 'scheduled' : 'draft',
        scheduled_at: scheduled_at || null,
        total_recipients: 0,
        total_sent: 0,
        total_opened: 0,
        total_clicked: 0,
        total_converted: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    console.error('Error creating campaign:', error);
    return NextResponse.json(
      { error: 'Failed to create campaign' },
      { status: 500 }
    );
  }
}
