import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Sign in
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 401 });
    }

    // Test fetching data with auth
    const results: Record<string, unknown> = {
      auth: {
        success: true,
        user: authData.user?.email,
        session: !!authData.session,
      },
      tests: {},
    };

    // Test profile fetch
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user?.id)
      .single();

    results.tests = {
      ...results.tests as object,
      profile: profileError ? { error: profileError.message } : { success: true, data: profile },
    };

    // Test jobs fetch (should be empty but work)
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('*')
      .limit(10);

    results.tests = {
      ...results.tests as object,
      jobs: jobsError ? { error: jobsError.message } : { success: true, count: jobs?.length || 0 },
    };

    // Test customers fetch
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('*')
      .limit(10);

    results.tests = {
      ...results.tests as object,
      customers: customersError ? { error: customersError.message } : { success: true, count: customers?.length || 0 },
    };

    // Test inventory fetch
    const { data: inventory, error: inventoryError } = await supabase
      .from('inventory_items')
      .select('*')
      .limit(10);

    results.tests = {
      ...results.tests as object,
      inventory: inventoryError ? { error: inventoryError.message } : { success: true, count: inventory?.length || 0 },
    };

    // Sign out
    await supabase.auth.signOut();

    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
