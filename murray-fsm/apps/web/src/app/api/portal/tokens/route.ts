// Murray's FSM - Portal Token Management
// =======================================
// POST /api/portal/tokens - Generate a portal token for a customer
// GET  /api/portal/tokens - List portal tokens for the authenticated user

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAction } from '@/lib/audit-log';
import crypto from 'crypto';

// ============================================================================
// Helpers
// ============================================================================

/** Minimal E.164 phone validation: +{country}{number}, 8-15 digits total */
const E164_REGEX = /^\+[1-9]\d{7,14}$/;

/** Basic email validation */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Default token expiration in days */
const DEFAULT_EXPIRES_IN_DAYS = 30;

/** Max allowed expiration in days (1 year) */
const MAX_EXPIRES_IN_DAYS = 365;

/** Base URL for portal links */
const PORTAL_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://app.murraysfsm.com';

/**
 * Generate a 64-character hex token from two concatenated UUIDs with hyphens
 * removed.
 */
function generatePortalToken(): string {
  const raw = crypto.randomUUID() + crypto.randomUUID();
  return raw.replace(/-/g, '');
}

// ============================================================================
// POST /api/portal/tokens
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // ------------------------------------------------------------------
    // 1. Auth check
    // ------------------------------------------------------------------
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ------------------------------------------------------------------
    // 2. Parse and validate body
    // ------------------------------------------------------------------
    let body: {
      customer_phone: string;
      customer_email?: string;
      job_id?: string;
      expires_in_days?: number;
      send_sms?: boolean;
      send_email?: boolean;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    const {
      customer_phone,
      customer_email,
      job_id,
      expires_in_days = DEFAULT_EXPIRES_IN_DAYS,
      send_sms = false,
      send_email = false,
    } = body;

    // Validate customer_phone (required)
    if (!customer_phone || typeof customer_phone !== 'string') {
      return NextResponse.json(
        { error: '`customer_phone` is required' },
        { status: 400 },
      );
    }

    if (!E164_REGEX.test(customer_phone)) {
      return NextResponse.json(
        {
          error:
            '`customer_phone` must be a valid E.164 phone number (e.g. +15551234567)',
        },
        { status: 400 },
      );
    }

    // Validate customer_email (optional)
    if (
      customer_email !== undefined &&
      customer_email !== null &&
      customer_email !== ''
    ) {
      if (typeof customer_email !== 'string' || !EMAIL_REGEX.test(customer_email)) {
        return NextResponse.json(
          { error: '`customer_email` must be a valid email address' },
          { status: 400 },
        );
      }
    }

    // Validate job_id (optional UUID)
    if (job_id !== undefined && job_id !== null && job_id !== '') {
      const UUID_REGEX =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (typeof job_id !== 'string' || !UUID_REGEX.test(job_id)) {
        return NextResponse.json(
          { error: '`job_id` must be a valid UUID' },
          { status: 400 },
        );
      }
    }

    // Validate expires_in_days
    if (
      typeof expires_in_days !== 'number' ||
      expires_in_days < 1 ||
      expires_in_days > MAX_EXPIRES_IN_DAYS
    ) {
      return NextResponse.json(
        {
          error: `\`expires_in_days\` must be between 1 and ${MAX_EXPIRES_IN_DAYS}`,
        },
        { status: 400 },
      );
    }

    // ------------------------------------------------------------------
    // 3. Generate token
    // ------------------------------------------------------------------
    const token = generatePortalToken();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expires_in_days);
    const expiresAtIso = expiresAt.toISOString();

    // ------------------------------------------------------------------
    // 4. Insert into customer_portal_tokens
    // ------------------------------------------------------------------
    const { data: tokenRow, error: insertError } = await supabase
      .from('customer_portal_tokens')
      .insert({
        owner_id: user.id,
        customer_phone,
        customer_email: customer_email || null,
        token,
        job_id: job_id || null,
        expires_at: expiresAtIso,
      })
      .select('id, token, customer_phone, customer_email, job_id, expires_at, created_at')
      .single();

    if (insertError) {
      console.error('[portal/tokens] Insert error:', insertError.message);
      return NextResponse.json(
        { error: 'Failed to create portal token' },
        { status: 500 },
      );
    }

    const portalUrl = `${PORTAL_BASE_URL}/portal/${token}`;

    // ------------------------------------------------------------------
    // 5. Send SMS if requested
    // ------------------------------------------------------------------
    let smsSent = false;

    if (send_sms) {
      try {
        const smsResponse = await fetch(
          `${PORTAL_BASE_URL}/api/sms/send`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: request.headers.get('cookie') || '',
            },
            body: JSON.stringify({
              to: customer_phone,
              body: `Your Murray's portal is ready! View your job details, approve estimates, and more: ${portalUrl}`,
              jobId: job_id || undefined,
            }),
          },
        );

        const smsResult = await smsResponse.json();
        smsSent = smsResult.success === true;

        if (!smsSent) {
          console.error('[portal/tokens] SMS send failed:', smsResult.error);
        }
      } catch (smsError: any) {
        console.error('[portal/tokens] SMS send error:', smsError.message);
        // Non-fatal: token is still created even if SMS fails
      }
    }

    // ------------------------------------------------------------------
    // 6. Send email if requested
    // ------------------------------------------------------------------
    let emailSent = false;

    if (send_email && customer_email) {
      // TODO: integrate with email service when available
      // For now, log the intent
      console.log(
        `[portal/tokens] Email send requested to ${customer_email} with portal URL`,
      );
      emailSent = false;
    }

    // ------------------------------------------------------------------
    // 7. Audit log
    // ------------------------------------------------------------------
    logAction(request, {
      ownerId: user.id,
      actorId: user.id,
      actorEmail: user.email,
      action: 'portal_token.created',
      resourceType: 'portal_token',
      resourceId: tokenRow.id,
      metadata: {
        customer_phone,
        customer_email: customer_email || null,
        job_id: job_id || null,
        expires_at: expiresAtIso,
        send_sms,
        sms_sent: smsSent,
        send_email,
        email_sent: emailSent,
      },
    });

    // ------------------------------------------------------------------
    // 8. Return result
    // ------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      token,
      portalUrl,
      expiresAt: expiresAtIso,
      smsSent,
      emailSent,
    });
  } catch (error: any) {
    console.error('[portal/tokens] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// ============================================================================
// GET /api/portal/tokens
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // ------------------------------------------------------------------
    // 1. Auth check
    // ------------------------------------------------------------------
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ------------------------------------------------------------------
    // 2. Query tokens
    // ------------------------------------------------------------------
    const { data: tokens, error } = await supabase
      .from('customer_portal_tokens')
      .select(
        'id, token, customer_phone, customer_email, job_id, expires_at, created_at',
      )
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[portal/tokens] Query error:', error.message);
      return NextResponse.json(
        { error: 'Failed to fetch portal tokens' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      tokens: tokens || [],
    });
  } catch (error: any) {
    console.error('[portal/tokens] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
