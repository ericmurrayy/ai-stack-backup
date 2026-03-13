// Murray's FSM - Route Optimization API v1
// =========================================
// Optimize technician routes for the day

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateAndRateLimit } from '@/lib/api-middleware';
import { applyRateLimitHeaders } from '@/lib/rate-limiter';
import { hasScope, optimizeRoute, dispatchJobs, findNearestTechnician } from '@murray-fsm/services';
import { z } from 'zod';
import {
  validateBody,
  validateQuery,
  isoDateString,
  uuidString,
  latLngQuerySchema,
  ROUTE_OPTIMIZE_MODES,
} from '@/lib/api-validation';

// --- Zod Schemas ---

const optimizeBodySchema = z.object({
  date: isoDateString.optional(),
  technicianIds: z.array(uuidString).max(50, 'Too many technician IDs (max 50)').optional(),
  mode: z.enum(ROUTE_OPTIMIZE_MODES).default('optimize'),
});

const nearestQuerySchema = latLngQuerySchema;

// POST /api/v1/routes/optimize - Optimize routes for a day
export async function POST(request: NextRequest) {
  const { authenticated, auth, rateLimit, error: authError } = await authenticateAndRateLimit(request);

  if (!authenticated || !rateLimit.allowed) return authError!;

  if (!hasScope(auth.scopes!, 'read:jobs') || !hasScope(auth.scopes!, 'read:team')) {
    return applyRateLimitHeaders(
      NextResponse.json(
        { error: 'Insufficient permissions', code: 'FORBIDDEN' },
        { status: 403 }
      ),
      rateLimit
    );
  }

  try {
    const supabase = createAdminClient();
    const body = await request.json();

    // Validate request body
    const bodyResult = validateBody(optimizeBodySchema, body);
    if (!bodyResult.success) return bodyResult.response;

    const { date, technicianIds, mode } = bodyResult.data;

    // Get the target date (default to today)
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch jobs for the day
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select(`
        id, title, scheduled_start, scheduled_end, assigned_technician_id,
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
      .from('technicians')
      .select('id, name, color')
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
      .filter(j => {
        const loc = Array.isArray(j.location) ? j.location[0] : j.location;
        return loc?.lat && loc?.lng;
      })
      .map(j => {
        const loc = Array.isArray(j.location) ? j.location[0] : j.location;
        return {
          id: j.id,
          location: {
            id: loc.id,
            lat: loc.lat,
            lng: loc.lng,
            address: `${loc.address1}, ${loc.city}`,
          },
          duration: j.estimated_duration_minutes || 120,
          timeWindow: j.scheduled_start && j.scheduled_end ? {
            start: new Date(j.scheduled_start),
            end: new Date(j.scheduled_end),
          } : undefined,
          priority: j.priority || 0,
          assignedTo: j.assigned_technician_id,
        };
      });

    let result;

    if (mode === 'dispatch') {
      // Multi-technician dispatch
      const techsWithLocations = (technicians || []).map(t => ({
        id: t.id,
        startLocation: defaultStartLocation,
        maxJobs: 8,
      }));

      const dispatchStartTime = new Date(startOfDay);
      dispatchStartTime.setHours(8, 0, 0, 0);
      const dispatchResult = dispatchJobs(routingJobs, techsWithLocations, {
        startTime: dispatchStartTime,
        prioritizeUrgent: true,
      });

      result = {
        mode: 'dispatch',
        routes: Array.from(dispatchResult.routes.entries()).map(([techId, route]) => {
          const tech = technicians?.find(t => t.id === techId);
          return {
            technicianId: techId,
            technicianName: tech?.name,
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

      const optimizeStartTime = new Date(startOfDay);
      optimizeStartTime.setHours(8, 0, 0, 0);
      const optimized = optimizeRoute(techJobs, {
        startTime: optimizeStartTime,
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

    return applyRateLimitHeaders(
      NextResponse.json({
        success: true,
        data: result,
      }),
      rateLimit
    );
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
  const { authenticated, auth, rateLimit, error: authError } = await authenticateAndRateLimit(request);

  if (!authenticated || !rateLimit.allowed) return authError!;

  if (!hasScope(auth.scopes!, 'read:team')) {
    return applyRateLimitHeaders(
      NextResponse.json(
        { error: 'Insufficient permissions', code: 'FORBIDDEN' },
        { status: 403 }
      ),
      rateLimit
    );
  }

  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);

    // Validate query parameters
    const queryResult = validateQuery(nearestQuerySchema, searchParams);
    if (!queryResult.success) return queryResult.response;

    const { lat, lng } = queryResult.data;

    // Get technician current locations
    const { data: locations } = await supabase
      .from('technician_locations')
      .select(`
        team_member_id, lat, lng, recorded_at,
        team_member:technicians(id, name, phone, color, is_active)
      `)
      .eq('owner_id', auth.ownerId)
      .gte('recorded_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // Last 30 minutes
      .order('recorded_at', { ascending: false });

    // Get latest location per technician
    const latestLocations = new Map();
    for (const loc of locations || []) {
      const tm = Array.isArray(loc.team_member) ? loc.team_member[0] : loc.team_member;
      if (!latestLocations.has(loc.team_member_id) && tm?.is_active) {
        latestLocations.set(loc.team_member_id, { ...loc, team_member: tm });
      }
    }

    const techsWithLocations = Array.from(latestLocations.values()).map((loc: any) => ({
      id: loc.team_member_id,
      currentLocation: { id: loc.team_member_id, lat: loc.lat, lng: loc.lng },
      available: true,
      name: loc.team_member?.name,
      phone: loc.team_member?.phone,
      color: loc.team_member?.color,
    }));

    const nearest = findNearestTechnician(
      { id: 'target', lat, lng },
      techsWithLocations
    );

    if (!nearest) {
      return applyRateLimitHeaders(
        NextResponse.json({
          success: true,
          data: null,
          message: 'No available technicians found',
        }),
        rateLimit
      );
    }

    const tech = techsWithLocations.find(t => t.id === nearest.technicianId);

    return applyRateLimitHeaders(
      NextResponse.json({
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
      }),
      rateLimit
    );
  } catch (error) {
    console.error('Nearest technician error:', error);
    return NextResponse.json(
      { error: 'Failed to find nearest technician', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
