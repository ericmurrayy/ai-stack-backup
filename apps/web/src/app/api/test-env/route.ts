// SECURITY: This route is disabled in production
// It previously leaked environment variable names
import { NextResponse } from 'next/server'

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    status: 'development',
    supabase: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'configured' : 'missing',
    anthropic: process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing',
    stripe: process.env.STRIPE_SECRET_KEY ? 'configured' : 'missing',
    openphone: process.env.OPENPHONE_API_KEY ? 'configured' : 'missing',
  })
}
