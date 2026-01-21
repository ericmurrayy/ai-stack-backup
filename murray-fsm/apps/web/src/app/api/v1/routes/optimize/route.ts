// Murray's FSM - Route Optimization API v1
// =========================================
// Optimize technician routes for the day

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { hasScope, optimizeRoute, dispatchJobs, findNearestTechnician } from '@murray-fsm/services';

// POST /api/v1/routes/optimize - Optimize routes for a day
export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request);

  if (!auth.authenticated) {
    return NextResponse.json(
      { error: auth.error, code: 'UNAUTHORIZED' },
      { status: auth.statusCode || 401 }
    );
  }

  if (!hasScope(auth.scopes!, 'read:jobs') || !hasScope(auth.scopes!, 'read:team')) {
    return NextResponse.json(
      { error: 'Insufficient permissions', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  try {
    const supabase = createClient();
    const body = await request.json();
    const { date, technicianIds, mode = 'optimize' } = body;

    // Get the target date (default to today)
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    // Fetch jobs for the day
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select(`
        id, title, scheduled_start, scheduled_end, assigned_to,
        estimated_duration_minutes, priority,
        location:locations(id, lat, lng, address1, city)
      `)
      .eq('owner_id', auth.ownerId)
      .eq('deleted', false)
      .in('status', ['scheduled', 'confirmed'])
      .gte('scheduled_start', startOfDay.toISOString())
      .lte('scheduled_start', endOfDay.toISOString());

    if (jobsError) throw jobsError;

    // Fetch technicians
    let techQuery = supabase
      .from('team_members')
      .select('id, full_name, color')
      .eq('owner_id', auth.ownerId)
      .eq('deleted', false)
      .eq('is_active', true)
      .eq('role', 'technician');

    if (technicianIds && technicianIds.length > 0) {
      techQuery = techQuery.in('id', technicianIds);
    }

    const { data: technicians, error: techError } = await techQuery;
    if (techError) throw techError;

    // Get business settings for start location
    const { data: settings } = await supabase
      .from('business_settings')
      .select('business_address, business_city, business_state')
      .eq('owner_id', auth.ownerId)
      .single();

    // Default start location (business address or Denver)
    const defaultStartLocation = {
      id: 'office',
      lat: 39.7392, // Denver default
      lng: -104.9903,
      address: settings?.business_address || 'Office',
    };

    // Transform jobs for routing
    const routingJobs = (jobs || [])
      .filter(j => j.location?.lat && j.location?.lng)
      .map(j => ({
        id: j.id,
        location: {
          id: j.location.id,
          lat: j.location.lat,
          lng: j.location.lng,
          address: `${j.location.address1}, ${j.location.city}`,
        },
        duration: j.estimated_duration_minutes || 120,
        timeWindow: j.scheduled_start && j.scheduled_end ? {
          start: new Date(j.scheduled_start),
          end: new Date(j.scheduled_end),
        } : undefined,
        priority: j.priority || 0,
        assignedTo: j.assigned_to,
      }));

    let result;

    if (mode === 'dispatch') {
      // Multi-technician dispatch
      const techsWithLocations = (technicians || []).map(t => ({
        id: t.id,
        startLocation: defaultStartLocation,
        maxJobs: 8,
      }));

      const dispatchResult = dispatchJobs(routingJobs, techsWithLocations, {
        startTime: new Date(startOfDay.setHours(8, 0, 0, 0)),
        prioritizeUrgent: true,
      });

      result = {
        mode: 'dispatch',
        routes: Array.from(dispatchResult.routes.entries()).map(([techId, route]) => {
          const tech = technicians?.find(t => t.id === techId);
          return {
            technicianId: techId,
            technicianName: tech?.full_name,
            technicianColor: tech?.color,
            stops: route.stops.map(stop => ({
              jobId: stop.jobId,
              arrivalTime: stop.arrivalTime.toISOString(),
              departureTime: stop.departureTime.toISOString(),
              driveDuration: stop.durationFromPrevious,
              driveDistance: Math.round(stop.distanceFromPrevious / 1000 * 10) / 10, // km
            })),
            totalDistance: Math.round(route.totalDistance / 1000 * 10) / 10, // km
            totalDuration: route.totalDuration,
            totalDriveTime: route.totalDriveTime,
            estimatedEndTime: route.estimatedEndTime.toISOString(),
          };
        }),
        unassignedJobs: dispatchResult.unassignedJobs.map(j => j.id),
        balanceScore: Math.round(dispatchResult.balanceScore * 100),
        totalDistance: Math.round(dispatchResult.totalDistance / 1000 * 10) / 10,
      };
    } else {
      // Single route optimization
      const techId = technicianIds?.[0] || technicians?.[0]?.id;
      const techJobs = techId
        ? routingJobs.filter(j => !j.assignedTo || j.assignedTo === techId)
        : routingJobs;

      const optimized = optimizeRoute(techJobs, {
        startTime: new Date(startOfDay.setHours(8, 0, 0, 0)),
        startLocation: defaultStartLocation,
        prioritizeUrgent: true,
      });

      result = {
        mode: 'optimize',
        route: {
          stops: optimized.stops.map(stop => ({
            jobId: stop.jobId,
            arrivalTime: stop.arrivalTime.toISOString(),
            departureTime: stop.departureTime.toISOString(),
            driveDuration: stop.durationFromPrevious,
            driveDistance: Math.round(stop.distanceFromPrevious / 1000 * 10) / 10,
          })),
          totalDistance: Math.round(optimized.totalDistance / 1000 * 10) / 10,
          totalDuration: optimized.totalDuration,
          totalDriveTime: optimized.totalDriveTime,
          estimatedEndTime: optimized.estimatedEndTime.toISOString(),
        },
      };
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Route optimization error:', error);
    return NextResponse.json(
      { error: 'Route optimization failed', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// GET /api/v1/routes/nearest - Find nearest available technician
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);

  if (!auth.authenticated) {
    return NextResponse.json(
      { error: auth.error, code: 'UNAUTHORIZED' },
      { status: auth.statusCode || 401 }
    );
  }

  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);

    const lat = parseFloat(searchParams.get('lat') || '0');
    const lng = parseFloat(searchParams.get('lng') || '0');

    if (!lat || !lng) {
      return NextResponse.json(
        { error: 'lat and lng are required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Get technician current locations
    const { data: locations } = await supabase
      .from('technician_locations')
      .select(`
        team_member_id, lat, lng, recorded_at,
        team_member:team_members(id, full_name, phone, color, is_active)
      `)
      .eq('owner_id', auth.ownerId)
      .gte('recorded_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // Last 30 minutes
      .order('recorded_at', { ascending: false });

    // Get latest location per technician
    const latestLocations = new Map();
    for (const loc of locations || []) {
      if (!latestLocations.has(loc.team_member_id) && loc.team_member?.is_active) {
        latestLocations.set(loc.team_member_id, loc);
      }
    }

    const techsWithLocations = Array.from(latestLocations.values()).map(loc => ({
      id: loc.team_member_id,
      currentLocation: { id: loc.team_member_id, lat: loc.lat, lng: loc.lng },
      available: true,
      name: loc.team_member.full_name,
      phone: loc.team_member.phone,
      color: loc.team_member.color,
    }));

    const nearest = findNearestTechnician(
      { id: 'target', lat, lng },
      techsWithLocations
    );

    if (!nearest) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No available technicians found',
      });
    }

    const tech = techsWithLocations.find(t => t.id === nearest.technicianId);

    return NextResponse.json({
      success: true,
      data: {
        technician: {
          id: tech?.id,
          name: tech?.name,
          phone: tech?.phone,
          color: tech?.color,
        },
        distance: Math.round(nearest.distance / 1000 * 10) / 10, // km
        eta: nearest.eta, // minutes
      },
    });
  } catch (error) {
    console.error('Nearest technician error:', error);
    return NextResponse.json(
      { error: 'Failed to find nearest technician', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
