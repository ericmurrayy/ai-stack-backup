/**
 * Job Completion Webhook
 * ======================
 * Triggered when a job is marked as complete
 * Automatically triggers invoice generation and review requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { invoicingService } from '@packages/services/invoicing';
import { reviewService } from '@packages/services/reviews';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface JobCompletePayload {
  jobId: string;
  completedAt: string;
  completedBy?: string;
  notes?: string;
}

/**
 * POST /api/webhooks/job-complete
 * Handle job completion - create invoice and review request
 */
export async function POST(req: NextRequest) {
  try {
    // Verify webhook secret (optional)
    const webhookSecret = process.env.INTERNAL_WEBHOOK_SECRET;
    if (webhookSecret) {
      const authHeader = req.headers.get('x-webhook-secret');
      if (authHeader !== webhookSecret) {
        return NextResponse.json(
          { error: 'Invalid webhook secret' },
          { status: 401 }
        );
      }
    }

    const body: JobCompletePayload = await req.json();
    const { jobId, completedAt, notes } = body;

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId is required' },
        { status: 400 }
      );
    }

    console.log(`[Job Complete] Processing job ${jobId}`);

    const results = {
      invoice: { created: false, id: null as string | null, error: null as string | null },
      review: { created: false, id: null as string | null, error: null as string | null },
    };

    // 1. Create Invoice
    try {
      const invoice = await invoicingService.createFromJob(jobId);
      if (invoice) {
        results.invoice = { created: true, id: invoice.id, error: null };
        console.log(`[Job Complete] Created invoice ${invoice.invoiceNumber} for job ${jobId}`);

        // Auto-send invoice via WhatsApp (optional - could make this configurable)
        const autoSendInvoice = process.env.AUTO_SEND_INVOICE === 'true';
        if (autoSendInvoice) {
          await invoicingService.sendInvoice({
            invoiceId: invoice.id,
            channels: ['whatsapp'],
          });
          console.log(`[Job Complete] Auto-sent invoice to customer`);
        }
      }
    } catch (error: any) {
      console.error(`[Job Complete] Invoice error:`, error);
      results.invoice.error = error.message;
    }

    // 2. Create Review Request
    try {
      const reviewRequest = await reviewService.createRequest(jobId);
      if (reviewRequest) {
        results.review = { created: true, id: reviewRequest.id, error: null };
        console.log(`[Job Complete] Created review request for job ${jobId}`);

        // Auto-send review request (with delay - could use scheduled task)
        const autoSendReview = process.env.AUTO_SEND_REVIEW === 'true';
        if (autoSendReview) {
          // Send after a short delay to not overwhelm customer
          setTimeout(async () => {
            try {
              await reviewService.sendRequest(reviewRequest.id);
              console.log(`[Job Complete] Auto-sent review request`);
            } catch (error) {
              console.error(`[Job Complete] Failed to send review request:`, error);
            }
          }, 2 * 60 * 60 * 1000); // 2 hours delay
        }
      }
    } catch (error: any) {
      console.error(`[Job Complete] Review request error:`, error);
      results.review.error = error.message;
    }

    // Update job with completion info
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await supabase
      .from('jobs')
      .update({
        status: 'completed',
        completed_at: completedAt || new Date().toISOString(),
        completion_notes: notes,
      })
      .eq('id', jobId);

    return NextResponse.json({
      success: true,
      jobId,
      results,
    });
  } catch (error: any) {
    console.error('[Job Complete] Webhook error:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/job-complete
 * Health check
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/webhooks/job-complete',
    description: 'Triggers invoice and review request on job completion',
  });
}
