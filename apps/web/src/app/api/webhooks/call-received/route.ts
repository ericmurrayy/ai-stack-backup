/**
 * Inbound Call Webhook Handler
 * ============================
 * Receives call completion events from phone providers (OpenPhone/Beside)
 * and triggers AI analysis → job creation pipeline.
 *
 * Flow:
 * 1. Phone provider sends webhook when call ends
 * 2. We store the call record in Supabase
 * 3. If transcript available, trigger AI analysis
 * 4. AI analysis creates job suggestion automatically
 *
 * Supports: OpenPhone, Beside (Quo), and generic webhook format
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimitConfigs, getClientIdentifier, getRateLimitHeaders } from '@/lib/rate-limit';
import { getWebhookSecret } from '@/lib/env-secrets';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow time for AI analysis

/**
 * Verify webhook request authenticity.
 * Accepts HMAC-SHA256 signature (x-webhook-signature header)
 * or a shared secret (x-webhook-secret header).
 * Internal requests from Beside handler are trusted via x-internal-token.
 */
function verifyWebhookAuth(rawBody: string, headers: Headers): boolean {
  const secret = getWebhookSecret()

  // Trust internal forwards from /api/webhooks/beside (already HMAC-verified there)
  const internalToken = headers.get('x-internal-token');
  if (internalToken) {
    try {
      return crypto.timingSafeEqual(Buffer.from(internalToken), Buffer.from(secret));
    } catch {
      return false;
    }
  }

  // HMAC signature verification
  const signature = headers.get('x-webhook-signature');
  if (signature) {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  // Shared secret header verification
  const sharedSecret = headers.get('x-webhook-secret');
  if (sharedSecret) {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(sharedSecret),
        Buffer.from(secret)
      );
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * POST /api/webhooks/call-received
 * Handle inbound call webhook from phone provider
 */
export async function POST(req: NextRequest) {
  // Rate limiting — prevent abuse
  const clientId = getClientIdentifier(req);
  const rateLimit = checkRateLimit(`webhook:call:${clientId}`, rateLimitConfigs.webhook);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: getRateLimitHeaders(rateLimit) }
    );
  }

  const supabase = createAdminClient();

  try {
    const rawBody = await req.text();

    // Verify webhook authenticity
    if (!verifyWebhookAuth(rawBody, req.headers)) {
      console.warn('[Call Webhook] Auth failed — rejecting');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload: Record<string, any>;

    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Detect provider and normalize the data
    const callData = normalizeCallData(payload, req.headers);

    console.log(
      `[Call Webhook] Provider: ${callData.provider}, From: ${callData.from_number}, Duration: ${callData.duration}s`
    );

    // Skip very short calls (likely missed/spam)
    if (callData.duration < 5 && !callData.transcript) {
      console.log('[Call Webhook] Skipping short call with no transcript');
      return NextResponse.json({ received: true, skipped: true, reason: 'too_short' });
    }

    // Require a provider call ID for idempotency (UNIQUE constraint on external_call_id)
    if (!callData.provider_call_id) {
      console.warn('[Call Webhook] No provider_call_id — rejecting to prevent duplicates');
      return NextResponse.json(
        { error: 'Missing provider call ID', code: 'MISSING_CALL_ID' },
        { status: 400 }
      );
    }

    // Validate DEFAULT_OWNER_ID
    const ownerId = process.env.DEFAULT_OWNER_ID;
    if (!ownerId) {
      console.error('[Call Webhook] DEFAULT_OWNER_ID not configured');
      return NextResponse.json(
        { error: 'Server misconfigured' },
        { status: 500 }
      );
    }

    // Store the call record in call_logs table (matches schema.sql)
    // external_call_id UNIQUE constraint prevents duplicate processing
    const { data: call, error: callError } = await supabase
      .from('call_logs')
      .insert({
        owner_id: ownerId,
        external_call_id: callData.provider_call_id,
        direction: callData.direction,
        from_phone: callData.from_number,
        to_phone: callData.to_number,
        duration_seconds: callData.duration,
        started_at: callData.started_at || new Date().toISOString(),
        transcript: callData.transcript || null,
        recording_url: callData.recording_url || null,
        raw_event: { ...payload, _provider: callData.provider },
      })
      .select('id')
      .single();

    if (callError) {
      // Handle duplicate webhook delivery gracefully (UNIQUE constraint on external_call_id)
      if (callError.code === '23505') {
        console.log(`[Call Webhook] Duplicate webhook for ${callData.provider_call_id} — ignoring`);
        return NextResponse.json({ received: true, duplicate: true });
      }

      console.error('[Call Webhook] Failed to store call:', callError);
      return NextResponse.json(
        { error: 'Failed to store call record' },
        { status: 500 }
      );
    }

    console.log(`[Call Webhook] Call stored: ${call.id}`);

    // If we have a transcript, trigger AI analysis immediately
    if (callData.transcript && callData.transcript.length >= 10) {
      try {
        const analysisUrl = new URL('/api/ai/analyze-call', req.url);
        const analysisResponse = await fetch(analysisUrl.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-token': getWebhookSecret(),
          },
          body: JSON.stringify({
            transcript: callData.transcript,
            call_id: call.id,
            phone_number: callData.from_number,
            caller_name: callData.caller_name || null,
          }),
        });

        if (analysisResponse.ok) {
          const analysisResult = await analysisResponse.json();
          console.log(
            `[Call Webhook] AI analysis complete. Spam: ${analysisResult.analysis?.is_spam}, Action: ${analysisResult.analysis?.recommended_action}`
          );

          return NextResponse.json({
            received: true,
            call_id: call.id,
            analyzed: true,
            analysis: analysisResult.analysis,
          });
        } else {
          console.error(
            '[Call Webhook] AI analysis failed:',
            await analysisResponse.text()
          );
        }
      } catch (aiError: any) {
        console.error('[Call Webhook] AI analysis error:', aiError.message);
      }
    }

    // Return success even if AI analysis didn't run
    return NextResponse.json({
      received: true,
      call_id: call.id,
      analyzed: false,
      reason: callData.transcript ? 'analysis_failed' : 'no_transcript',
    });
  } catch (error: any) {
    console.error('[Call Webhook] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/call-received
 * Health check
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/webhooks/call-received',
    supports: ['openphone', 'beside', 'generic'],
  });
}

