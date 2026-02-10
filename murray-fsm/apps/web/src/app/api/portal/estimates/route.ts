// Murray's FSM - Portal Estimate Approval API
// =============================================
// Customers approve or decline estimates from their portal.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, jobId, action } = body; // action: 'approve' | 'decline'

    if (!token || !jobId || !['approve', 'decline'].includes(action)) {
      return NextResponse.json(
        { error: 'token, jobId, and action (approve/decline) are required' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // Verify portal token
    const { data: portalToken } = await supabase
      .from('customer_portal_tokens')
      .select('customer_id, owner_id')
      .eq('token', token)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!portalToken) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // Verify job belongs to this customer and has a pending estimate
    const { data: job } = await supabase
      .from('jobs')
      .select('id, title, owner_id, total_estimate_cents, total_invoice_cents')
      .eq('id', jobId)
      .eq('customer_id', portalToken.customer_id)
      .single();

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Pending = has estimate line items but no invoice yet
    if (!job.total_estimate_cents || job.total_estimate_cents <= 0) {
      return NextResponse.json({ error: 'No estimate found for this job' }, { status: 400 });
    }

    if (job.total_invoice_cents > 0) {
      return NextResponse.json({ error: 'Estimate already processed' }, { status: 400 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'declined';

    // If approved, copy estimate items to invoice items
    if (action === 'approve') {
      const { data: estimateItems } = await supabase
        .from('line_items')
        .select('owner_id, job_id, name, description, qty, unit_price_cents, sort_order')
        .eq('job_id', jobId)
        .eq('kind', 'estimate')
        .eq('deleted', false);

      if (estimateItems && estimateItems.length > 0) {
        // Insert invoice line items (total_cents is GENERATED, don't include it)
        const invoiceItems = estimateItems.map((item) => ({
          owner_id: item.owner_id,
          job_id: jobId,
          kind: 'invoice' as const,
          name: item.name,
          description: item.description,
          qty: item.qty,
          unit_price_cents: item.unit_price_cents,
          sort_order: item.sort_order,
        }));

        await supabase.from('line_items').insert(invoiceItems);
        // The trigger update_line_item_totals automatically updates job.total_invoice_cents
      }
    } else {
      // Declined: soft-delete estimate line items so it no longer shows as pending
      await supabase
        .from('line_items')
        .update({ deleted: true })
        .eq('job_id', jobId)
        .eq('kind', 'estimate');
      // Trigger recalculates total_estimate_cents to 0
    }

    // Record event
    await supabase.from('job_events').insert({
      owner_id: job.owner_id,
      job_id: jobId,
      event_type: `estimate_${newStatus}`,
      payload: {
        action: newStatus,
        total_estimate_cents: job.total_estimate_cents,
        actor: 'customer',
      },
    });

    // Audit
    await supabase.from('audit_log').insert({
      owner_id: job.owner_id,
      actor: 'customer',
      action: `estimate_${newStatus}`,
      entity_type: 'job',
      entity_id: jobId,
      diff: {
        total_estimate_cents: job.total_estimate_cents,
        invoice_created: action === 'approve',
      },
    });

    // Notify operator
    await supabase.from('action_queue').insert({
      owner_id: job.owner_id,
      kind: action === 'approve' ? 'send_sms' : 'send_sms',
      payload: {
        to_phone: 'operator', // n8n resolves to operator's phone
        message: `Estimate for "${job.title}" was ${newStatus} by customer.${action === 'approve' ? ' Invoice created automatically.' : ''}`,
        job_id: jobId,
      },
      source_type: 'customer_portal',
      source_id: jobId,
      requires_approval: false,
      status: 'pending',
      idempotency_key: `estimate_${newStatus}:${jobId}`,
      result: {},
      retry_count: 0,
      max_retries: 3,
    });

    return NextResponse.json({
      success: true,
      data: {
        jobId,
        estimateStatus: newStatus,
        invoiceCreated: action === 'approve',
      },
    });
  } catch (error) {
    console.error('Estimate action error:', error);
    return NextResponse.json({ error: 'Failed to process estimate' }, { status: 500 });
  }
}
