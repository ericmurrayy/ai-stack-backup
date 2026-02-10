/**
 * Environment Validation Tests
 * ============================
 * Verifies the Zod env schema rejects bad values and accepts good ones.
 * Does NOT import env.ts directly (that would crash on missing vars).
 * Instead, tests the schema export against mock process.env objects.
 */

import { describe, it, expect } from 'vitest'
import { envSchema } from '../lib/env-schema'

const validEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://abc123.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
  SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service',
  DEFAULT_OWNER_ID: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  NODE_ENV: 'development',
}

describe('envSchema', () => {
  it('accepts valid required env vars', () => {
    const result = envSchema.safeParse(validEnv)
    expect(result.success).toBe(true)
  })

  it('rejects missing NEXT_PUBLIC_SUPABASE_URL', () => {
    const { NEXT_PUBLIC_SUPABASE_URL, ...rest } = validEnv
    const result = envSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects empty NEXT_PUBLIC_SUPABASE_URL', () => {
    const result = envSchema.safeParse({ ...validEnv, NEXT_PUBLIC_SUPABASE_URL: '' })
    expect(result.success).toBe(false)
  })

  it('rejects placeholder values (your-...)', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'your-anon-key',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid URL for NEXT_PUBLIC_SUPABASE_URL', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'not-a-url',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing SUPABASE_SERVICE_ROLE_KEY', () => {
    const { SUPABASE_SERVICE_ROLE_KEY, ...rest } = validEnv
    const result = envSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects missing DEFAULT_OWNER_ID', () => {
    const { DEFAULT_OWNER_ID, ...rest } = validEnv
    const result = envSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('allows optional vars to be absent', () => {
    // Only required vars — all optional should be fine
    const result = envSchema.safeParse(validEnv)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.ANTHROPIC_API_KEY).toBeUndefined()
      expect(result.data.STRIPE_SECRET_KEY).toBeUndefined()
    }
  })

  it('transforms empty optional strings to undefined', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      ANTHROPIC_API_KEY: '',
      STRIPE_SECRET_KEY: '',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.ANTHROPIC_API_KEY).toBeUndefined()
      expect(result.data.STRIPE_SECRET_KEY).toBeUndefined()
    }
  })

  it('transforms AUTO_SEND_INVOICE string to boolean', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      AUTO_SEND_INVOICE: 'true',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.AUTO_SEND_INVOICE).toBe(true)
    }
  })

  it('defaults NODE_ENV to development', () => {
    const { NODE_ENV, ...rest } = validEnv
    const result = envSchema.safeParse(rest)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.NODE_ENV).toBe('development')
    }
  })

  it('defaults NEXT_PUBLIC_SITE_URL to localhost', () => {
    const result = envSchema.safeParse(validEnv)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.NEXT_PUBLIC_SITE_URL).toBe('http://localhost:3000')
    }
  })

  it('rejects invalid optional URL', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      N8N_APPROVAL_EXECUTOR_WEBHOOK_URL: 'not-a-url',
    })
    expect(result.success).toBe(false)
  })

  it('accepts full env with all optional vars', () => {
    const fullEnv = {
      ...validEnv,
      NEXT_PUBLIC_SITE_URL: 'https://app.murrayfsm.com',
      ANTHROPIC_API_KEY: 'sk-ant-api03-test',
      OPENAI_API_KEY: 'sk-test',
      STRIPE_SECRET_KEY: 'sk_test_abc',
      STRIPE_WEBHOOK_SECRET: 'whsec_abc',
      OPENPHONE_API_KEY: 'op_key',
      N8N_APPROVAL_EXECUTOR_WEBHOOK_URL: 'https://n8n.example.com/webhook/test',
      BUSINESS_NAME: "Murray's Garage Door Service",
      BUSINESS_PHONE: '978-758-0690',
      AUTO_SEND_INVOICE: 'true',
      AUTO_SEND_REVIEW: 'false',
    }
    const result = envSchema.safeParse(fullEnv)
    expect(result.success).toBe(true)
  })
})
