import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: Request) {
  try {
    const { email, password, fullName, companyName } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    // Use service role to create user without email confirmation
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Create user with admin API
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName || 'Test User',
        company_name: companyName || 'Test Company',
      },
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    if (userData.user) {
      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userData.user.id,
          owner_id: userData.user.id,
          full_name: fullName || 'Test User',
          company_name: companyName || 'Test Company',
        });

      if (profileError) {
        console.error('Profile error:', profileError);
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: userData.user?.id,
        email: userData.user?.email,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
