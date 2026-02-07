// Murray's FSM - Healthcheck Edge Function
// =========================================
// Simple health check endpoint for monitoring

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Test database connection
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { error } = await supabase.from('profiles').select('id').limit(1)

    const health = {
      status: error ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      checks: {
        database: error ? 'error' : 'ok',
        stripe: Deno.env.get('STRIPE_SECRET_KEY') ? 'configured' : 'not_configured',
      },
    }

    return new Response(
      JSON.stringify(health),
      {
        status: health.status === 'healthy' ? 200 : 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
