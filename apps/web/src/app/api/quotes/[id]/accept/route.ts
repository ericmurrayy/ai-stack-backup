import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { preferredDate } = body;

  if (!supabase) {
    // Return mock success for demo
    return NextResponse.json({
      success: true,
      jobId: 'demo-job-' + Date.now(),
    });
  }

  try {
    // Get the quote
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', id)
      .single();

    if (quoteError || !quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // Check if quote can be accepted
    if (['accepted', 'rejected', 'expired'].includes(quote.status)) {
      return NextResponse.json({ error: 'Quote cannot be accepted' }, { status: 400 });
    }

    // Check if expired
    if (new Date(quote.valid_until) < new Date()) {
      await supabase
        .from('quotes')
        .update({ status: 'expired' })
        .eq('id', id);
      return NextResponse.json({ error: 'Quote has expired' }, { status: 400 });
    }

    // Create job from quote
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        customer_id: quote.customer_id,
        title: quote.job_description || `Service - Quote #${quote.quote_number}`,
        description: `Accepted from Quote #${quote.quote_number}\n\n${quote.notes || ''}`,
        quoted_amount: quote.total,
        status: preferredDate ? 'scheduled' : 'pending',
        scheduled_date: preferredDate || null,
        source: 'quote',
        quote_id: id,
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error creating job:', jobError);
      return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
    }

    // Update quote status
    await supabase
      .from('quotes')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        job_id: job.id,
      })
      .eq('id', id);

    // Log to AI revenue
    await supabase.from('ai_revenue').insert({
      source: 'quote_accepted',
      amount: quote.total,
      job_id: job.id,
      notes: `Quote #${quote.quote_number} accepted${quote.ai_generated ? ' (AI generated)' : ''}`,
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
    });
  } catch (error) {
    console.error('Error accepting quote:', error);
    return NextResponse.json({ error: 'Failed to accept quote' }, { status: 500 });
  }
}
