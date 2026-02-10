// Murray's FSM - Inbound Webhook Handler
// ========================================
// Receives inbound SMS/call data from Quo/OpenPhone (via n8n or direct),
// creates/updates customers and leads, and enqueues approval-gated actions.
//
// Flow: Inbound message → upsert customer → create lead → enqueue actions
// All outbound actions require approval by default.

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';

// Use service role client for webhook processing (no user session)
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Missing Supabase service role config');
  return createClient(url, key);
}

interface InboundPayload {
  // Required
  owner_id: string;
  channel: 'sms' | 'call';
  direction: 'inbound';
  from_phone: string;
  to_phone: string;

  // Optional
  body?: string;              // SMS body
  transcript?: string;        // Call transcript
  summary?: string;           // AI-generated summary
  ai_extraction?: Record<string, unknown>; // Structured AI extraction
  action_items?: unknown[];   // Parsed action items
  external_id?: string;       // Provider message/call ID
  recording_url?: string;     // Call recording URL
  duration_seconds?: number;  // Call duration
  media?: unknown[];          // MMS media
  customer_name?: string;     // If known from caller ID
  raw_event?: unknown;        // Full provider payload
}

function verifySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  try {
    const expected = createHmac('sha256', Buffer.from(secret, 'base64'))
      .update(body)
      .digest('hex');
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  // Optional signature verification
  const signingSecret = process.env.QUO_WEBHOOK_SIGNING_SECRET_BASE64;
  if (signingSecret) {
    const signature = request.headers.get('x-quo-signature') ||
                      request.headers.get('x-webhook-signature');
    if (!verifySignature(rawBody, signature, signingSecret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  let payload: InboundPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!payload.owner_id || !payload.from_phone || !payload.channel) {
    return NextResponse.json(
      { error: 'Missing required fields: owner_id, from_phone, channel' },
      { status: 400 }
    );
  }

  const supabase = getServiceClient();

  try {
    // 1. Upsert customer by phone
    const normalizedPhone = normalizePhone(payload.from_phone);
    let customerId: string | null = null;

    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id, name')
      .eq('owner_id', payload.owner_id)
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const { data: newCustomer, error: custErr } = await supabase
        .from('customers')
        .insert({
          owner_id: payload.owner_id,
          name: payload.customer_name || 'Unknown Caller',
          phone: normalizedPhone,
        })
        .select()
        .single();

      if (custErr) {
        console.error('Error creating customer:', custErr);
        return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
      }
      customerId = newCustomer.id;
    }

    // 2. Upsert comm_thread
    const { data: thread } = await supabase
      .from('comm_threads')
      .upsert(
        {
          owner_id: payload.owner_id,
          contact_phone: normalizedPhone,
          customer_id: customerId,
          external_phone_number_id: payload.to_phone,
          last_activity_at: new Date().toISOString(),
        },
        { onConflict: 'owner_id,contact_phone,external_phone_number_id' }
      )
      .select()
      .single();

    // 3. Create message or call log
    let logId: string | null = null;
    const externalId = payload.external_id || `${payload.channel}_${Date.now()}_${normalizedPhone}`;

    if (payload.channel === 'sms') {
      const { data: msg } = await supabase
        .from('message_logs')
        .upsert(
          {
            owner_id: payload.owner_id,
            external_message_id: externalId,
            thread_id: thread?.id ?? null,
            direction: 'inbound',
            from_phone: normalizedPhone,
            to_phone: payload.to_phone,
            body: payload.body ?? '',
            media: payload.media ?? [],
            ai_extraction: payload.ai_extraction ?? {},
            received_at: new Date().toISOString(),
            raw_event: payload.raw_event ?? null,
          },
          { onConflict: 'external_message_id' }
        )
        .select()
        .single();
      logId = msg?.id ?? null;
    } else {
      const { data: call } = await supabase
        .from('call_logs')
        .upsert(
          {
            owner_id: payload.owner_id,
            external_call_id: externalId,
            thread_id: thread?.id ?? null,
            direction: 'inbound',
            from_phone: normalizedPhone,
            to_phone: payload.to_phone,
            transcript: payload.transcript ?? null,
            summary: payload.summary ?? null,
            action_items: payload.action_items ?? [],
            ai_extraction: payload.ai_extraction ?? {},
            duration_seconds: payload.duration_seconds ?? null,
            recording_url: payload.recording_url ?? null,
            started_at: new Date().toISOString(),
            raw_event: payload.raw_event ?? null,
          },
          { onConflict: 'external_call_id' }
        )
        .select()
        .single();
      logId = call?.id ?? null;
    }

    // 4. Create lead
    const { data: firstStage } = await supabase
      .from('pipeline_stages')
      .select('id')
      .eq('owner_id', payload.owner_id)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    const issueSummary = payload.summary
      || payload.body
      || (payload.ai_extraction as Record<string, unknown>)?.issue
      || 'Inbound inquiry';

    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .insert({
        owner_id: payload.owner_id,
        customer_id: customerId,
        stage_id: firstStage?.id ?? null,
        title: `${payload.channel === 'sms' ? 'Text' : 'Call'} from ${payload.customer_name || normalizedPhone}`,
        description: payload.body || payload.transcript || null,
        issue_summary: issueSummary,
        source: 'phone',
        inbound_channel: payload.channel,
      })
      .select()
      .single();

    if (leadErr) {
      console.error('Error creating lead:', leadErr);
    }

    // 5. Enqueue approval-gated actions based on AI extraction
    const actions: Array<{ kind: string; payload: Record<string, unknown> }> = [];

    const extraction = payload.ai_extraction as Record<string, unknown> | undefined;

    if (extraction?.wants_appointment || extraction?.schedule_request) {
      actions.push({
        kind: 'propose_booking_times',
        payload: {
          customer_id: customerId,
          customer_phone: normalizedPhone,
          issue: issueSummary,
          preferred_times: extraction.preferred_times ?? [],
          urgency: extraction.urgency ?? 'normal',
        },
      });
    } else {
      // Default: suggest responding to the inquiry
      actions.push({
        kind: 'send_sms',
        payload: {
          to_phone: normalizedPhone,
          customer_id: customerId,
          message: `Thanks for reaching out! I'll get back to you shortly about: ${typeof issueSummary === 'string' ? issueSummary.substring(0, 100) : 'your inquiry'}`,
          context: 'auto_reply_inbound',
        },
      });
    }

    const enqueuedActions = [];
    for (const a of actions) {
      const idempotencyKey = `${a.kind}:${payload.channel}:${externalId}`;

      const { data: existing } = await supabase
        .from('action_queue')
        .select('id')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (!existing) {
        const { data: queued } = await supabase
          .from('action_queue')
          .insert({
            owner_id: payload.owner_id,
            kind: a.kind,
            payload: a.payload,
            source_type: `${payload.channel}_inbound`,
            source_id: externalId,
            requires_approval: true,
            lead_id: lead?.id ?? null,
            idempotency_key: idempotencyKey,
            status: 'pending',
            result: {},
            retry_count: 0,
            max_retries: 3,
          })
          .select()
          .single();

        if (queued) enqueuedActions.push(queued);
      }
    }

    // 6. Audit
    await supabase.from('audit_log').insert({
      owner_id: payload.owner_id,
      actor: 'system',
      action: 'inbound_received',
      entity_type: 'lead',
      entity_id: lead?.id ?? null,
      diff: {
        channel: payload.channel,
        from: normalizedPhone,
        customer_id: customerId,
        actions_enqueued: enqueuedActions.length,
      },
    });

    return NextResponse.json({
      success: true,
      customer_id: customerId,
      lead_id: lead?.id ?? null,
      log_id: logId,
      actions_enqueued: enqueuedActions.length,
    });
  } catch (error) {
    console.error('Inbound webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) return '+1' + cleaned;
  if (cleaned.length === 11 && cleaned.startsWith('1')) return '+' + cleaned;
  if (cleaned.length > 10 && !phone.startsWith('+')) return '+' + cleaned;
  return phone;
}
