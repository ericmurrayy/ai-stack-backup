// Murray's FSM - Mobile Sync API v1
// ==================================
// Batch sync endpoint for offline-first mobile app
// Schema: supabase/schema.sql
//
// Tables synced: jobs, customers, locations, line_items, job_photos
// Settings pulled from: profiles.settings
// No phantom tables: business_settings, device_sync_log, time_entries removed

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { hasScope } from '@murray-fsm/services';

interface SyncRequest {
  lastSyncedAt?: string;
  deviceId: string;
  changes?: {
    jobs?: Array<{ id: string; action: 'create' | 'update' | 'delete'; data?: Record<string, unknown> }>;
    photos?: Array<{ id: string; action: 'create' | 'delete'; data?: Record<string, unknown> }>;
  };
}

interface SyncResponse {
  jobs: unknown[];
  customers: unknown[];
  locations: unknown[];
  lineItems: unknown[];
  photos: unknown[];
  settings: Record<string, unknown>;
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
    const supabase = createAdminClient();
    const body: SyncRequest = await request.json();
    const { lastSyncedAt, changes } = body;

    // Process any incoming changes from device
    if (changes) {
      await processChanges(supabase, auth.ownerId!, changes);
    }

    // Determine sync cutoff (last sync time or 30 days ago for initial sync)
    const syncCutoff = lastSyncedAt
      ? new Date(lastSyncedAt)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Fetch updated data since last sync in parallel
    // All columns match schema.sql exactly
    const [
      { data: jobs },
      { data: customers },
      { data: locations },
      { data: lineItems },
      { data: photos },
      { data: profile },
    ] = await Promise.all([
      // Jobs — schema columns only
      supabase
        .from('jobs')
        .select(`
          id, owner_id, customer_id, location_id,
          title, service_type, problem_description, status,
          scheduled_start, scheduled_end, arrived_at, started_at, completed_at,
          internal_notes, customer_notes, diagnostics,
          total_estimate_cents, total_invoice_cents, paid_cents,
          created_at, updated_at, deleted
        `)
        .eq('owner_id', auth.ownerId)
        .gte('updated_at', syncCutoff.toISOString())
        .order('updated_at', { ascending: false })
        .limit(500),

      // Customers — schema columns only
      supabase
        .from('customers')
        .select('id, owner_id, name, phone, email, notes, created_at, updated_at, deleted')
        .eq('owner_id', auth.ownerId)
        .gte('updated_at', syncCutoff.toISOString())
        .order('updated_at', { ascending: false })
        .limit(500),

      // Locations — schema columns only
      supabase
        .from('locations')
        .select('id, owner_id, customer_id, address1, address2, city, state, postal_code, access_notes, lat, lng, created_at, updated_at, deleted')
        .eq('owner_id', auth.ownerId)
        .gte('updated_at', syncCutoff.toISOString())
        .order('updated_at', { ascending: false })
        .limit(500),

      // Line items — schema columns only (qty not quantity, sort_order exists)
      supabase
        .from('line_items')
        .select('id, owner_id, job_id, kind, name, description, qty, unit_price_cents, total_cents, sort_order, created_at, updated_at, deleted')
        .eq('owner_id', auth.ownerId)
        .gte('updated_at', syncCutoff.toISOString())
        .order('updated_at', { ascending: false })
        .limit(1000),

      // Job photos — schema columns only (storage_path not url, captured_at not taken_at)
      supabase
        .from('job_photos')
        .select('id, owner_id, job_id, kind, storage_bucket, storage_path, mime_type, captured_at, caption, created_at, updated_at, deleted')
        .eq('owner_id', auth.ownerId)
        .gte('updated_at', syncCutoff.toISOString())
        .order('updated_at', { ascending: false })
        .limit(200),

      // Settings from profiles table (replaces phantom business_settings table)
      supabase
        .from('profiles')
        .select('settings, timezone, company_name')
        .eq('id', auth.ownerId)
        .single(),
    ]);

    const response: SyncResponse = {
      jobs: jobs || [],
      customers: customers || [],
      locations: locations || [],
      lineItems: lineItems || [],
      photos: photos || [],
      settings: profile?.settings || {},
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
  supabase: ReturnType<typeof createAdminClient>,
  ownerId: string,
  changes: SyncRequest['changes']
): Promise<void> {
  if (!changes) return;

  // Process job changes
  if (changes.jobs) {
    for (const change of changes.jobs) {
      if (change.action === 'update' && change.data) {
        // Filter to only allow valid job columns
        const validJobFields = [
          'title', 'service_type', 'problem_description', 'status',
          'scheduled_start', 'scheduled_end', 'arrived_at', 'started_at', 'completed_at',
          'internal_notes', 'customer_notes', 'diagnostics',
          'customer_id', 'location_id',
        ];
        const filtered: Record<string, unknown> = {};
        for (const key of validJobFields) {
          if (key in change.data) filtered[key] = change.data[key];
        }
        if (Object.keys(filtered).length > 0) {
          await supabase
            .from('jobs')
            .update(filtered)
            .eq('id', change.id)
            .eq('owner_id', ownerId);
        }
      } else if (change.action === 'delete') {
        await supabase
          .from('jobs')
          .update({ deleted: true })
          .eq('id', change.id)
          .eq('owner_id', ownerId);
      }
    }
  }

  // Process photo changes — job_photos table
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

  // Note: time_entries table does not exist in schema.
  // If time tracking is needed, it should be added to schema.sql first.
}
