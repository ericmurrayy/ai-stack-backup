/**
 * Team Member Schedule API
 * ========================
 * Manage individual team member schedules
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * GET /api/team/[id]/schedule
 * Get team member's schedule
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('start');
  const endDate = searchParams.get('end');

  try {
    // Get team member
    const { data: member, error: memberError } = await supabase
      .from('team_members')
      .select('id, full_name, role, color')
      .eq('id', params.id)
      .single();

    if (memberError) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    // Get assigned jobs
    let jobsQuery = supabase
      .from('jobs')
      .select('id, job_number, customer_name, address, scheduled_at, status, service_category')
      .eq('assigned_technician_id', params.id)
      .order('scheduled_at', { ascending: true });

    if (startDate) {
      jobsQuery = jobsQuery.gte('scheduled_at', startDate);
    }
    if (endDate) {
      jobsQuery = jobsQuery.lte('scheduled_at', endDate);
    }

    const { data: jobs } = await jobsQuery;

    // Get time entries
    let timeQuery = supabase
      .from('time_entries')
      .select('*')
      .eq('team_member_id', params.id)
      .order('clock_in', { ascending: false })
      .limit(50);

    if (startDate) {
      timeQuery = timeQuery.gte('clock_in', startDate);
    }

    const { data: timeEntries } = await timeQuery;

    // Get shifts/availability
    const { data: shifts } = await supabase
      .from('team_shifts')
      .select('*')
      .eq('team_member_id', params.id)
      .order('day_of_week');

    return NextResponse.json({
      member,
      jobs: jobs || [],
      timeEntries: timeEntries || [],
      shifts: shifts || [],
    });
  } catch (error: any) {
    console.error('[Team Schedule API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch schedule' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/team/[id]/schedule
 * Update team member's schedule/shifts
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient();

  try {
    const body = await req.json();
    const { action, ...data } = body;

    switch (action) {
      case 'clock_in':
        const { data: clockIn, error: clockInError } = await supabase
          .from('time_entries')
          .insert({
            team_member_id: params.id,
            clock_in: new Date().toISOString(),
            job_id: data.job_id,
            notes: data.notes,
          })
          .select()
          .single();

        if (clockInError) throw clockInError;
        return NextResponse.json({ success: true, entry: clockIn });

      case 'clock_out':
        const { data: clockOut, error: clockOutError } = await supabase
          .from('time_entries')
          .update({
            clock_out: new Date().toISOString(),
            notes: data.notes,
          })
          .eq('id', data.entry_id)
          .is('clock_out', null)
          .select()
          .single();

        if (clockOutError) throw clockOutError;
        return NextResponse.json({ success: true, entry: clockOut });

      case 'set_shifts':
        // Delete existing shifts
        await supabase
          .from('team_shifts')
          .delete()
          .eq('team_member_id', params.id);

        // Insert new shifts
        if (data.shifts && data.shifts.length > 0) {
          const shifts = data.shifts.map((s: any) => ({
            team_member_id: params.id,
            day_of_week: s.day_of_week,
            start_time: s.start_time,
            end_time: s.end_time,
            is_available: s.is_available !== false,
          }));

          await supabase.from('team_shifts').insert(shifts);
        }

        return NextResponse.json({ success: true });

      case 'assign_job':
        const { error: assignError } = await supabase
          .from('jobs')
          .update({ assigned_technician_id: params.id })
          .eq('id', data.job_id);

        if (assignError) throw assignError;
        return NextResponse.json({ success: true });

      case 'unassign_job':
        const { error: unassignError } = await supabase
          .from('jobs')
          .update({ assigned_technician_id: null })
          .eq('id', data.job_id)
          .eq('assigned_technician_id', params.id);

        if (unassignError) throw unassignError;
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('[Team Schedule API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update schedule' },
      { status: 500 }
    );
  }
}
