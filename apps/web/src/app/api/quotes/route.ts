/**
 * Quotes API Route
 * ================
 * Generate and manage quotes/estimates
 */

import { NextRequest, NextResponse } from 'next/server';
import { quotingService } from '@packages/services/quoting';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60; // AI generation can take time

/**
 * GET /api/quotes
 * List quotes or get stats
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'stats':
        const stats = await quotingService.getStats();
        return NextResponse.json(stats);

      case 'catalog':
        const catalog = await quotingService.getServiceCatalog();
        return NextResponse.json({ catalog });

      default:
        // List quotes
        const status = searchParams.get('status');
        const limit = parseInt(searchParams.get('limit') || '50');

        let query = supabase
          .from('quotes')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (status) {
          query = query.eq('status', status);
        }

        const { data: quotes, error } = await query;
        if (error) throw error;

        return NextResponse.json({ quotes });
    }
  } catch (error: any) {
    console.error('Quotes API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get quotes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/quotes
 * Generate or manage quotes
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'generate':
        // Generate AI-powered quote
        const { customerName, customerPhone, customerEmail, jobDescription, urgency, customerId } = body;

        if (!customerName || !jobDescription) {
          return NextResponse.json(
            { error: 'customerName and jobDescription are required' },
            { status: 400 }
          );
        }

        const quote = await quotingService.generateQuote({
          customerId,
          customerName,
          customerPhone,
          customerEmail,
          jobDescription,
          urgency,
        });

        return NextResponse.json({ success: true, quote });

      case 'send':
        // Send quote to customer
        const { quoteId, channels } = body;

        if (!quoteId) {
          return NextResponse.json(
            { error: 'quoteId is required' },
            { status: 400 }
          );
        }

        const sendResult = await quotingService.sendQuote(
          quoteId,
          channels || ['whatsapp']
        );

        return NextResponse.json(sendResult);

      case 'accept':
        // Accept quote and create job
        const { quoteId: acceptQuoteId, preferredDate } = body;

        if (!acceptQuoteId) {
          return NextResponse.json(
            { error: 'quoteId is required' },
            { status: 400 }
          );
        }

        const acceptResult = await quotingService.acceptQuote(
          acceptQuoteId,
          preferredDate
        );

        return NextResponse.json({ success: true, ...acceptResult });

      case 'reject':
        // Reject/decline quote
        const { quoteId: rejectQuoteId, reason } = body;

        await supabase
          .from('quotes')
          .update({
            status: 'rejected',
            rejected_at: new Date().toISOString(),
            rejection_reason: reason,
          })
          .eq('id', rejectQuoteId);

        return NextResponse.json({ success: true });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Quotes API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process quote request' },
      { status: 500 }
    );
  }
}
