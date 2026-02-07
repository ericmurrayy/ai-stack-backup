/**
 * Messaging API Route
 * ===================
 * Send messages via Clawdbot (WhatsApp, Telegram, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { jarvisBridge } from '@packages/services/jarvis-bridge';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface SendMessageRequest {
  channel: 'whatsapp' | 'telegram' | 'sms';
  to: string; // Phone number or chat ID
  message: string;
  customerId?: string;
  jobId?: string;
}

export async function GET(req: NextRequest) {
  try {
    const gatewayStatus = await jarvisBridge.getGatewayStatus();
    return NextResponse.json({
      gateway: gatewayStatus,
      channels: ['whatsapp', 'telegram'],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to get messaging status' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: SendMessageRequest = await req.json();
    const { channel, to, message, customerId, jobId } = body;

    if (!channel || !to || !message) {
      return NextResponse.json(
        { error: 'channel, to, and message are required' },
        { status: 400 }
      );
    }

    let result;

    switch (channel) {
      case 'whatsapp':
        result = await jarvisBridge.sendWhatsApp(to, message);
        break;

      case 'telegram':
        result = await jarvisBridge.sendTelegram(to, message);
        break;

      case 'sms':
        // SMS would use a different service (Twilio, etc.)
        // For now, try WhatsApp as fallback
        result = await jarvisBridge.sendWhatsApp(to, message);
        break;

      default:
        return NextResponse.json(
          { error: `Unknown channel: ${channel}` },
          { status: 400 }
        );
    }

    // Log message to database
    if (result.success) {
      try {
        await supabase.from('message_logs').insert({
          owner_id: user.id,
          customer_id: customerId || null,
          job_id: jobId || null,
          direction: 'outbound',
          channel: channel,
          to_phone: to,
          body: message,
          external_message_id: result.messageId,
          status: 'sent',
        });
      } catch (logError) {
        console.error('Failed to log message:', logError);
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Send message error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send message' },
      { status: 500 }
    );
  }
}
