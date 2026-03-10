// Murray's FSM - Individual API Key Management
// ============================================
// Update, revoke, and delete API keys

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { API_SCOPE_DESCRIPTIONS, type ApiKeyScope } from '@murray-fsm/services';

// GET /api/api-keys/[keyId] - Get API key details and usage
export async function GET(
  request: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get API key (scoped to current user)
    const { data: apiKey, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, scopes, created_at, expires_at, last_used_at, is_active, rate_limit_per_minute, allowed_ips, description')
      .eq('id', params.keyId)
      .eq('owner_id', user.id)
      .eq('deleted', false)
      .single();

    if (error || !apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    // Get recent usage
    const { data: usage } = await supabase
      .from('api_key_usage')
      .select('*')
      .eq('api_key_id', params.keyId)
      .order('created_at', { ascending: false })
      .limit(100);

    // Get usage stats (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentUsage } = await supabase
      .from('api_key_usage')
      .select('status_code')
      .eq('api_key_id', params.keyId)
      .gte('created_at', twentyFourHoursAgo);

    const stats = {
      totalRequests24h: recentUsage?.length || 0,
      successRate24h: recentUsage?.length
        ? Math.round((recentUsage.filter(u => u.status_code < 400).length / recentUsage.length) * 100)
        : 0,
    };

    return NextResponse.json({
      apiKey,
      usage: usage || [],
      stats,
    });
  } catch (error) {
    console.error('Error fetching API key:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API key' },
      { status: 500 }
    );
  }
}

// PATCH /api/api-keys/[keyId] - Update API key
export async function PATCH(
  request: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, scopes, description, is_active, rate_limit_per_minute, allowed_ips } = body;

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (is_active !== undefined) updates.is_active = is_active;
    if (rate_limit_per_minute !== undefined) updates.rate_limit_per_minute = rate_limit_per_minute;
    if (allowed_ips !== undefined) updates.allowed_ips = allowed_ips;

    if (scopes !== undefined) {
      const validScopes = Object.keys(API_SCOPE_DESCRIPTIONS) as ApiKeyScope[];
      const invalidScopes = scopes.filter((s: string) => !validScopes.includes(s as ApiKeyScope));
      if (invalidScopes.length > 0) {
        return NextResponse.json(
          { error: `Invalid scopes: ${invalidScopes.join(', ')}` },
          { status: 400 }
        );
      }
      updates.scopes = scopes;
    }

    const { data, error } = await supabase
      .from('api_keys')
      .update(updates)
      .eq('id', params.keyId)
      .eq('owner_id', user.id)
      .eq('deleted', false)
      .select('id, name, key_prefix, scopes, is_active')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      apiKey: data,
    });
  } catch (error) {
    console.error('Error updating API key:', error);
    return NextResponse.json(
      { error: 'Failed to update API key' },
      { status: 500 }
    );
  }
}

// DELETE /api/api-keys/[keyId] - Revoke/delete API key
export async function DELETE(
  request: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('api_keys')
      .update({
        deleted: true,
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.keyId)
      .eq('owner_id', user.id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'API key revoked',
    });
  } catch (error) {
    console.error('Error deleting API key:', error);
    return NextResponse.json(
      { error: 'Failed to delete API key' },
      { status: 500 }
    );
  }
}
