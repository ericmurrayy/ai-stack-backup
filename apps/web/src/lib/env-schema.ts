/**
 * Environment Variable Schema
 * ============================
 * Zod schema for all env vars used across the web app.
 * Separated from env.ts so tests can import the schema without
 * triggering eager validation (which crashes without real env vars).
 *
 * Categories:
 * - REQUIRED: Server won't start without these
 * - OPTIONAL: Features degrade gracefully when missing
 * - AUTO: Generated at runtime if not set (see env-secrets.ts)
 */

import { z } from 'zod'

// Helper: non-empty string (rejects '' and placeholder values)
const requiredString = z
  .string()
  .min(1, 'Must not be empty')
  .refine((s) => !s.startsWith('your-'), {
    message: 'Still set to placeholder value (your-...)',
  })

// Helper: URL string (validate URL format, then check non-empty/non-placeholder)
const requiredUrl = z
  .string()
  .min(1, 'Must not be empty')
  .url('Must be a valid URL')
  .refine((s) => !s.startsWith('your-'), {
    message: 'Still set to placeholder value (your-...)',
  })

// Helper: optional string (empty string → undefined)
const optionalString = z
  .string()
  .optional()
  .transform((s) => (s === '' ? undefined : s))

// Helper: optional URL (empty string → undefined, non-empty must be valid URL)
const optionalUrl = z
  .string()
  .optional()
  .transform((s) => (s === '' ? undefined : s))
  .pipe(z.string().url().optional())

// Helper: optional boolean from string
const optionalBool = z
  .string()
  .optional()
  .transform((s) => s === 'true')

export const envSchema = z.object({
  // ── REQUIRED: Supabase ──────────────────────────────────────────────
  NEXT_PUBLIC_SUPABASE_URL: requiredUrl.describe('Supabase project URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: requiredString.describe('Supabase anon/public key'),
  SUPABASE_SERVICE_ROLE_KEY: requiredString.describe('Supabase service role key (server-side only)'),

  // ── REQUIRED: Owner ─────────────────────────────────────────────────
  DEFAULT_OWNER_ID: requiredString.describe('Supabase user UUID for webhook-created records'),

  // ── OPTIONAL: Site ──────────────────────────────────────────────────
  NEXT_PUBLIC_SITE_URL: optionalUrl.default('http://localhost:3000'),
  NEXT_PUBLIC_APP_URL: optionalUrl,
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // ── OPTIONAL: AI ────────────────────────────────────────────────────
  ANTHROPIC_API_KEY: optionalString.describe('Claude API key for call analysis'),
  OPENAI_API_KEY: optionalString.describe('OpenAI key for embeddings'),
  NEXT_PUBLIC_OLLAMA_URL: optionalUrl,

  // ── OPTIONAL: Payments ──────────────────────────────────────────────
  STRIPE_SECRET_KEY: optionalString.describe('Stripe secret key'),
  STRIPE_WEBHOOK_SECRET: optionalString.describe('Stripe webhook signing secret'),

  // ── OPTIONAL: Phone / Retell ────────────────────────────────────────
  OPENPHONE_API_KEY: optionalString.describe('OpenPhone API key'),
  RETELL_AGENT_ID: optionalString,
  RETELL_WEBHOOK_SECRET: optionalString,

  // ── OPTIONAL: Webhooks & Integrations ───────────────────────────────
  N8N_APPROVAL_EXECUTOR_WEBHOOK_URL: optionalUrl.describe('n8n webhook for approved actions'),
  ZAPIER_WEBHOOK_SECRET: optionalString,
  ZAPIER_OUTGOING_WEBHOOK_URL: optionalUrl,

  // ── OPTIONAL: Job Completion Hooks ──────────────────────────────────
  INTERNAL_WEBHOOK_SECRET: optionalString,
  AUTO_SEND_INVOICE: optionalBool,
  AUTO_SEND_REVIEW: optionalBool,

  // ── OPTIONAL: Business Info (PDF invoices) ──────────────────────────
  BUSINESS_NAME: optionalString,
  BUSINESS_ADDRESS1: optionalString,
  BUSINESS_CITY: optionalString,
  BUSINESS_STATE: optionalString,
  BUSINESS_ZIP: optionalString,
  BUSINESS_PHONE: optionalString,
  BUSINESS_EMAIL: optionalString,

  // ── OPTIONAL: Pricing defaults ──────────────────────────────────────
  DEFAULT_LABOR_RATE: optionalString,
  DEFAULT_TAX_RATE: optionalString,

  // ── AUTO-GENERATED (see env-secrets.ts) ─────────────────────────────
  // These are intentionally not validated here — env-secrets.ts handles them
  // WEBHOOK_SECRET, CRON_SECRET, BESIDE_WEBHOOK_SECRET
})

export type Env = z.infer<typeof envSchema>
