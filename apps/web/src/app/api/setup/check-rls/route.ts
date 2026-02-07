import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const results: Record<string, unknown> = {};

    // Check each table with service role (bypasses RLS)
    const tables = ['profiles', 'customers', 'locations', 'jobs', 'job_events', 'line_items', 'photos', 'signatures', 'inventory_items', 'technicians'];

    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('count').limit(1);
      results[table] = error ? { error: error.message } : { exists: true, accessible: true };
    }

    // Check RLS policies
    const { data: policies, error: policiesError } = await supabase.rpc('get_policies_info').select('*');

    if (policiesError) {
      // RPC might not exist, try direct query info
      results.rlsNote = 'Could not check RLS policies directly. Tables may need RLS policies enabled.';
    } else {
      results.policies = policies;
    }

    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
