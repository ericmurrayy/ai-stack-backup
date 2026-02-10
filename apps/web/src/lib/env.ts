/**
 * Environment Variable Validation (Eager)
 * ========================================
 * Imports the Zod schema from env-schema.ts and validates process.env
 * on first import. Server crashes immediately if required vars are missing.
 *
 * Usage:
 *   import { env } from '@/lib/env'
 *   env.NEXT_PUBLIC_SUPABASE_URL  // typed, validated, safe
 *
 * For tests, import { envSchema } from '@/lib/env-schema' instead
 * to avoid triggering eager validation.
 */

import { envSchema, type Env } from './env-schema'

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const formatted = result.error.issues.map(
      (issue) => `  ${issue.path.join('.')}: ${issue.message}`
    )

    console.error(
      '\n' +
      '╔══════════════════════════════════════════════════╗\n' +
      '║  ENVIRONMENT VALIDATION FAILED                  ║\n' +
      '╠══════════════════════════════════════════════════╣\n' +
      formatted.join('\n') + '\n' +
      '╚══════════════════════════════════════════════════╝\n' +
      '\nCopy .env.example → .env and fill in required values.\n' +
      'See: apps/web/.env.example\n'
    )

    throw new Error(
      `Missing or invalid environment variables:\n${formatted.join('\n')}`
    )
  }

  return result.data
}

/**
 * Validated environment variables.
 * Crashes at import time if required vars are missing.
 */
export const env = validateEnv()

// Re-export schema and type for convenience
export { envSchema } from './env-schema'
export type { Env } from './env-schema'
