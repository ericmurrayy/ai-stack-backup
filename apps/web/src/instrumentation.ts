/**
 * Next.js Instrumentation Hook
 * =============================
 * Runs once when the Next.js server starts.
 * Used to validate environment variables early — before any request hits.
 *
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Import env.ts to trigger validation.
    // If required vars are missing, this throws and the server won't start.
    const { env } = await import('./lib/env')

    // Log startup confirmation (structured JSON)
    const entry = {
      ts: new Date().toISOString(),
      level: 'info',
      scope: 'server:startup',
      msg: 'Environment validated',
      correlationId: 'startup',
      supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
      nodeEnv: env.NODE_ENV,
      hasAnthropicKey: !!env.ANTHROPIC_API_KEY,
      hasStripeKey: !!env.STRIPE_SECRET_KEY,
    }
    console.log(JSON.stringify(entry))
  }
}
