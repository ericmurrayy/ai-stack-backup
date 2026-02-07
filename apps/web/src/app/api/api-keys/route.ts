// Murray's FSM - API Keys Management
// ===================================
// Create and manage API keys

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  generateApiKey,
  API_SCOPE_DESCRIPTIONS,
  SCOPE_CATEGORIES,
  API_KEY_PRESETS,
  type ApiKeyScope,
} from '@murray-fsm/services';

// GET /api/api-keys - List all API keys
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: keys, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, scopes, created_at, expires_at, last_used_at, is_active, rate_limit_per_minute, allowed_ips, description')
      .eq('deleted', false)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      keys: keys || [],
      scopeDescriptions: API_SCOPE_DESCRIPTIONS,
      scopeCategories: SCOPE_CATEGORIES,
      presets: API_KEY_PRESETS,
    });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      { status: 500 }
    );
  }
}

// POST /api/api-keys - Create a new API key
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      scopes,
      description,
      expires_in_days,
      rate_limit_per_minute = 100,
      allowed_ips,
    } = body;

    // Validate name
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Validate scopes
    const validScopes = Object.keys(API_SCOPE_DESCRIPTIONS) as ApiKeyScope[];
    const invalidScopes = scopes.filter((s: string) => !validScopes.includes(s as ApiKeyScope));
    if (invalidScopes.length > 0) {
      return NextResponse.json(
        { error: `Invalid scopes: ${invalidScopes.join(', ')}` },
        { status: 400 }
      );
    }

    // Generate key
    const { key, keyPrefix, keyHash } = generateApiKey();

    // Calculate expiration
    let expires_at: string | null = null;
    if (expires_in_days && expires_in_days > 0) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + expires_in_days);
      expires_at = expDate.toISOString();
    }

    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        name,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        scopes,
        description,
        expires_at,
        rate_limit_per_minute,
        allowed_ips: allowed_ips || [],
        is_active: true,
        created_by: user.id,
        created_at: new Date().toISOString(),
      })
      .select('id, name, key_prefix, scopes, created_at, expires_at, is_active')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      apiKey: data,
      // IMPORTANT: This is the only time the full key is returned
      key,
      message: 'Store this API key securely - it will not be shown again',
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 }
    );
  }
}
