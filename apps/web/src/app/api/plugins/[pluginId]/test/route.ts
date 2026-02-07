// Murray's FSM - Plugin Connection Test API
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { pluginRegistry } from '@murray-fsm/services';

// POST /api/plugins/[pluginId]/test - Test plugin connection
export async function POST(
  request: NextRequest,
  { params }: { params: { pluginId: string } }
) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { config } = body;

    const plugin = pluginRegistry.get(params.pluginId);
    if (!plugin) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }

    // Test connection
    const result = await pluginRegistry.testConnection(params.pluginId, config || {});

    return NextResponse.json({
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    console.error('Error testing plugin:', error);
    return NextResponse.json(
      { error: 'Connection test failed' },
      { status: 500 }
    );
  }
}
