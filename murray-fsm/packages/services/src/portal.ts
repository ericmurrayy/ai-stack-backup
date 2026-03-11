// Murray's FSM - Portal Token Service
// =====================================
// Pure utility service for customer portal token generation and SMS templates.
// DB operations are handled by the API routes — this service is side-effect free.

import { randomBytes } from 'crypto';

// ============================================================================
// Types
// ============================================================================

/** Row shape for the portal_tokens table. */
export interface PortalTokenData {
  /** Primary key (UUID) */
  id: string;
  /** Owning organization / tenant ID */
  owner_id: string;
  /** Customer phone number in E.164 format */
  customer_phone: string;
  /** Optional customer email address */
  customer_email?: string;
  /** Cryptographically secure random token (48 hex characters) */
  token: string;
  /** Optional job ID this token is scoped to */
  job_id?: string;
  /** ISO-8601 timestamp when the token expires */
  expires_at: string;
  /** ISO-8601 timestamp when the token was created */
  created_at: string;
  /** ISO-8601 timestamp of last portal access (null if never used) */
  last_accessed_at?: string;
}

/** Input for creating a new portal token row. */
export interface CreatePortalTokenInput {
  /** Customer phone number in E.164 format */
  customer_phone: string;
  /** Optional customer email address */
  customer_email?: string;
  /** Optional job ID to scope the token to a single job */
  job_id?: string;
  /** Number of days until the token expires (default: 30) */
  expires_in_days?: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Length of the generated token in bytes (produces 48 hex characters). */
const TOKEN_BYTE_LENGTH = 24;

/** Default number of days a portal token remains valid. */
const DEFAULT_EXPIRES_IN_DAYS = 30;

// ============================================================================
// Token Generation
// ============================================================================

/**
 * Generate a cryptographically secure random portal token.
 *
 * Returns a 48-character lowercase hex string produced by `crypto.randomBytes`.
 *
 * @returns A 48-char hex token string
 *
 * @example
 * ```ts
 * const token = generatePortalToken();
 * // => "a3f8c1d4e9b7206f5412cde8901ab34567c89def0123abcd"
 * ```
 */
export function generatePortalToken(): string {
  return randomBytes(TOKEN_BYTE_LENGTH).toString('hex');
}

// ============================================================================
// URL Builder
// ============================================================================

/**
 * Build the full customer portal URL for a given token.
 *
 * @param baseUrl  - Application base URL (e.g. "https://app.murrayfsm.com")
 * @param token    - The portal token string
 * @returns The complete portal URL
 *
 * @example
 * ```ts
 * const url = buildPortalUrl('https://app.murrayfsm.com', 'abc123');
 * // => "https://app.murrayfsm.com/portal/abc123"
 * ```
 */
export function buildPortalUrl(baseUrl: string, token: string): string {
  // Strip trailing slash from baseUrl to avoid double slashes
  const cleanBase = baseUrl.replace(/\/+$/, '');
  return `${cleanBase}/portal/${token}`;
}

// ============================================================================
// Expiry Helper
// ============================================================================

/**
 * Compute an ISO-8601 expiry timestamp from now.
 *
 * @param days - Number of days from now (defaults to {@link DEFAULT_EXPIRES_IN_DAYS})
 * @returns ISO-8601 date string
 *
 * @example
 * ```ts
 * const expiresAt = computePortalTokenExpiry(7);
 * // => "2026-03-17T12:00:00.000Z"  (7 days from now)
 * ```
 */
export function computePortalTokenExpiry(days: number = DEFAULT_EXPIRES_IN_DAYS): string {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry.toISOString();
}

// ============================================================================
// SMS Templates
// ============================================================================

/**
 * Build an SMS body inviting a customer to the service portal.
 *
 * @param customerName - First name or full name of the customer
 * @param portalUrl    - Full portal URL (from {@link buildPortalUrl})
 * @param businessName - Name of the business
 * @returns Formatted SMS body
 *
 * @example
 * ```ts
 * const sms = buildPortalInviteSms('John', 'https://app.murrayfsm.com/portal/abc123', 'Murray HVAC');
 * ```
 */
export function buildPortalInviteSms(
  customerName: string,
  portalUrl: string,
  businessName: string,
): string {
  return (
    `Hi ${customerName}, ${businessName} has shared your service portal. ` +
    `View your jobs, estimates, and make payments: ${portalUrl} ` +
    `Reply STOP to unsubscribe.`
  );
}

/**
 * Build an SMS body notifying a customer that an estimate is ready for review.
 *
 * @param customerName  - First name or full name of the customer
 * @param portalUrl     - Full portal URL (from {@link buildPortalUrl})
 * @param businessName  - Name of the business
 * @param estimateAmount - Formatted dollar amount (e.g. "$1,250.00")
 * @returns Formatted SMS body
 *
 * @example
 * ```ts
 * const sms = buildEstimateReadySms('Jane', 'https://app.murrayfsm.com/portal/def456', 'Murray HVAC', '$1,250.00');
 * ```
 */
export function buildEstimateReadySms(
  customerName: string,
  portalUrl: string,
  businessName: string,
  estimateAmount: string,
): string {
  return (
    `Hi ${customerName}, your estimate for ${estimateAmount} from ${businessName} is ready for review. ` +
    `View and approve: ${portalUrl} ` +
    `Reply STOP to unsubscribe.`
  );
}

/**
 * Build an SMS body requesting payment from a customer.
 *
 * @param customerName - First name or full name of the customer
 * @param portalUrl    - Full portal URL (from {@link buildPortalUrl})
 * @param businessName - Name of the business
 * @param amount       - Formatted dollar amount (e.g. "$350.00")
 * @returns Formatted SMS body
 *
 * @example
 * ```ts
 * const sms = buildPaymentRequestSms('John', 'https://app.murrayfsm.com/portal/ghi789', 'Murray HVAC', '$350.00');
 * ```
 */
export function buildPaymentRequestSms(
  customerName: string,
  portalUrl: string,
  businessName: string,
  amount: string,
): string {
  return (
    `Hi ${customerName}, your invoice for ${amount} from ${businessName} is ready. ` +
    `Pay securely online: ${portalUrl} ` +
    `Reply STOP to unsubscribe.`
  );
}
