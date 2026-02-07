// Murray's FSM - Migration API
// Run database migrations

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = createAdminClient();

    // Create call_logs table
    const { error: callLogsError } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$ BEGIN
          CREATE TYPE call_direction AS ENUM ('inbound', 'outbound');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;

        CREATE TABLE IF NOT EXISTS call_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          owner_id UUID NOT NULL,
          external_call_id TEXT UNIQUE NOT NULL,
          direction call_direction NOT NULL,
          from_phone TEXT NOT NULL,
          to_phone TEXT NOT NULL,
          duration_seconds INTEGER,
          started_at TIMESTAMPTZ,
          ended_at TIMESTAMPTZ,
          answered_at TIMESTAMPTZ,
          recording_url TEXT,
          transcript TEXT,
          summary TEXT,
          action_items JSONB DEFAULT '[]'::jsonb,
          raw_event JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          deleted BOOLEAN DEFAULT FALSE
        );
      `
    });

    if (callLogsError) {
      // Try direct table creation approach
      console.log('RPC not available, tables may need to be created via Supabase Dashboard');
    }

    return NextResponse.json({
      success: true,
      message: 'Migration attempted. Please verify tables in Supabase Dashboard.',
      instructions: 'Run the SQL in supabase/add-communication-tables.sql in the Supabase SQL Editor'
    });

  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint to run migrations',
    sql_file: 'supabase/add-communication-tables.sql'
  });
}
