// Murray's FSM - Webhook Event Dispatcher
// ========================================
// Fire-and-forget webhook dispatch utility.
// Call after successful API operations to notify external integrations.

import { createAdminClient } from '@/lib/supabase/admin';
import {
  createWebhookDispatcher,
  type WebhookEvent,
  type WebhookEndpoint,
} from '@murray-fsm/services';

/**
 * Dispatch a webhook event to all matching endpoints for the given owner.
 *
 * This function is designed to be fire-and-forget: it never throws, never
 * blocks the calling route, and logs errors to stderr only.
 *
 * Usage:
 *   // At the end of a successful POST/PATCH handler, after building the response:
 *   dispatchWebhookEvent(auth.ownerId!, 'job.created', { job });
 *   return response; // don't await the dispatch
 */
export function dispatchWebhookEvent(
  ownerId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>
): void {
  // Fire-and-forget: launch the async work but don't await it.
  // The void operator + .catch() ensures unhandled-rejection safety.
  void _dispatch(ownerId, event, payload).catch((err) => {
    console.error(`[webhook-dispatch] Unhandled error for ${event}:`, err);
  });
}

// ---------------------------------------------------------------------------
// Internal implementation
// ---------------------------------------------------------------------------

async function _dispatch(
  ownerId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>
): Promise<void> {
  const supabase = createAdminClient();

  // 1. Fetch active webhook endpoints for this owner that subscribe to the event
  const { data: endpoints, error: fetchError } = await supabase
    .from('webhook_endpoints')
    .select('id, url, secret, events, is_active, description, failure_count, created_at, updated_at, last_triggered_at')
    .eq('owner_id', ownerId)
    .eq('is_active', true)
    .eq('deleted', false)
    .contains('events', [event]);

  if (fetchError) {
    console.error(`[webhook-dispatch] Failed to fetch endpoints for owner=${ownerId}:`, fetchError.message);
    return;
  }

  if (!endpoints || endpoints.length === 0) {
    // No subscribed endpoints — nothing to do.
    return;
  }

  // 2. Create a dispatcher and send to all matching endpoints
  const dispatcher = createWebhookDispatcher({
    timeout: 15_000,    // 15s per attempt (keep total time reasonable)
    retryAttempts: 2,   // 1 initial + 1 retry (background, so keep light)
    retryDelay: 500,
  });

  const results = await dispatcher.dispatchToAll(
    endpoints as WebhookEndpoint[],
    event,
    payload
  );

  // 3. Record delivery results and update endpoint metadata
  const now = new Date().toISOString();

  for (const [endpointId, result] of results) {
    // Insert delivery record
    const { error: deliveryError } = await supabase
      .from('webhook_deliveries')
      .insert({
        webhook_id: endpointId,
        event,
        payload,
        response_status: result.statusCode ?? null,
        response_body: result.error ?? null,
        delivered_at: result.success ? now : null,
        error: result.success ? null : result.error,
        attempts: result.success ? 1 : 2, // mirrors retryAttempts config
        created_at: now,
      });

    if (deliveryError) {
      console.error(
        `[webhook-dispatch] Failed to record delivery for endpoint=${endpointId}:`,
        deliveryError.message
      );
    }

    // Update the endpoint's last_triggered_at (and bump failure_count on error)
    if (result.success) {
      await supabase
        .from('webhook_endpoints')
        .update({
          last_triggered_at: now,
          failure_count: 0, // reset on success
          updated_at: now,
        })
        .eq('id', endpointId);
    } else {
      // Increment failure count
      const endpoint = endpoints.find((ep) => ep.id === endpointId);
      const newFailureCount = (endpoint?.failure_count ?? 0) + 1;

      const updatePayload: Record<string, unknown> = {
        last_triggered_at: now,
        failure_count: newFailureCount,
        updated_at: now,
      };

      // Auto-disable after 10 consecutive failures
      if (newFailureCount >= 10) {
        updatePayload.is_active = false;
        console.warn(
          `[webhook-dispatch] Auto-disabled endpoint=${endpointId} after ${newFailureCount} consecutive failures`
        );
      }

      await supabase
        .from('webhook_endpoints')
        .update(updatePayload)
        .eq('id', endpointId);
    }
  }
}
