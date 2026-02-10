// Murray's FSM - Mobile Sync API v1
// ==================================
// Batch sync endpoint for offline-first mobile app
// Schema: supabase/schema.sql
//
// Tables synced: jobs, customers, locations, line_items, job_photos
// Settings pulled from: profiles.settings
//
// Security: Bearer token auth with scope check
// Idempotency: Per-item error handling with partial success
// Pagination: Cursor-based via nextCursor field
// Concurrency: Optimistic locking via updated_at comparison

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { authenticateApiRequest } from '@/lib/api-auth'
import { hasScope } from '@murray-fsm/services'

interface SyncChange {
  id: string
  action: 'create' | 'update' | 'delete'
  data?: Record<string, unknown>
  updated_at?: string // Client-side timestamp for optimistic locking
}

interface SyncRequest {
  lastSyncedAt?: string
  deviceId: string
  cursor?: string // ISO timestamp cursor for pagination
  changes?: {
    jobs?: SyncChange[]
    photos?: SyncChange[]
  }
}

interface ChangeResult {
  id: string
  action: string
  success: boolean
  error?: string
}

interface SyncResponse {
  jobs: unknown[]
  customers: unknown[]
  locations: unknown[]
  lineItems: unknown[]
  photos: unknown[]
  settings: Record<string, unknown>
  serverTime: string
  hasMore: boolean
  nextCursor: string | null
  changeResults?: ChangeResult[]
}

// Whitelisted fields for job updates (prevents arbitrary column writes)
const VALID_JOB_FIELDS = [
  'title', 'service_type', 'problem_description', 'status',
  'scheduled_start', 'scheduled_end', 'arrived_at', 'started_at', 'completed_at',
  'internal_notes', 'customer_notes', 'diagnostics',
  'customer_id', 'location_id',
] as const

// Whitelisted fields for photo inserts (prevents arbitrary column writes)
const VALID_PHOTO_FIELDS = [
  'job_id', 'kind', 'storage_bucket', 'storage_path',
  'mime_type', 'captured_at', 'caption',
] as const

const PAGE_LIMITS = {
  jobs: 500,
  customers: 500,
  locations: 500,
  lineItems: 1000,
  photos: 200,
} as const

