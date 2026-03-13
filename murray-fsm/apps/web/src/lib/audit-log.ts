// Murray's FSM - Audit Logging Service
// =====================================
// Append-only audit trail for compliance and security monitoring.
// All writes are non-blocking (fire-and-forget) so they never slow down
// the request path.

import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

export interface AuditLogEntry {
  owner_id: string;
  actor_id?: string | null;
  actor_email?: string | null;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  metadata?: Record<string, unknown>;
  ip_address?: string | null;
}

/**
 * Write an audit log entry. Fire-and-forget — errors are logged but never
 * propagated to the caller.
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('audit_log').insert({
      owner_id: entry.owner_id,
      actor_id: entry.actor_id ?? null,
      actor_email: entry.actor_email ?? null,
      action: entry.action,
      resource_type: entry.resource_type,
      resource_id: entry.resource_id ?? null,
      metadata: entry.metadata ?? {},
      ip_address: entry.ip_address ?? null,
    });

    if (error) {
      console.error('[audit-log] Failed to write:', error.message);
    }
  } catch (err) {
    console.error('[audit-log] Unexpected error:', err);
  }
}

/**
 * Extract client IP from a NextRequest. Checks common proxy headers first.
 */
export function getClientIp(request: NextRequest): string | null {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null
  );
}

/**
 * Convenience: log an action from a route handler.
 */
export function logAction(
  request: NextRequest,
  opts: {
    ownerId: string;
    actorId?: string;
    actorEmail?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
  }
): void {
  // Fire and forget
  writeAuditLog({
    owner_id: opts.ownerId,
    actor_id: opts.actorId,
    actor_email: opts.actorEmail,
    action: opts.action,
    resource_type: opts.resourceType,
    resource_id: opts.resourceId,
    metadata: opts.metadata,
    ip_address: getClientIp(request),
  }).catch(() => {});
}
