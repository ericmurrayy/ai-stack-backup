// Murray's FSM - Portal Estimate Approve API
// ============================================
// POST /api/portal/[token]/estimates/[estimateId]/approve
// Customer-facing endpoint: validates portal token (no session auth required)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { dispatchWebhookEvent } from '@/lib/webhook-dispatch';

// ============================================================================
// POST /api/portal/[token]/estimates/[estimateId]/approve
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; estimateId: string }> }
) {
  try {
    const { token, estimateId } = await params;
    const supabase = await createClient();

    // ------------------------------------------------------------------
    // 1. Validate portal token
    // ------------------------------------------------------------------
    const { data: portalToken, error: tokenError } = await supabase
      .from('customer_portal_tokens')
      .select('id, owner_id, customer_phone, customer_email, token, job_id, expires_at')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (tokenError || !portalToken) {
      return NextResponse.json(
        { error: 'Invalid or expired portal token' },
        { status: 401 },
      );
    }

    // Update last_accessed_at on the token
    await supabase
      .from('customer_portal_tokens')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', portalToken.id);

    // ------------------------------------------------------------------
    // 2. Verify the estimate belongs to a job for this customer
    // ------------------------------------------------------------------
    // Get jobs associated with this customer's phone number
    const { data: customerJobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id')
      .eq('phone_e164', portalToken.customer_phone);

    if (jobsError || !customerJobs || customerJobs.length === 0) {
      return NextResponse.json(
        { error: 'No jobs found for this customer' },
        { status: 404 },
      );
    }

    const customerJobIds = customerJobs.map((j) => j.id);

    // Fetch the estimate and verify it belongs to one of the customer's jobs
    const { data: estimate, error: estimateError } = await supabase
      .from('estimates')
      .select('id, job_id, estimate_number, status, total_cents, notes, valid_until, sent_at, created_at')
      .eq('id', estimateId)
      .in('job_id', customerJobIds)
      .single();

    if (estimateError || !estimate) {
      return NextResponse.json(
        { error: 'Estimate not found' },
        { status: 404 },
      );
    }

    // Only allow approving estimates that are in 'sent' status
    if (estimate.status !== 'sent') {
      return NextResponse.json(
        { error: `Estimate cannot be approved — current status is '${estimate.status}'` },
        { status: 400 },
      );
    }

    // ------------------------------------------------------------------
    // 3. Update estimate status to 'approved'
    // ------------------------------------------------------------------
    const now = new Date().toISOString();

    const { data: updatedEstimate, error: updateError } = await supabase
      .from('estimates')
      .update({
        status: 'approved',
        approved_at: now,
      })
      .eq('id', estimateId)
      .select()
      .single();

    if (updateError) {
      console.error('[portal/estimates/approve] Failed to update estimate:', updateError.message);
      return NextResponse.json(
        { error: 'Failed to approve estimate' },
        { status: 500 },
      );
    }

    // ------------------------------------------------------------------
    // 4. Fire webhook event
    // ------------------------------------------------------------------
    dispatchWebhookEvent(portalToken.owner_id, 'estimate.approved', {
      estimate: updatedEstimate,
      approved_by: 'customer',
      customer_phone: portalToken.customer_phone,
      customer_email: portalToken.customer_email,
    });

    // ------------------------------------------------------------------
    // 5. Return success
    // ------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      estimate: updatedEstimate,
    });
  } catch (error: any) {
    console.error('[portal/estimates/approve] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
