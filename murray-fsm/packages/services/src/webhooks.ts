// Murray's FSM - Webhook Management
// ==================================
// Outgoing webhook system for integrations

import crypto from 'crypto';

// ============================================================================
// Webhook Types
// ============================================================================

export type WebhookEvent =
  | 'job.created'
  | 'job.updated'
  | 'job.completed'
  | 'job.cancelled'
  | 'customer.created'
  | 'customer.updated'
  | 'invoice.created'
  | 'invoice.paid'
  | 'payment.received'
  | 'payment.failed'
  | 'estimate.created'
  | 'estimate.approved'
  | 'estimate.rejected'
  | 'appointment.scheduled'
  | 'appointment.rescheduled'
  | 'appointment.cancelled'
  | 'technician.dispatched'
  | 'technician.arrived'
  | 'review.received';

export interface WebhookEndpoint {
  id: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  is_active: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
  last_triggered_at?: string;
  failure_count: number;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event: WebhookEvent;
  payload: Record<string, unknown>;
  response_status?: number;
  response_body?: string;
  delivered_at?: string;
  error?: string;
  attempts: number;
  created_at: string;
}

export interface WebhookPayload {
  id: string;
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

// ============================================================================
// Webhook Signature
// ============================================================================

/**
 * Generate HMAC signature for webhook payload
 */
export function generateWebhookSignature(payload: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return `sha256=${hmac.digest('hex')}`;
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = generateWebhookSignature(payload, secret);
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  // timingSafeEqual throws RangeError if lengths differ
  if (sigBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

/**
 * Generate a secure webhook secret
 */
export function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(32).toString('hex')}`;
}

// ============================================================================
// Webhook Dispatcher
// ============================================================================

export interface WebhookDispatchResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  duration: number;
}

export interface WebhookDispatcher {
  dispatch(
    endpoint: WebhookEndpoint,
    event: WebhookEvent,
    data: Record<string, unknown>
  ): Promise<WebhookDispatchResult>;

  dispatchToAll(
    endpoints: WebhookEndpoint[],
    event: WebhookEvent,
    data: Record<string, unknown>
  ): Promise<Map<string, WebhookDispatchResult>>;
}

/**
 * Create a webhook dispatcher
 */
export function createWebhookDispatcher(options?: {
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}): WebhookDispatcher {
  const timeout = options?.timeout ?? 30000;
  const retryAttempts = options?.retryAttempts ?? 3;
  const retryDelay = options?.retryDelay ?? 1000;

  async function dispatch(
    endpoint: WebhookEndpoint,
    event: WebhookEvent,
    data: Record<string, unknown>
  ): Promise<WebhookDispatchResult> {
    const startTime = Date.now();

    const payload: WebhookPayload = {
      id: crypto.randomUUID(),
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    const payloadString = JSON.stringify(payload);
    const signature = generateWebhookSignature(payloadString, endpoint.secret);

    let lastError: string | undefined;
    let statusCode: number | undefined;

    for (let attempt = 0; attempt < retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': event,
            'X-Webhook-Delivery-Id': payload.id,
            'X-Webhook-Timestamp': payload.timestamp,
            'User-Agent': 'Murray-FSM-Webhook/1.0',
          },
          body: payloadString,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        statusCode = response.status;

        if (response.ok) {
          return {
            success: true,
            statusCode,
            duration: Date.now() - startTime,
          };
        }

        lastError = `HTTP ${response.status}: ${response.statusText}`;

        // Don't retry on client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          break;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
      }

      // Wait before retry (exponential backoff)
      if (attempt < retryAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
      }
    }

    return {
      success: false,
      statusCode,
      error: lastError,
      duration: Date.now() - startTime,
    };
  }

  async function dispatchToAll(
    endpoints: WebhookEndpoint[],
    event: WebhookEvent,
    data: Record<string, unknown>
  ): Promise<Map<string, WebhookDispatchResult>> {
    const results = new Map<string, WebhookDispatchResult>();

    // Filter active endpoints that subscribe to this event
    const activeEndpoints = endpoints.filter(
      ep => ep.is_active && ep.events.includes(event)
    );

    // Dispatch to all endpoints in parallel
    const promises = activeEndpoints.map(async (endpoint) => {
      const result = await dispatch(endpoint, event, data);
      results.set(endpoint.id, result);
    });

    await Promise.all(promises);
    return results;
  }

  return { dispatch, dispatchToAll };
}

// ============================================================================
// Event Descriptions (for UI)
// ============================================================================

export const WEBHOOK_EVENT_DESCRIPTIONS: Record<WebhookEvent, string> = {
  'job.created': 'When a new job is created',
  'job.updated': 'When a job is modified',
  'job.completed': 'When a job is marked complete',
  'job.cancelled': 'When a job is cancelled',
  'customer.created': 'When a new customer is added',
  'customer.updated': 'When customer info is updated',
  'invoice.created': 'When an invoice is generated',
  'invoice.paid': 'When an invoice is paid in full',
  'payment.received': 'When a payment is recorded',
  'payment.failed': 'When a payment fails',
  'estimate.created': 'When an estimate is created',
  'estimate.approved': 'When a customer approves an estimate',
  'estimate.rejected': 'When a customer rejects an estimate',
  'appointment.scheduled': 'When an appointment is scheduled',
  'appointment.rescheduled': 'When an appointment is rescheduled',
  'appointment.cancelled': 'When an appointment is cancelled',
  'technician.dispatched': 'When a tech is dispatched to a job',
  'technician.arrived': 'When a tech marks arrival',
  'review.received': 'When a customer review is received',
};

// ============================================================================
// Webhook Event Categories (for UI grouping)
// ============================================================================

export const WEBHOOK_EVENT_CATEGORIES = {
  Jobs: ['job.created', 'job.updated', 'job.completed', 'job.cancelled'] as WebhookEvent[],
  Customers: ['customer.created', 'customer.updated'] as WebhookEvent[],
  Financial: ['invoice.created', 'invoice.paid', 'payment.received', 'payment.failed', 'estimate.created', 'estimate.approved', 'estimate.rejected'] as WebhookEvent[],
  Scheduling: ['appointment.scheduled', 'appointment.rescheduled', 'appointment.cancelled', 'technician.dispatched', 'technician.arrived'] as WebhookEvent[],
  Reviews: ['review.received'] as WebhookEvent[],
};
