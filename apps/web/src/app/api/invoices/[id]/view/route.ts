import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!supabase) {
    return NextResponse.json({ success: true });
  }

  try {
    await supabase
      .from('invoices')
      .update({
        status: 'viewed',
        viewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'sent'); // Only update if currently 'sent'

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking invoice as viewed:', error);
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
  }
}
