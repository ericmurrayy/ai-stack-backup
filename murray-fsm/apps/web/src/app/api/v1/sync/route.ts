// Murray's FSM - Mobile Sync API v1
// ==================================
// Batch sync endpoint for offline-first mobile app

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authenticateAndRateLimit } from '@/lib/api-middleware';
import { applyRateLimitHeaders } from '@/lib/rate-limiter';
import { hasScope } from '@murray-fsm/services';
import { z } from 'zod';
import {
  validateBody,
  isoDateString,
  uuidString,
  SYNC_CHANGE_ACTIONS,
} from '@/lib/api-validation';

// --- Zod Schemas ---

const syncChangeItemSchema = z.object({
  id: uuidString,
  action: z.enum(SYNC_CHANGE_ACTIONS),
  data: z.record(z.unknown()).optional(),
});

const syncRequestBodySchema = z.object({
  lastSyncedAt: isoDateString.optional(),
  deviceId: z.string().min(1, 'deviceId is required').max(200),
  changes: z.object({
    jobs: z.array(syncChangeItemSchema).max(100, 'Too many job changes (max 100)').optional(),
    timeEntries: z.array(syncChangeItemSchema).max(100, 'Too many time entry changes (max 100)').optional(),
    photos: z.array(syncChangeItemSchema).max(50, 'Too many photo changes (max 50)').optional(),
  }).optional(),
});

type SyncRequest = z.infer<typeof syncRequestBodySchema>;

interface SyncResponse {
  jobs: unknown[];
  customers: unknown[];
  locations: unknown[];
  lineItems: unknown[];
  photos: unknown[];
  settings: unknown;
  serverTime: string;
  hasMore: boolean;
}

