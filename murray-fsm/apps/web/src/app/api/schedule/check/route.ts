// Murray's FSM - Schedule Check API Route
// ========================================
// Check for scheduling conflicts and get available slots

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  detectScheduleConflicts,
  checkBusinessHours,
  getAvailableSlots,
  getAvailableSlotsRange,
  findNextAvailableSlot,
  type ScheduledJob,
} from '@murray-fsm/services';

/**
 * POST /api/schedule/check
 * Check if a proposed time slot has conflicts
 *
 * Body: {
 *   proposedStart: string (ISO date),
 *   proposedEnd?: string (ISO date),
 *   excludeJobId?: string (for rescheduling)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { proposedStart, proposedEnd, excludeJobId } = body;

    if (!proposedStart) {
      return NextResponse.json({ error: 'proposedStart is required' }, { status: 400 });
    }

    // Fetch existing jobs scoped to user
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('id, scheduled_start, scheduled_end, title, status')
      .eq('owner_id', user.id)
      .eq('deleted', false)
      .not('status', 'in', '("cancelled","completed")')
      .not('scheduled_start', 'is', null);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
    }

    // Filter out the job being rescheduled
    const existingJobs: ScheduledJob[] = (jobs || [])
      .filter((job) => job.id !== excludeJobId)
      .map((job) => ({
        id: job.id,
        scheduled_start: job.scheduled_start,
        scheduled_end: job.scheduled_end,
        title: job.title,
        status: job.status,
      }));

    // Check for conflicts
    const conflicts = detectScheduleConflicts(proposedStart, proposedEnd, existingJobs);

    // Check business hours
    const hoursConflict = checkBusinessHours(
      proposedStart,
      proposedEnd || new Date(new Date(proposedStart).getTime() + 2 * 60 * 60 * 1000).toISOString()
    );

    if (hoursConflict) {
      conflicts.push(hoursConflict);
    }

    return NextResponse.json({
      hasConflicts: conflicts.length > 0,
      conflicts,
      canSchedule: conflicts.length === 0,
    });

  } catch (error) {
    console.error('Error checking schedule:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/schedule/check
 * Get available time slots
 *
 * Query params:
 *   date: string (ISO date) - Single day
 *   startDate: string (ISO date) - Range start
 *   numDays: number - Range length (default 7)
 *   duration: number - Slot duration in minutes (default 120)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const numDays = parseInt(searchParams.get('numDays') || '7', 10);
    const duration = parseInt(searchParams.get('duration') || '120', 10);

    // Fetch existing jobs scoped to user
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('id, scheduled_start, scheduled_end, title, status')
      .eq('owner_id', user.id)
      .eq('deleted', false)
      .not('status', 'in', '("cancelled","completed")')
      .not('scheduled_start', 'is', null);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
    }

    const existingJobs: ScheduledJob[] = (jobs || []).map((job) => ({
      id: job.id,
      scheduled_start: job.scheduled_start,
      scheduled_end: job.scheduled_end,
      title: job.title,
      status: job.status,
    }));

    // Single day request
    if (date) {
      const slots = getAvailableSlots(date, existingJobs, duration);
      return NextResponse.json({
        date,
        slots: slots.map((slot) => ({
          start: slot.start.toISOString(),
          end: slot.end.toISOString(),
          durationMinutes: slot.durationMinutes,
        })),
      });
    }

    // Range request
    if (startDate) {
      const slotsMap = getAvailableSlotsRange(startDate, numDays, existingJobs, duration);
      const result: Record<string, any[]> = {};

      slotsMap.forEach((slots, dateKey) => {
        result[dateKey] = slots.map((slot) => ({
          start: slot.start.toISOString(),
          end: slot.end.toISOString(),
          durationMinutes: slot.durationMinutes,
        }));
      });

      return NextResponse.json({
        startDate,
        numDays,
        slots: result,
      });
    }

    // Default: find next available slot
    const nextSlot = findNextAvailableSlot(existingJobs, duration);

    return NextResponse.json({
      nextAvailable: nextSlot
        ? {
            start: nextSlot.start.toISOString(),
            end: nextSlot.end.toISOString(),
            durationMinutes: nextSlot.durationMinutes,
          }
        : null,
    });

  } catch (error) {
    console.error('Error getting available slots:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
