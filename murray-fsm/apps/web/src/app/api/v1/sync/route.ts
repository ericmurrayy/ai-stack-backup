// Murray's FSM - Mobile Sync API v1
// ==================================
// Batch sync endpoint for offline-first mobile app

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { hasScope } from '@murray-fsm/services';

interface SyncRequest {
  lastSyncedAt?: string;
  deviceId: string;
  changes?: {
    jobs?: Array<{ id: string; action: 'create' | 'update' | 'delete'; data?: Record<string, unknown> }>;
    timeEntries?: Array<{ id: string; action: 'create' | 'update' | 'delete'; data?: Record<string, unknown> }>;
    photos?: Array<{ id: string; action: 'create' | 'delete'; data?: Record<string, unknown> }>;
  };
}

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
  const auth = await authenticateApiRequest(request);

  if (!auth.authenticated) {
    return NextResponse.json(
      { error: auth.error, code: 'UNAUTHORIZED' },
      { status: auth.statusCode || 401 }
    );
  }

  if (!hasScope(auth.scopes!, 'read:jobs')) {
    return NextResponse.json(
      { error: 'Insufficient permissions', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  try {
    const supabase = createClient();
    const body: SyncRequest = await request.json();
    const { lastSyncedAt, deviceId, changes } = body;

    // Process any incoming changes from device
    if (changes) {
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

    return NextResponse.json({
      success: true,
      data: response,
      syncDuration: Date.now() - startTime,
    });
  } catch (error) {
    console.error('Sync API error:', error);
    return NextResponse.json(
      { error: 'Sync failed', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

async function processChanges(
  supabase: ReturnType<typeof createClient>,
  ownerId: string,
  changes: SyncRequest['changes']
): Promise<void> {
  if (!changes) return;

  // Process job changes
  if (changes.jobs) {
    for (const change of changes.jobs) {
      if (change.action === 'update' && change.data) {
        await supabase
          .from('jobs')
          .update({ ...change.data, updated_at: new Date().toISOString() })
          .eq('id', change.id)
          .eq('owner_id', ownerId);
      }
    }
  }

  // Process time entry changes
  if (changes.timeEntries) {
    for (const change of changes.timeEntries) {
      if (change.action === 'create' && change.data) {
        await supabase
          .from('time_entries')
          .insert({ ...change.data, owner_id: ownerId, id: change.id });
      } else if (change.action === 'update' && change.data) {
        await supabase
          .from('time_entries')
          .update(change.data)
          .eq('id', change.id)
          .eq('owner_id', ownerId);
      }
    }
  }

  // Process photo changes
  if (changes.photos) {
    for (const change of changes.photos) {
      if (change.action === 'create' && change.data) {
        await supabase
          .from('job_photos')
          .insert({ ...change.data, owner_id: ownerId, id: change.id });
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