// POST /api/v1/sync - Batch sync for mobile
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const { authenticated, auth, rateLimit, error: authError } = await authenticateAndRateLimit(request);

  if (!authenticated || !rateLimit.allowed) return authError!;

  if (!hasScope(auth.scopes!, 'read:jobs')) {
    return applyRateLimitHeaders(
      NextResponse.json(
        { error: 'Insufficient permissions', code: 'FORBIDDEN' },
        { status: 403 }
      ),
      rateLimit
    );
  }

  try {
    const supabase = await createClient();
    const body = await request.json();

    // Validate request body
    const bodyResult = validateBody(syncRequestBodySchema, body);
    if (!bodyResult.success) return bodyResult.response;

    const { lastSyncedAt, deviceId, changes } = bodyResult.data;

    // Process any incoming changes from device (requires write scope)
    if (changes) {
      if (!hasScope(auth.scopes!, 'write:jobs')) {
        return applyRateLimitHeaders(
          NextResponse.json(
            { error: 'write:jobs scope required to push changes', code: 'FORBIDDEN' },
            { status: 403 }
          ),
          rateLimit
        );
      }
      await processChanges(supabase, auth.ownerId!, changes);
    }

    // Determine sync cutoff (last sync time or 30 days ago for initial sync)
    const syncCutoff = lastSyncedAt
      ? new Date(lastSyncedAt)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Fetch updated data since last sync in parallel
    const [
      { data: jobs },
      { data: customers },
      { data: locations },
      { data: lineItems },
      { data: photos },
      { data: settings },
    ] = await Promise.all([
      // Jobs updated since last sync
      supabase
        .from('jobs')
        .select(`
          id, title, status, service_type, scheduled_start, scheduled_end,
          total_cents, paid_cents, internal_notes, customer_notes,
          customer_id, location_id, assigned_to, priority,
          estimated_duration_minutes, created_at, updated_at, deleted
        `)
        .eq('owner_id', auth.ownerId)
        .gte('updated_at', syncCutoff.toISOString())
        .order('updated_at', { ascending: false })
        .limit(500),

      // Customers updated since last sync
      supabase
        .from('customers')
        .select('id, name, email, phone, company, source, tags, notes, created_at, updated_at, deleted')
        .eq('owner_id', auth.ownerId)
        .gte('updated_at', syncCutoff.toISOString())
        .order('updated_at', { ascending: false })
        .limit(500),

      // Locations updated since last sync
      supabase
        .from('locations')
        .select('id, customer_id, address1, address2, city, state, postal_code, lat, lng, notes, is_primary, created_at, updated_at, deleted')
        .eq('owner_id', auth.ownerId)
        .gte('updated_at', syncCutoff.toISOString())
        .order('updated_at', { ascending: false })
        .limit(500),

      // Line items updated since last sync
      supabase
        .from('line_items')
        .select('id, job_id, kind, name, description, qty, unit_price_cents, total_cents, created_at, updated_at, deleted')
        .eq('owner_id', auth.ownerId)
        .gte('updated_at', syncCutoff.toISOString())
        .order('updated_at', { ascending: false })
        .limit(1000),

      // Photos updated since last sync
      supabase
        .from('job_photos')
        .select('id, job_id, url, thumbnail_url, caption, taken_at, created_at, deleted')
        .eq('owner_id', auth.ownerId)
        .gte('created_at', syncCutoff.toISOString())
        .order('created_at', { ascending: false })
        .limit(200),

      // Business settings (always fetch latest)
      supabase
        .from('business_settings')
        .select('*')
        .eq('owner_id', auth.ownerId)
        .single(),
    ]);

    // Log device sync (non-critical, don't fail if logging fails)
    try {
      await supabase.from('device_sync_log').insert({
        owner_id: auth.ownerId,
        device_id: deviceId,
        sync_type: lastSyncedAt ? 'incremental' : 'full',
        records_sent: (jobs?.length || 0) + (customers?.length || 0) + (locations?.length || 0),
        duration_ms: Date.now() - startTime,
        synced_at: new Date().toISOString(),
      });
    } catch {
      // Ignore logging errors
    }

    const response: SyncResponse = {
      jobs: jobs || [],
      customers: customers || [],
      locations: locations || [],
      lineItems: lineItems || [],
      photos: photos || [],
      settings: settings || {},
      serverTime: new Date().toISOString(),
      hasMore: (jobs?.length || 0) >= 500 || (customers?.length || 0) >= 500,
    };

    return applyRateLimitHeaders(
      NextResponse.json({
        success: true,
        data: response,
        syncDuration: Date.now() - startTime,
      }),
      rateLimit
    );
  } catch (error) {
    console.error('Sync API error:', error);
    return NextResponse.json(
      { error: 'Sync failed', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

async function processChanges(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  changes: SyncRequest['changes']
): Promise<void> {
  if (!changes) return;

  // Allowlists prevent arbitrary field overwrite
  const JOB_ALLOWED_FIELDS = [
    'title', 'status', 'service_type', 'scheduled_start', 'scheduled_end',
    'internal_notes', 'customer_notes', 'priority', 'estimated_duration_minutes',
    'actual_duration_minutes',
  ];
  const TIME_ENTRY_ALLOWED_FIELDS = [
    'job_id', 'team_member_id', 'clock_in', 'clock_out', 'break_minutes', 'notes',
  ];
  const PHOTO_ALLOWED_FIELDS = [
    'job_id', 'url', 'thumbnail_url', 'caption', 'taken_at',
  ];

  function pick(data: Record<string, unknown>, allowed: string[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const key of allowed) {
      if (data[key] !== undefined) result[key] = data[key];
    }
    return result;
  }

  // Process job changes
  if (changes.jobs) {
    for (const change of changes.jobs) {
      if (change.action === 'update' && change.data) {
        const safe = pick(change.data, JOB_ALLOWED_FIELDS);
        await supabase
          .from('jobs')
          .update({ ...safe, updated_at: new Date().toISOString() })
          .eq('id', change.id)
          .eq('owner_id', ownerId);
      }
    }
  }

  // Process time entry changes
  if (changes.timeEntries) {
    for (const change of changes.timeEntries) {
      if (change.action === 'create' && change.data) {
        const safe = pick(change.data, TIME_ENTRY_ALLOWED_FIELDS);
        await supabase
          .from('time_entries')
          .insert({ ...safe, owner_id: ownerId, id: change.id });
      } else if (change.action === 'update' && change.data) {
        const safe = pick(change.data, TIME_ENTRY_ALLOWED_FIELDS);
        await supabase
          .from('time_entries')
          .update(safe)
          .eq('id', change.id)
          .eq('owner_id', ownerId);
      }
    }
  }

  // Process photo changes
  if (changes.photos) {
    for (const change of changes.photos) {
      if (change.action === 'create' && change.data) {
        const safe = pick(change.data, PHOTO_ALLOWED_FIELDS);
        await supabase
          .from('job_photos')
          .insert({ ...safe, owner_id: ownerId, id: change.id });
      } else if (change.action === 'delete') {
        await supabase
          .from('job_photos')
          .update({ deleted: true })
          .eq('id', change.id)
          .eq('owner_id', ownerId);
      }
    }
  }
}
