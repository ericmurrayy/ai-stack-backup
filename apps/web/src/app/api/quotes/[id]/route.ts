import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!supabase) {
    // Return mock data for demo
    return NextResponse.json({
      quote: {
        id,
        quote_number: 'QT-202602-0001',
        customer_name: 'Jane Doe',
        items: [
          { description: 'AC Tune-Up', quantity: 1, unitPrice: 129, total: 129, category: 'HVAC' },
          { description: 'Service Call', quantity: 1, unitPrice: 89, total: 89, category: 'General' },
        ],
        subtotal: 218,
        tax: 17.99,
        tax_rate: 8.25,
        total: 235.99,
        status: 'sent',
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        job_description: 'Annual AC maintenance and inspection',
        ai_generated: true,
        created_at: new Date().toISOString(),
      },
    });
  }

  try {
    const { data: quote, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    return NextResponse.json({ quote });
  } catch (error) {
    console.error('Error fetching quote:', error);
    return NextResponse.json({ error: 'Failed to fetch quote' }, { status: 500 });
  }
}