// ============================================================================
// Provider Normalization
// ============================================================================

interface NormalizedCallData {
  provider: 'openphone' | 'beside' | 'retell' | 'generic';
  provider_call_id: string;
  from_number: string;
  to_number: string;
  direction: 'inbound' | 'outbound';
  duration: number;
  transcript: string | null;
  recording_url: string | null;
  caller_name: string | null;
  started_at: string | null;
}

function normalizeCallData(
  payload: Record<string, any>,
  headers: Headers
): NormalizedCallData {
  // Detect provider from headers or payload structure
  const userAgent = headers.get('user-agent') || '';

  // OpenPhone webhook format
  if (
    payload.type?.startsWith('call.') ||
    payload.object === 'call' ||
    userAgent.includes('OpenPhone')
  ) {
    return normalizeOpenPhone(payload);
  }

  // Beside (Quo) webhook format
  if (
    payload.event_type?.startsWith('call.') ||
    payload.source === 'beside' ||
    payload.source === 'quo'
  ) {
    return normalizeBeside(payload);
  }

  // Retell AI format
  if (payload.event === 'call_ended' || payload.call_type === 'retell') {
    return normalizeRetell(payload);
  }

  // Generic/fallback format
  return normalizeGeneric(payload);
}

function normalizeOpenPhone(payload: Record<string, any>): NormalizedCallData {
  const call = payload.data?.object || payload.data || payload;

  return {
    provider: 'openphone',
    provider_call_id: call.id || call.callId || '',
    from_number: call.from || call.fromNumber || '',
    to_number: call.to || call.toNumber || '',
    direction: call.direction === 'outgoing' ? 'outbound' : 'inbound',
    duration: call.duration || 0,
    transcript:
      call.transcript ||
      call.transcription?.text ||
      call.voicemail?.transcript ||
      null,
    recording_url:
      call.recordingUrl || call.voicemail?.url || null,
    caller_name: call.callerName || call.contact?.name || null,
    started_at: call.createdAt || call.startedAt || null,
  };
}

function normalizeBeside(payload: Record<string, any>): NormalizedCallData {
  const call = payload.data || payload;

  return {
    provider: 'beside',
    provider_call_id: call.call_id || call.id || '',
    from_number: call.from_number || call.caller || '',
    to_number: call.to_number || call.callee || '',
    direction: call.direction || 'inbound',
    duration: call.duration || 0,
    transcript: call.transcript || call.transcription || null,
    recording_url: call.recording_url || null,
    caller_name: call.caller_name || null,
    started_at: call.started_at || call.timestamp || null,
  };
}

function normalizeRetell(payload: Record<string, any>): NormalizedCallData {
  return {
    provider: 'retell',
    provider_call_id: payload.call_id || '',
    from_number: payload.from_number || payload.caller || '',
    to_number: payload.to_number || '',
    direction: 'inbound',
    duration: payload.duration || payload.call_duration || 0,
    transcript: payload.transcript || payload.call_transcript || null,
    recording_url: payload.recording_url || null,
    caller_name: payload.caller_name || null,
    started_at: payload.start_time || payload.created_at || null,
  };
}

function normalizeGeneric(payload: Record<string, any>): NormalizedCallData {
  return {
    provider: 'generic',
    provider_call_id: payload.id || payload.call_id || `gen_${Date.now()}`,
    from_number: payload.from || payload.from_number || payload.phone || '',
    to_number: payload.to || payload.to_number || '',
    direction: payload.direction || 'inbound',
    duration: payload.duration || 0,
    transcript: payload.transcript || payload.text || null,
    recording_url: payload.recording_url || payload.recording || null,
    caller_name: payload.name || payload.caller_name || null,
    started_at: payload.timestamp || payload.created_at || null,
  };
}
