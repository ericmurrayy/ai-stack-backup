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
      invoice: {
        id,
        invoice_number: 'INV-202602-0001',
        customer_name: 'John Smith',
        items: [
          { description: 'AC Repair', quantity: 1, unitPrice: 250, total: 250 },
          { description: 'Labor (2 hours)', quantity: 2, unitPrice: 85, total: 170 },
        ],
        subtotal: 420,
        tax: 34.65,
        tax_rate: 8.25,
        total: 454.65,
        status: 'sent',
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        payment_link: 'https://pay.stripe.com/demo',
        created_at: new Date().toISOString(),
      },
    });
  }

  try {
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select(`
        *,
        customer:customers(name, email, phone)
      `)
      .eq('id', id)
      .single();

    if (error || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json({
      invoice: {
        ...invoice,
        customer_name: invoice.customer?.name,
      },
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 });
  }
}
