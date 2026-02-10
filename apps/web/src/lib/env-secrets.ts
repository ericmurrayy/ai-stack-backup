// Murray FSM - Runtime Secret Management
// ========================================
// Auto-generates internal secrets when not configured.
// Logs clear warnings at startup so operators know what's happening.
//
// WEBHOOK_SECRET and CRON_SECRET are internal-only (server ↔ server).
// They can be safely auto-generated per-process.
//
// BESIDE_WEBHOOK_SECRET is a shared secret (Beside ↔ our server).
// It MUST be configured manually to match the Beside dashboard.
//
// NOTE: These secrets are intentionally NOT validated in env.ts because
// they have auto-generation fallbacks. env.ts handles the hard-fail vars.

import crypto from 'crypto'

let _webhookSecret: string | null = null
let _cronSecret: string | null = null
let _besideWebhookSecret: string | null = null
let _initialized = false

function init() {
  if (_initialized) return
  _initialized = true

  // WEBHOOK_SECRET — internal service-to-service auth
  // (call-received ↔ analyze-call, beside ↔ call-received)
  if (process.env.WEBHOOK_SECRET) {
    _webhookSecret = process.env.WEBHOOK_SECRET
  } else {
    _webhookSecret = crypto.randomBytes(32).toString('hex')
    console.warn(
      '[env-secrets] WEBHOOK_SECRET not set — auto-generated for this process. ' +
      'Set WEBHOOK_SECRET in .env for stable value across restarts.'
    )
  }

  // CRON_SECRET — internal cron auth
  if (process.env.CRON_SECRET) {
    _cronSecret = process.env.CRON_SECRET
  } else {
    _cronSecret = crypto.randomBytes(32).toString('hex')
    console.warn(
      '[env-secrets] CRON_SECRET not set — auto-generated for this process. ' +
      'Set CRON_SECRET in .env to use with external cron schedulers (Vercel Cron, etc).'
    )
  }

  // BESIDE_WEBHOOK_SECRET — shared with Beside, cannot auto-generate
  if (process.env.BESIDE_WEBHOOK_SECRET) {
    _besideWebhookSecret = process.env.BESIDE_WEBHOOK_SECRET
  } else {
    _besideWebhookSecret = null
    console.warn(
      '[env-secrets] BESIDE_WEBHOOK_SECRET not set — Beside webhook endpoint will reject requests. ' +
      'Set this to the signing secret from your Beside dashboard.'
    )
  }
}

/** Internal webhook secret (auto-generated if not configured) */
export function getWebhookSecret(): string {
  init()
  return _webhookSecret!
}

/** Cron bearer token (auto-generated if not configured) */
export function getCronSecret(): string {
  init()
  return _cronSecret!
}

/** Beside HMAC secret (null if not configured — cannot auto-generate) */
export function getBesideWebhookSecret(): string | null {
  init()
  return _besideWebhookSecret
}
