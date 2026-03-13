// Murray's FSM - SMS Send API Route
// ===================================
// POST /api/sms/send - Send an SMS message

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  createSmsService,
  buildSmsFromTemplate,
  type SmsConfig,
  type SmsTemplateName,
} from '@murray-fsm/services';
import { logAction } from '@/lib/audit-log';

// ============================================================================
// Helpers
// ============================================================================

/** Minimal E.164 phone validation: +{country}{number}, 8-15 digits total */
const E164_REGEX = /^\+[1-9]\d{7,14}$/;

function getSmsConfig(): SmsConfig {
  const provider = (process.env.SMS_PROVIDER || 'twilio') as SmsConfig['provider'];

  if (provider === 'twilio') {
    return {
      provider: 'twilio',
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      fromNumber: process.env.TWILIO_FROM_NUMBER,
    };
  }

  if (provider === 'openphone') {
    return {
      provider: 'openphone',
      apiKey: process.env.OPENPHONE_API_KEY,
      phoneNumberId: process.env.OPENPHONE_PHONE_NUMBER_ID,
    };
  }

  // Fallback - let the factory throw if truly unsupported
  return { provider } as SmsConfig;
}

// ============================================================================
// POST /api/sms/send
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // ------------------------------------------------------------------
    // 1. Auth check
    // ------------------------------------------------------------------
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ------------------------------------------------------------------
    // 2. Parse and validate body
    // ------------------------------------------------------------------
    let body: {
      to: string;
      body?: string;
      jobId?: string;
      template?: SmsTemplateName;
      templateData?: Record<string, unknown>;
      mediaUrl?: string;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    const { to, jobId, template, templateData, mediaUrl } = body;

    // Validate `to` phone number
    if (!to || typeof to !== 'string') {
      return NextResponse.json(
        { error: '`to` phone number is required' },
        { status: 400 },
      );
    }

    if (!E164_REGEX.test(to)) {
      return NextResponse.json(
        { error: '`to` must be a valid E.164 phone number (e.g. +15551234567)' },
        { status: 400 },
      );
    }

    // Resolve the message body: either from template or raw body
    let messageBody: string;

    if (template) {
      if (!templateData || typeof templateData !== 'object') {
        return NextResponse.json(
          { error: '`templateData` is required when using a template' },
          { status: 400 },
        );
      }

      const built = buildSmsFromTemplate(template, templateData);
      if (!built) {
        return NextResponse.json(
          { error: `Invalid template "${template}" or missing required template data fields` },
          { status: 400 },
        );
      }

      messageBody = built;
    } else if (body.body && typeof body.body === 'string' && body.body.trim().length > 0) {
      messageBody = body.body.trim();
    } else {
      return NextResponse.json(
        { error: 'Either `body` (message text) or `template` + `templateData` is required' },
        { status: 400 },
      );
    }

    // Sanity-check message length (carriers typically cap at ~1600 chars for
    // multi-segment SMS; warn at a reasonable threshold)
    if (messageBody.length > 1600) {
      return NextResponse.json(
        { error: 'Message body exceeds 1600 characters' },
        { status: 400 },
      );
    }

    // ------------------------------------------------------------------
    // 3. Send SMS via provider
    // ------------------------------------------------------------------
    let smsService;
    try {
      smsService = createSmsService(getSmsConfig());
    } catch (configError: any) {
      console.error('[sms/send] SMS provider config error:', configError.message);
      return NextResponse.json(
        { error: 'SMS service not configured. Please set SMS provider environment variables.' },
        { status: 503 },
      );
    }

    const result = await smsService.sendSms(to, messageBody, mediaUrl);

    // ------------------------------------------------------------------
    // 4. Log to message_logs table
    // ------------------------------------------------------------------
    const fromPhone = process.env.TWILIO_FROM_NUMBER
      || process.env.OPENPHONE_PHONE_NUMBER_ID
      || 'system';

    const { error: logError } = await supabase.from('message_logs').insert({
      owner_id: user.id,
      external_message_id: result.messageId || `local_${Date.now()}`,
      direction: 'outbound',
      from_phone: fromPhone,
      to_phone: to,
      body: messageBody,
      media: mediaUrl ? [{ url: mediaUrl }] : [],
      status: result.success ? 'sent' : 'failed',
      raw_event: {
        provider: process.env.SMS_PROVIDER || 'twilio',
        template: template || null,
        job_id: jobId || null,
        error: result.error || null,
        message_id: result.messageId || null,
      },
    });

    if (logError) {
      // Non-fatal: log but do not fail the request
      console.error('[sms/send] Failed to write message_logs:', logError.message);
    }

    // ------------------------------------------------------------------
    // 5. Audit log
    // ------------------------------------------------------------------
    logAction(request, {
      ownerId: user.id,
      actorId: user.id,
      actorEmail: user.email,
      action: 'sms.sent',
      resourceType: 'message',
      resourceId: result.messageId,
      metadata: {
        to,
        template: template || null,
        job_id: jobId || null,
        success: result.success,
        provider: process.env.SMS_PROVIDER || 'twilio',
      },
    });

    // ------------------------------------------------------------------
    // 6. Return result
    // ------------------------------------------------------------------
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to send SMS',
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
    });
  } catch (error: any) {
    console.error('[sms/send] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