// POST /api/v1/sync - Batch sync for mobile
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const auth = await authenticateApiRequest(request)

  if (!auth.authenticated) {
    return NextResponse.json(
      { error: auth.error, code: 'UNAUTHORIZED' },
      { status: auth.statusCode || 401 }
    )
  }

  if (!hasScope(auth.scopes!, 'read:jobs')) {
    return NextResponse.json(
      { error: 'Insufficient permissions', code: 'FORBIDDEN' },
      { status: 403 }
    )
  }

  try {
    const supabase = createAdminClient()
    const body: SyncRequest = await request.json()
    const { lastSyncedAt, deviceId, cursor, changes } = body

    // Process any incoming changes from device (per-item error handling)
    let changeResults: ChangeResult[] | undefined
    if (changes) {
      changeResults = await processChanges(supabase, auth.ownerId!, changes)
    }

    // Determine sync cutoff:
    // - cursor takes precedence (for pagination continuation)
    // - then lastSyncedAt (incremental sync)
    // - fallback: 30 days ago (initial sync)
    const syncCutoff = cursor
      ? new Date(cursor)
      : lastSyncedAt
        ? new Date(lastSyncedAt)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

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
        .order('updated_at', { ascending: true }) // ascending for cursor pagination
        .limit(PAGE_LIMITS.jobs),

      // Customers — schema columns only
      supabase
        .from('customers')
        .select('id, owner_id, name, phone, email, notes, created_at, updated_at, deleted')
        .eq('owner_id', auth.ownerId)
        .gte('updated_at', syncCutoff.toISOString())
        .order('updated_at', { ascending: true })
        .limit(PAGE_LIMITS.customers),

      // Locations — schema columns only
      supabase
        .from('locations')
        .select('id, owner_id, customer_id, address1, address2, city, state, postal_code, access_notes, lat, lng, created_at, updated_at, deleted')
        .eq('owner_id', auth.ownerId)
        .gte('updated_at', syncCutoff.toISOString())
        .order('updated_at', { ascending: true })
        .limit(PAGE_LIMITS.locations),

      // Line items — schema columns only
      supabase
        .from('line_items')
        .select('id, owner_id, job_id, kind, name, description, qty, unit_price_cents, total_cents, sort_order, created_at, updated_at, deleted')
        .eq('owner_id', auth.ownerId)
        .gte('updated_at', syncCutoff.toISOString())
        .order('updated_at', { ascending: true })
        .limit(PAGE_LIMITS.lineItems),

      // Job photos — schema columns only
      supabase
        .from('job_photos')
        .select('id, owner_id, job_id, kind, storage_bucket, storage_path, mime_type, captured_at, caption, created_at, updated_at, deleted')
        .eq('owner_id', auth.ownerId)
        .gte('updated_at', syncCutoff.toISOString())
        .order('updated_at', { ascending: true })
        .limit(PAGE_LIMITS.photos),

      // Settings from profiles table
      supabase
        .from('profiles')
        .select('settings, timezone, company_name')
        .eq('id', auth.ownerId)
        .single(),
    ])

    // Determine if there's more data (any table hit its limit)
    const hasMore =
      (jobs?.length || 0) >= PAGE_LIMITS.jobs ||
      (customers?.length || 0) >= PAGE_LIMITS.customers ||
      (lineItems?.length || 0) >= PAGE_LIMITS.lineItems ||
      (photos?.length || 0) >= PAGE_LIMITS.photos

    // Compute next cursor from the latest updated_at across all results
    let nextCursor: string | null = null
    if (hasMore) {
      const allTimestamps = [
        ...(jobs || []),
        ...(customers || []),
        ...(locations || []),
        ...(lineItems || []),
        ...(photos || []),
      ]
        .map((r: any) => r.updated_at)
        .filter(Boolean)
        .sort()

      if (allTimestamps.length > 0) {
        nextCursor = allTimestamps[allTimestamps.length - 1]
      }
    }

    const serverTime = new Date().toISOString()
    const syncDuration = Date.now() - startTime

    const response: SyncResponse = {
      jobs: jobs || [],
      customers: customers || [],
      locations: locations || [],
      lineItems: lineItems || [],
      photos: photos || [],
      settings: profile?.settings || {},
      serverTime,
      hasMore,
      nextCursor,
      changeResults,
    }

    // Log sync event for observability
    logSyncEvent(supabase, {
      ownerId: auth.ownerId!,
      deviceId: deviceId || 'unknown',
      syncType: lastSyncedAt ? 'incremental' : 'full',
      recordsSent: changeResults?.filter(r => r.success).length || 0,
      recordsReceived:
        (jobs?.length || 0) +
        (customers?.length || 0) +
        (locations?.length || 0) +
        (lineItems?.length || 0) +
        (photos?.length || 0),
      durationMs: syncDuration,
      errors: changeResults?.filter(r => !r.success).map(r => `${r.id}: ${r.error}`).join('; ') || null,
    }).catch(err => console.error('[Sync] Failed to log sync event:', err))

    return NextResponse.json({
      success: true,
      data: response,
      syncDuration,
    })
  } catch (error) {
    console.error('Sync API error:', error)
    return NextResponse.json(
      { error: 'Sync failed', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

/**
 * Process incoming changes from device with per-item error handling.
 * Returns results for each change so the client knows what succeeded/failed.
 */
async function processChanges(
  supabase: ReturnType<typeof createAdminClient>,
  ownerId: string,
  changes: SyncRequest['changes']
): Promise<ChangeResult[]> {
  if (!changes) return []

  const results: ChangeResult[] = []

  // Process job changes
  if (changes.jobs) {
    for (const change of changes.jobs) {
      try {
        if (change.action === 'update' && change.data) {
          // Filter to only allow valid job columns
          const filtered: Record<string, unknown> = {}
          for (const key of VALID_JOB_FIELDS) {
            if (key in change.data) filtered[key] = change.data[key]
          }

          if (Object.keys(filtered).length === 0) {
            results.push({ id: change.id, action: 'update', success: true })
            continue
          }

          // Optimistic locking: only update if server record hasn't changed
          // since the client last synced it
          let query = supabase
            .from('jobs')
            .update({ ...filtered, updated_at: new Date().toISOString() })
            .eq('id', change.id)
            .eq('owner_id', ownerId)

          if (change.updated_at) {
            // Only update if server version matches what the client had
            query = query.lte('updated_at', change.updated_at)
          }

          const { error, count } = await query.select('id').maybeSingle()

          if (error) {
            results.push({ id: change.id, action: 'update', success: false, error: error.message })
          } else if (count === 0 && change.updated_at) {
            results.push({ id: change.id, action: 'update', success: false, error: 'Conflict: record was modified on server' })
          } else {
            results.push({ id: change.id, action: 'update', success: true })
          }
        } else if (change.action === 'delete') {
          const { error } = await supabase
            .from('jobs')
            .update({ deleted: true, updated_at: new Date().toISOString() })
            .eq('id', change.id)
            .eq('owner_id', ownerId)

          results.push({
            id: change.id,
            action: 'delete',
            success: !error,
            error: error?.message,
          })
        }
      } catch (err: any) {
        results.push({
          id: change.id,
          action: change.action,
          success: false,
          error: err.message || 'Unknown error',
        })
      }
    }
  }

  // Process photo changes — job_photos table (with field whitelist)
  if (changes.photos) {
    for (const change of changes.photos) {
      try {
        if (change.action === 'create' && change.data) {
          // Whitelist photo fields to prevent arbitrary column injection
          const filtered: Record<string, unknown> = {}
          for (const key of VALID_PHOTO_FIELDS) {
            if (key in change.data) filtered[key] = change.data[key]
          }

          const { error } = await supabase
            .from('job_photos')
            .insert({
              ...filtered,
              owner_id: ownerId,
              id: change.id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })

          if (error && error.code === '23505') {
            // Duplicate photo — already exists, treat as success
            results.push({ id: change.id, action: 'create', success: true })
          } else {
            results.push({
              id: change.id,
              action: 'create',
              success: !error,
              error: error?.message,
            })
          }
        } else if (change.action === 'delete') {
          const { error } = await supabase
            .from('job_photos')
            .update({ deleted: true, updated_at: new Date().toISOString() })
            .eq('id', change.id)
            .eq('owner_id', ownerId)

          results.push({
            id: change.id,
            action: 'delete',
            success: !error,
            error: error?.message,
          })
        }
      } catch (err: any) {
        results.push({
          id: change.id,
          action: change.action,
          success: false,
          error: err.message || 'Unknown error',
        })
      }
    }
  }

  return results
}

/**
 * Log sync event for observability (non-blocking).
 * Writes to device_sync_log table defined in schema-v2.sql.
 */
async function logSyncEvent(
  supabase: ReturnType<typeof createAdminClient>,
  event: {
    ownerId: string
    deviceId: string
    syncType: 'full' | 'incremental'
    recordsSent: number
    recordsReceived: number
    durationMs: number
    errors: string | null
  }
): Promise<void> {
  await supabase.from('device_sync_log').insert({
    owner_id: event.ownerId,
    device_id: event.deviceId,
    sync_type: event.syncType,
    records_sent: event.recordsSent,
    records_received: event.recordsReceived,
    duration_ms: event.durationMs,
    error: event.errors,
    synced_at: new Date().toISOString(),
  })
}
