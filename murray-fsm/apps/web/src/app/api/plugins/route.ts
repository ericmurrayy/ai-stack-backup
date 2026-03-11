// Murray's FSM - Plugins API
// ==========================
// List and manage plugin integrations

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { pluginRegistry, type InstalledPlugin } from '@murray-fsm/services';

// GET /api/plugins - List all available plugins
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all available plugins
    const availablePlugins = pluginRegistry.getAll().map(plugin => ({
      id: plugin.id,
      name: plugin.name,
      description: plugin.description,
      category: plugin.category,
      version: plugin.version,
      author: plugin.author,
      website: plugin.website,
      documentationUrl: plugin.documentationUrl,
      icon: plugin.icon,
      fields: plugin.fields.map(f => ({
        name: f.name,
        label: f.label,
        type: f.type,
        required: f.required,
        description: f.description,
        options: f.options,
        default: f.default,
      })),
      webhookEvents: plugin.webhookEvents,
    }));

    // Get installed plugins for this user
    const { data: installed } = await supabase
      .from('installed_plugins')
      .select('*')
      .eq('owner_id', user.id)
      .eq('deleted', false);

    const installedMap = new Map(
      (installed || []).map(p => [p.plugin_id, p])
    );

    // Merge available and installed status
    const plugins = availablePlugins.map(plugin => ({
      ...plugin,
      installed: installedMap.has(plugin.id),
      enabled: installedMap.get(plugin.id)?.enabled ?? false,
      installedAt: installedMap.get(plugin.id)?.installed_at,
    }));

    return NextResponse.json({ plugins });
  } catch (error) {
    console.error('Error fetching plugins:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plugins' },
      { status: 500 }
    );
  }
}

// POST /api/plugins - Install a plugin
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { pluginId, config } = body;

    // Validate plugin exists
    const plugin = pluginRegistry.get(pluginId);
    if (!plugin) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }

    // Validate configuration
    const validation = await pluginRegistry.validateConfig(pluginId, config || {});
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid configuration', details: validation.errors },
        { status: 400 }
      );
    }

    // Test connection if available
    const connectionTest = await pluginRegistry.testConnection(pluginId, config || {});
    if (!connectionTest.success) {
      return NextResponse.json(
        { error: 'Connection test failed', message: connectionTest.message },
        { status: 400 }
      );
    }

    // Save to database
    const { data, error } = await supabase
      .from('installed_plugins')
      .upsert({
        owner_id: user.id,
        plugin_id: pluginId,
        enabled: true,
        config: config || {},
        installed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      plugin: data,
      message: `${plugin.name} installed successfully`,
    });
  } catch (error) {
    console.error('Error installing plugin:', error);
    return NextResponse.json(
      { error: 'Failed to install plugin' },
      { status: 500 }
    );
  }
}
