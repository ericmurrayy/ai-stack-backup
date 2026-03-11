// Murray's FSM - Sendblue iMessage API Route
// =============================================
// POST /api/sendblue/send — sends iMessage (blue text) via Sendblue API
// Falls back to SMS automatically if recipient isn't on iMessage

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const SENDBLUE_API_URL = 'https://api.sendblue.co/api/send-message';

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { to, content, mediaUrl, sendStyle } = body;

    if (!to || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: to, content' },
        { status: 400 }
      );
    }

    // Check for Sendblue API keys
    const apiKeyId = process.env.SENDBLUE_API_KEY_ID;
    const apiSecret = process.env.SENDBLUE_API_SECRET_KEY;
    const fromNumber = process.env.SENDBLUE_FROM_NUMBER;

    if (!apiKeyId || !apiSecret) {
      // If Sendblue isn't configured, save the message locally and return a "configure" message
      const { data: savedMsg, error: saveError } = await supabase
        .from('message_logs')
        .insert({
          owner_id: user.id,
          external_message_id: `local_${Date.now()}`,
          direction: 'outbound',
          from_phone: fromNumber || '',
          to_phone: to,
          body: content,
          media: [],
          status: 'queued',
          channel: 'imessage',
          ai_extraction: {},
        })
        .select()
        .single();

      return NextResponse.json({
        success: true,
        message: 'Message saved locally. Configure Sendblue API keys in .env.local to enable iMessage delivery.',
        needsSetup: true,
        data: savedMsg,
      });
    }

    // Send via Sendblue API
    const sendbluePayload: Record<string, unknown> = {
      number: to,
      content,
    };

    if (fromNumber) sendbluePayload.from_number = fromNumber;
    if (mediaUrl) sendbluePayload.media_url = mediaUrl;
    if (sendStyle) sendbluePayload.send_style = sendStyle;

    // Add webhook callback for status updates
    const callbackUrl = process.env.SENDBLUE_STATUS_CALLBACK;
    if (callbackUrl) {
      sendbluePayload.status_callback = callbackUrl;
    }

    const sendblueRes = await fetch(SENDBLUE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'sb-api-key-id': apiKeyId,
        'sb-api-secret-key': apiSecret,
      },
      body: JSON.stringify(sendbluePayload),
    });

    const sendblueData = await sendblueRes.json();

    if (!sendblueRes.ok) {
      console.error('Sendblue API error:', sendblueData);
      return NextResponse.json(
        { error: 'Sendblue API error', details: sendblueData },
        { status: sendblueRes.status }
      );
    }

    // Save to message_logs table
    const wasDowngraded = sendblueData.was_downgraded === true;
    const channel = wasDowngraded ? 'sms' : 'imessage';

    const { data: savedMsg, error: saveError } = await supabase
      .from('message_logs')
      .insert({
        owner_id: user.id,
        external_message_id: sendblueData.message_id || sendblueData.id || `sb_${Date.now()}`,
        direction: 'outbound',
        from_phone: fromNumber || sendblueData.from_number || '',
        to_phone: to,
        body: content,
        media: mediaUrl ? [mediaUrl] : [],
        status: sendblueData.status || 'sent',
        channel,
        sent_at: new Date().toISOString(),
        ai_extraction: {},
        raw_event: sendblueData,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save message log:', saveError);
    }

    return NextResponse.json({
      success: true,
      message: wasDowngraded
        ? 'Sent as SMS (recipient does not have iMessage)'
        : 'Sent as iMessage (blue text) ✅',
      channel,
      wasDowngraded,
      sendblueId: sendblueData.message_id || sendblueData.id,
      data: savedMsg,
    });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
