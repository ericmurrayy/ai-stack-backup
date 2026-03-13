// Murray's FSM - Estimate PDF API Route
// ======================================
// Returns PDF by default, HTML with ?format=html

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateEstimateHTML, type EstimateData, type BusinessInfo } from '@murray-fsm/services';
import { renderEstimatePdf } from '@/lib/pdf-renderer';

// Business info - would normally come from config/database
const BUSINESS_INFO: BusinessInfo = {
  name: process.env.BUSINESS_NAME || "Murray's Garage Door Service",
  address1: process.env.BUSINESS_ADDRESS1 || '123 Main Street',
  city: process.env.BUSINESS_CITY || 'Austin',
  state: process.env.BUSINESS_STATE || 'TX',
  postalCode: process.env.BUSINESS_ZIP || '78701',
  phone: process.env.BUSINESS_PHONE || '+15551234567',
  email: process.env.BUSINESS_EMAIL || 'info@murraysfsm.com',
  website: process.env.BUSINESS_WEBSITE,
  licenseNumber: process.env.BUSINESS_LICENSE,
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  try {
    const supabase = await createClient();

    // Auth check — require logged-in user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch job with related data
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select(`
        *,
        customer:customers(*),
        location:locations(*)
      `)
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Fetch estimate line items
    const { data: lineItems, error: itemsError } = await supabase
      .from('line_items')
      .select('*')
      .eq('job_id', jobId)
      .eq('kind', 'estimate')
      .eq('deleted', false)
      .order('sort_order');

    if (itemsError) {
      return NextResponse.json({ error: 'Failed to fetch line items' }, { status: 500 });
    }

    // Build estimate data
    const estimateData: EstimateData = {
      estimateNumber: `EST-${job.id.slice(0, 8).toUpperCase()}`,
      date: job.created_at,
      customer: {
        name: job.customer?.name || 'Customer',
        phone: job.customer?.phone,
        email: job.customer?.email,
      },
      location: {
        address1: job.location?.address1 || '',
        address2: job.location?.address2,
        city: job.location?.city || '',
        state: job.location?.state || '',
        postal_code: job.location?.postal_code || '',
      },
      jobTitle: job.title || 'Service',
      jobDescription: job.description,
      lineItems: (lineItems || []).map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        total_cents: item.total_cents,
      })),
      subtotal: job.total_estimate_cents || 0,
      total: job.total_estimate_cents || 0,
      notes: job.notes,
      terms: 'Estimate valid for 30 days. Prices subject to change based on actual conditions found.',
    };

    // Determine output format: pdf (default) or html
    const format = request.nextUrl.searchParams.get('format') || 'pdf';

    if (format === 'html') {
      // Return rendered HTML (existing behavior)
      const html = generateEstimateHTML(BUSINESS_INFO, estimateData);
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }

    // Default: generate PDF
    const pdfBytes = renderEstimatePdf(BUSINESS_INFO, estimateData);
    const filename = `Estimate-${estimateData.estimateNumber}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    console.error('Error generating estimate PDF:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
