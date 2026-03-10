// Murray's FSM - Plugin Management API
// =====================================
// Update, toggle, and uninstall plugins

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { pluginRegistry } from '@murray-fsm/services';

// GET /api/plugins/[pluginId] - Get plugin details and config
export async function GET(
  request: NextRequest,
  { params }: { params: { pluginId: string } }
) {
  try {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const plugin = pluginRegistry.get(params.pluginId);
    if (!plugin) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }

    // Get installed config (scoped to owner)
    const { data: installed } = await supabase
      .from('installed_plugins')
      .select('*')
      .eq('plugin_id', params.pluginId)
      .eq('owner_id', user.id)
      .eq('deleted', false)
      .single();

    return NextResponse.json({
      plugin: {
        id: plugin.id,
        name: plugin.name,
        description: plugin.description,
        category: plugin.category,
        version: plugin.version,
        fields: plugin.fields,
        webhookEvents: plugin.webhookEvents,
      },
      installed: !!installed,
      enabled: installed?.enabled ?? false,
      config: installed?.config ?? {},
      installedAt: installed?.installed_at,
    });
  } catch (error) {
    console.error('Error fetching plugin:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plugin' },
      { status: 500 }
    );
  }
}

// PATCH /api/plugins/[pluginId] - Update plugin config or toggle
export async function PATCH(
  request: NextRequest,
  { params }: { params: { pluginId: string } }
) {
  try {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { config, enabled } = body;

    const plugin = pluginRegistry.get(params.pluginId);
    if (!plugin) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }

    // If updating config, validate it
    if (config !== undefined) {
      const validation = await pluginRegistry.validateConfig(params.pluginId, config);
      if (!validation.valid) {
        return NextResponse.json(
          { error: 'Invalid configuration', details: validation.errors },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (config !== undefined) updates.config = config;
    if (enabled !== undefined) updates.enabled = enabled;

    const { data, error } = await supabase
      .from('installed_plugins')
      .update(updates)
      .eq('plugin_id', params.pluginId)
      .eq('owner_id', user.id)
      .eq('deleted', false)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      plugin: data,
    });
  } catch (error) {
    console.error('Error updating plugin:', error);
    return NextResponse.json(
      { error: 'Failed to update plugin' },
      { status: 500 }
    );
  }
}

// DELETE /api/plugins/[pluginId] - Uninstall plugin
export async function DELETE(
  request: NextRequest,
  { params }: { params: { pluginId: string } }
) {
  try {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('installed_plugins')
      .update({ deleted: true, updated_at: new Date().toISOString() })
      .eq('plugin_id', params.pluginId)
      .eq('owner_id', user.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Plugin uninstalled',
    });
  } catch (error) {
    console.error('Error uninstalling plugin:', error);
    return NextResponse.json(
      { error: 'Failed to uninstall plugin' },
      { status: 500 }
    );
  }
}
