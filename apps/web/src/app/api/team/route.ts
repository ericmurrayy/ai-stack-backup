// Murray's FSM - Team API
// ========================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/team - List all team members
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: members, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('owner_id', user.id)
      .eq('is_active', true)
      .order('full_name');

    if (error) throw error;

    return NextResponse.json({ members: members || [] });
  } catch (error) {
    console.error('Error fetching team:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team members' },
      { status: 500 }
    );
  }
}

// POST /api/team - Add a new team member
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      full_name,
      email,
      phone,
      role,
      hourly_rate_cents,
      skills,
      color,
      avatar_url,
    } = body;

    // Validate required fields
    if (!full_name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      );
    }

    // Check for duplicate email
    const { data: existing } = await supabase
      .from('team_members')
      .select('id')
      .eq('owner_id', user.id)
      .eq('email', email.toLowerCase())
      .eq('is_active', true)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'A team member with this email already exists' },
        { status: 400 }
      );
    }

    // Generate a random color if not provided
    const colors = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#84CC16'];
    const memberColor = color || colors[Math.floor(Math.random() * colors.length)];

    const { data: member, error } = await supabase
      .from('team_members')
      .insert({
        owner_id: user.id,
        full_name,
        email: email.toLowerCase(),
        phone: phone || null,
        role: role || 'technician',
        hourly_rate_cents: hourly_rate_cents || 0,
        skills: skills || [],
        color: memberColor,
        avatar_url: avatar_url || null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    console.error('Error creating team member:', error);
    return NextResponse.json(
      { error: 'Failed to create team member' },
      { status: 500 }
    );
  }
}
