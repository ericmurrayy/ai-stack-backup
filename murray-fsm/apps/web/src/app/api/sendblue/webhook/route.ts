// Murray's FSM - Sendblue Webhook Receiver
// ==========================================
// POST /api/sendblue/webhook — receives incoming iMessages and status updates

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = await createClient();

    // Sendblue sends different webhook types
    const { accountEmail, content, number, media_url, send_style,
            is_outbound, was_downgraded, message_type, date_sent,
            date_updated, error_code, error_message, message_id,
            status, to_number, from_number } = body;

    if (is_outbound === false || message_type === 'message.received') {
      // Incoming iMessage from a customer
      const incomingPhone = number || from_number || '';
      const toPhone = to_number || '';

      // Try to match to a customer
      const { data: customers } = await supabase
        .from('customers')
        .select('id, owner_id')
        .eq('deleted', false);

      let matchedCustomerId: string | null = null;
      let matchedOwnerId: string | null = null;
      const normalizedIncoming = incomingPhone.replace(/\D/g, '');

      (customers || []).forEach((c: any) => {
        if (c.phone) {
          const normalized = c.phone.replace(/\D/g, '');
          if (normalized === normalizedIncoming || normalizedIncoming.endsWith(normalized)) {
            matchedCustomerId = c.id;
            matchedOwnerId = c.owner_id;
          }
        }
      });

      // Save incoming message
      await supabase.from('message_logs').insert({
        owner_id: matchedOwnerId || '00000000-0000-0000-0000-000000000000',
        external_message_id: message_id || `sb_in_${Date.now()}`,
        direction: 'inbound',
        from_phone: incomingPhone,
        to_phone: toPhone,
        body: content || null,
        media: media_url ? [media_url] : [],
        status: 'received',
        channel: was_downgraded ? 'sms' : 'imessage',
        received_at: date_sent || new Date().toISOString(),
        ai_extraction: {},
        customer_id: matchedCustomerId,
        raw_event: body,
      });

      return NextResponse.json({ success: true, type: 'incoming_message' });
    }

    if (message_type === 'message.status' || status) {
      // Status update for an outbound message we sent
      const msgId = message_id || body.id;

      if (msgId) {
        await supabase
          .from('message_logs')
          .update({
            status: status || 'updated',
            delivered_at: status === 'delivered' ? new Date().toISOString() : undefined,
            raw_event: body,
          })
          .eq('external_message_id', msgId);
      }

      return NextResponse.json({ success: true, type: 'status_update' });
    }

    // Unknown webhook type — log it
    console.log('Sendblue webhook - unknown type:', body);
    return NextResponse.json({ success: true, type: 'unknown' });
  } catch (error) {
    console.error('Sendblue webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 });
  }
}

// Sendblue may verify the endpoint with GET
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'murray-fsm-sendblue-webhook' });
}
