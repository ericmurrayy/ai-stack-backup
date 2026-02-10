// Murray's FSM - Invoice API
// ============================
// Create invoice drafts from job line items and send payment links.
// Integrates with Stripe for hosted invoice pages.

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * POST /api/invoices
 * Create an invoice draft from a job's line items and optionally
 * enqueue a "send_invoice" action for approval.
 */
export async function POST(request: Request) {
  try {
    const { jobId, autoSend } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch job with customer
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*, customers(id, name, email, phone)')
      .eq('id', jobId)
      .eq('owner_id', user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Fetch invoice line items
    const { data: lineItems } = await supabase
      .from('line_items')
      .select('*')
      .eq('job_id', jobId)
      .eq('owner_id', user.id)
      .eq('kind', 'invoice')
      .eq('deleted', false)
      .order('sort_order');

    if (!lineItems || lineItems.length === 0) {
      // If no invoice items, copy from estimate
      const { data: estimateItems } = await supabase
        .from('line_items')
        .select('*')
        .eq('job_id', jobId)
        .eq('owner_id', user.id)
        .eq('kind', 'estimate')
        .eq('deleted', false)
        .order('sort_order');

      if (estimateItems && estimateItems.length > 0) {
        const invoiceItems = estimateItems.map((item) => ({
          owner_id: user.id,
          job_id: jobId,
          kind: 'invoice' as const,
          name: item.name,
          description: item.description,
          qty: item.qty,
          unit_price_cents: item.unit_price_cents,
          sort_order: item.sort_order,
        }));

        await supabase.from('line_items').insert(invoiceItems);
      }
    }

    // Calculate total
    const { data: finalItems } = await supabase
      .from('line_items')
      .select('total_cents')
      .eq('job_id', jobId)
      .eq('owner_id', user.id)
      .eq('kind', 'invoice')
      .eq('deleted', false);

    const totalCents = finalItems?.reduce((sum, i) => sum + (i.total_cents ?? 0), 0) ?? 0;
    const balanceDue = totalCents - (job.paid_cents ?? 0);

    // Enqueue send action if requested (approval-gated)
    if (autoSend && balanceDue > 0) {
      const customer = job.customers as { id: string; name: string; email: string; phone: string } | null;
      const idempotencyKey = `send_invoice:${jobId}:${Date.now()}`;

      await supabase.from('action_queue').insert({
        owner_id: user.id,
        kind: 'send_invoice',
        payload: {
          job_id: jobId,
          customer_id: customer?.id,
          customer_name: customer?.name,
          customer_email: customer?.email,
          customer_phone: customer?.phone,
          total_cents: totalCents,
          balance_due_cents: balanceDue,
          send_via: customer?.email ? 'email' : 'sms',
        },
        source_type: 'manual',
        requires_approval: true,
        job_id: jobId,
        idempotency_key: idempotencyKey,
        status: 'pending',
        result: {},
        retry_count: 0,
        max_retries: 3,
      });
    }

    // Audit
    await supabase.from('audit_log').insert({
      owner_id: user.id,
      actor: user.id,
      action: 'create',
      entity_type: 'invoice',
      entity_id: jobId,
      diff: {
        total_cents: totalCents,
        balance_due_cents: balanceDue,
        auto_send: autoSend ?? false,
      },
    });

    return NextResponse.json({
      success: true,
      job_id: jobId,
      total_cents: totalCents,
      balance_due_cents: balanceDue,
      action_enqueued: autoSend && balanceDue > 0,
    });
  } catch (error) {
    console.error('Invoice error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
