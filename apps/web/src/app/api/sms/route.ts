/**
 * SMS API Endpoint
 * ================
 * Send SMS notifications to customers
 */

import { NextRequest, NextResponse } from 'next/server';
import { smsService } from '@packages/services/sms';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * POST /api/sms
 * Send an SMS message
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, to, ...params } = body;

    if (!to) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    let result;

    switch (type) {
      case 'custom':
        // Send custom message
        result = await smsService.send(to, params.message);
        break;

      case 'job-confirmation':
        result = await smsService.sendJobConfirmation(to, {
          jobNumber: params.jobNumber,
          date: params.date,
          time: params.time,
          technicianName: params.technicianName,
          address: params.address,
        });
        break;

      case 'on-my-way':
        result = await smsService.sendOnMyWay(to, {
          technicianName: params.technicianName,
          eta: params.eta,
        });
        break;

      case 'job-complete':
        result = await smsService.sendJobComplete(to, {
          jobNumber: params.jobNumber,
          total: params.total,
          paymentLink: params.paymentLink,
        });
        break;

      case 'payment-reminder':
        result = await smsService.sendPaymentReminder(to, {
          invoiceNumber: params.invoiceNumber,
          amount: params.amount,
          dueDate: params.dueDate,
          paymentLink: params.paymentLink,
          isOverdue: params.isOverdue,
        });
        break;

      case 'review-request':
        result = await smsService.sendReviewRequest(to, {
          customerName: params.customerName,
          reviewLink: params.reviewLink,
        });
        break;

      case 'appointment-reminder':
        result = await smsService.sendAppointmentReminder(to, {
          customerName: params.customerName,
          date: params.date,
          time: params.time,
          serviceType: params.serviceType,
        });
        break;

      case 'quote':
        result = await smsService.sendQuoteNotification(to, {
          quoteNumber: params.quoteNumber,
          total: params.total,
          viewLink: params.viewLink,
        });
        break;

      default:
        return NextResponse.json(
          { error: `Unknown SMS type: ${type}` },
          { status: 400 }
        );
    }

    // Log the SMS in database
    const supabase = createAdminClient();
    await supabase.from('sms_log').insert({
      phone_number: to,
      message_type: type,
      message_id: result.messageId,
      provider: result.provider,
      status: result.success ? 'sent' : 'failed',
      error: result.error,
      created_at: new Date().toISOString(),
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, provider: result.provider },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      provider: result.provider,
    });
  } catch (error: any) {
    console.error('[SMS API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send SMS' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sms
 * Get SMS logs
 */
export async function GET(req: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);

  const limit = parseInt(searchParams.get('limit') || '50');
  const phone = searchParams.get('phone');

  try {
    let query = supabase
      .from('sms_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (phone) {
      query = query.eq('phone_number', phone);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Get stats
    const { count: totalSent } = await supabase
      .from('sms_log')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent');

    const { count: totalFailed } = await supabase
      .from('sms_log')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed');

    // Get today's count
    const today = new Date().toISOString().split('T')[0];
    const { count: todaySent } = await supabase
      .from('sms_log')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('created_at', today);

    return NextResponse.json({
      messages: data || [],
      stats: {
        totalSent: totalSent || 0,
        totalFailed: totalFailed || 0,
        todaySent: todaySent || 0,
      },
    });
  } catch (error: any) {
    console.error('[SMS API] Error fetching logs:', error);
    return NextResponse.json({
      messages: [],
      stats: { totalSent: 0, totalFailed: 0, todaySent: 0 },
    });
  }
}
