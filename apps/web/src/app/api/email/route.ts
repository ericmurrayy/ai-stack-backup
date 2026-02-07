/**
 * Email API Route
 * ===============
 * Send transactional emails using Resend
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateInvoiceEmail,
  generateAppointmentEmail,
  generatePaymentReceiptEmail,
  generateEstimateEmail,
} from '@packages/services/email';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@murrayfsm.com';
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "Murray's Field Service";
const BUSINESS_PHONE = process.env.BUSINESS_PHONE || '(555) 123-4567';
const BUSINESS_NAME = process.env.BUSINESS_NAME || "Murray's Field Service";

/**
 * Send email via Resend
 */
async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!RESEND_API_KEY) {
    console.log('[Email] RESEND_API_KEY not configured');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
        to: [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || 'Failed to send email' };
    }

    return { success: true, id: data.id };
  } catch (error: any) {
    console.error('[Email] Send error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * GET /api/email
 * Check email service status
 */
export async function GET() {
  return NextResponse.json({
    configured: !!RESEND_API_KEY,
    from: EMAIL_FROM,
    fromName: EMAIL_FROM_NAME,
  });
}

/**
 * POST /api/email
 * Send an email
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { type, to, data } = body;

    if (!to) {
      return NextResponse.json(
        { error: 'to email address is required' },
        { status: 400 }
      );
    }

    let emailContent: { subject: string; html: string; text: string };

    switch (type) {
      case 'invoice':
        emailContent = generateInvoiceEmail({
          ...data,
          businessName: BUSINESS_NAME,
          businessPhone: BUSINESS_PHONE,
        });
        break;

      case 'appointment':
        emailContent = generateAppointmentEmail({
          ...data,
          businessName: BUSINESS_NAME,
          businessPhone: BUSINESS_PHONE,
        });
        break;

      case 'receipt':
        emailContent = generatePaymentReceiptEmail({
          ...data,
          businessName: BUSINESS_NAME,
          businessPhone: BUSINESS_PHONE,
        });
        break;

      case 'estimate':
        emailContent = generateEstimateEmail({
          ...data,
          businessName: BUSINESS_NAME,
          businessPhone: BUSINESS_PHONE,
        });
        break;

      case 'custom':
        if (!data.subject || !data.html) {
          return NextResponse.json(
            { error: 'subject and html are required for custom emails' },
            { status: 400 }
          );
        }
        emailContent = {
          subject: data.subject,
          html: data.html,
          text: data.text || '',
        };
        break;

      default:
        return NextResponse.json(
          { error: `Unknown email type: ${type}` },
          { status: 400 }
        );
    }

    const result = await sendEmail({
      to,
      ...emailContent,
    });

    // Log email send attempt
    try {
      await supabase.from('email_logs').insert({
        to_email: to,
        email_type: type,
        subject: emailContent.subject,
        status: result.success ? 'sent' : 'failed',
        provider_id: result.id,
        error: result.error,
        sent_by: user.id,
      });
    } catch {
      // Ignore logging errors
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Email] API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send email' },
      { status: 500 }
    );
  }
}
