/**
 * Send Invoice API Route
 * ======================
 * Send invoice to customer via email/SMS/WhatsApp
 */

import { NextRequest, NextResponse } from 'next/server';
import { invoicingService } from '@packages/services/invoicing';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * POST /api/invoices/send
 * Send invoice to customer
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { invoiceId, channels, message } = body;

    if (!invoiceId) {
      return NextResponse.json(
        { error: 'invoiceId is required' },
        { status: 400 }
      );
    }

    if (!channels || !Array.isArray(channels) || channels.length === 0) {
      return NextResponse.json(
        { error: 'channels array is required (email, sms, whatsapp)' },
        { status: 400 }
      );
    }

    const result = await invoicingService.sendInvoice({
      invoiceId,
      channels,
      message,
    });

    return NextResponse.json({
      success: result.success,
      sentVia: result.sentVia,
      message: result.success
        ? `Invoice sent via ${result.sentVia.join(', ')}`
        : 'Failed to send invoice',
    });
  } catch (error: any) {
    console.error('Send invoice error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send invoice' },
      { status: 500 }
    );
  }
}
