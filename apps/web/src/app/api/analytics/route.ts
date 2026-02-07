import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Validation schema for query parameters
const AnalyticsQuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d', '1y']).default('30d'),
});

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

// Empty response structure for when no data is available
function getEmptyAnalytics() {
  return {
    revenue: {
      total: 0,
      thisMonth: 0,
      lastMonth: 0,
      growth: 0,
      bySource: [],
    },
    jobs: {
      total: 0,
      completed: 0,
      pending: 0,
      completionRate: 0,
      avgValue: 0,
    },
    customers: {
      total: 0,
      new: 0,
      returning: 0,
      retentionRate: 0,
    },
    phone: {
      totalCalls: 0,
      avgDuration: 0,
      appointmentsBooked: 0,
      conversionRate: 0,
    },
    quotes: {
      total: 0,
      sent: 0,
      accepted: 0,
      conversionRate: 0,
      avgValue: 0,
    },
    reviews: {
      total: 0,
      sent: 0,
      received: 0,
      avgRating: 0,
    },
  };
}

export async function GET(request: NextRequest) {
  // Validate query parameters
  const { searchParams } = new URL(request.url);
  const parseResult = AnalyticsQuerySchema.safeParse({
    range: searchParams.get('range') || '30d',
  });

  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid parameters', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const { range } = parseResult.data;

  // Calculate date range
  const now = new Date();
  let startDate: Date;
  let lastPeriodStart: Date;
  let lastPeriodEnd: Date;

  switch (range) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      lastPeriodStart = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      lastPeriodEnd = new Date(startDate.getTime());
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      lastPeriodStart = new Date(startDate.getTime() - 90 * 24 * 60 * 60 * 1000);
      lastPeriodEnd = new Date(startDate.getTime());
      break;
    case '1y':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      lastPeriodStart = new Date(startDate.getTime() - 365 * 24 * 60 * 60 * 1000);
      lastPeriodEnd = new Date(startDate.getTime());
      break;
    default: // 30d
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      lastPeriodStart = new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      lastPeriodEnd = new Date(startDate.getTime());
  }

  // Return empty data structure if Supabase is not configured
  if (!supabase) {
    console.warn('Analytics: Supabase not configured, returning empty data');
    return NextResponse.json(getEmptyAnalytics());
  }

  try {
    // Fetch all relevant data in parallel
    const [
      jobData,
      customerData,
      paymentData,
      callData,
      quoteData,
      reviewData,
      lastPeriodJobData,
      lastPeriodPaymentData,
    ] = await Promise.all([
      // Jobs this period
      supabase
        .from('jobs')
        .select('id, status, total_estimate_cents, total_invoice_cents, paid_cents, created_at, completed_at, customer_id')
        .gte('created_at', startDate.toISOString())
        .eq('deleted', false),

      // Customers
      supabase
        .from('customers')
        .select('id, created_at')
        .eq('deleted', false),

      // Payments this period
      supabase
        .from('payments')
        .select('id, amount_cents, status, created_at')
        .gte('created_at', startDate.toISOString())
        .eq('status', 'succeeded')
        .eq('deleted', false),

      // Call logs this period
      supabase
        .from('call_logs')
        .select('id, duration_seconds, related_job_id, direction, created_at')
        .gte('created_at', startDate.toISOString())
        .eq('deleted', false),

      // Quotes this period (use line_items to calculate quote totals)
      supabase
        .from('line_items')
        .select('id, job_id, kind, total_cents, created_at')
        .eq('kind', 'estimate')
        .gte('created_at', startDate.toISOString())
        .eq('deleted', false),

      // Review requests this period
      supabase
        .from('review_requests')
        .select('id, sent_at, clicked_at, completed_at, created_at')
        .gte('created_at', startDate.toISOString()),

      // Jobs last period (for comparison)
      supabase
        .from('jobs')
        .select('id, paid_cents')
        .gte('created_at', lastPeriodStart.toISOString())
        .lt('created_at', lastPeriodEnd.toISOString())
        .eq('deleted', false),

      // Payments last period (for comparison)
      supabase
        .from('payments')
        .select('amount_cents')
        .gte('created_at', lastPeriodStart.toISOString())
        .lt('created_at', lastPeriodEnd.toISOString())
        .eq('status', 'succeeded')
        .eq('deleted', false),
    ]);

    // Process job data
    const jobs = jobData.data || [];
    const completedJobs = jobs.filter(j => j.status === 'completed');
    const pendingJobs = jobs.filter(j => j.status === 'scheduled' || j.status === 'in_progress');
    const totalJobValue = jobs.reduce((sum, j) => sum + (j.total_invoice_cents || j.total_estimate_cents || 0), 0);

    // Process payment data
    const payments = paymentData.data || [];
    const thisMonthRevenue = payments.reduce((sum, p) => sum + (p.amount_cents || 0), 0);

    // Process last period data
    const lastPeriodPayments = lastPeriodPaymentData.data || [];
    const lastMonthRevenue = lastPeriodPayments.reduce((sum, p) => sum + (p.amount_cents || 0), 0);

    // Calculate growth
    const growth = lastMonthRevenue > 0
      ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 1000) / 10
      : thisMonthRevenue > 0 ? 100 : 0;

    // Process customer data
    const customers = customerData.data || [];
    const newCustomers = customers.filter(c => new Date(c.created_at) >= startDate);
    const uniqueCustomerIds = new Set(jobs.map(j => j.customer_id).filter(Boolean));
    const returningCustomers = customers.filter(c => 
      uniqueCustomerIds.has(c.id) && new Date(c.created_at) < startDate
    );
    const retentionRate = customers.length > 0
      ? Math.round((returningCustomers.length / customers.length) * 1000) / 10
      : 0;

    // Process call data
    const calls = callData.data || [];
    const callsWithBookings = calls.filter(c => c.related_job_id);
    const avgDuration = calls.length > 0
      ? Math.round(calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / calls.length)
      : 0;

    // Process quote data (line items with kind='estimate')
    const quoteItems = quoteData.data || [];
    const quoteJobIds = new Set(quoteItems.map(q => q.job_id));
    const quotedJobs = jobs.filter(j => quoteJobIds.has(j.id));
    const acceptedQuotes = quotedJobs.filter(j => j.status === 'completed' || j.total_invoice_cents > 0);
    const quoteConversionRate = quotedJobs.length > 0
      ? Math.round((acceptedQuotes.length / quotedJobs.length) * 1000) / 10
      : 0;
    const avgQuoteValue = quotedJobs.length > 0
      ? Math.round(quotedJobs.reduce((sum, j) => sum + (j.total_estimate_cents || 0), 0) / quotedJobs.length)
      : 0;

    // Process review data
    const reviewRequests = reviewData.data || [];
    const sentRequests = reviewRequests.filter(r => r.sent_at);
    const receivedReviews = reviewRequests.filter(r => r.completed_at);

    // Calculate revenue by source (based on job source if available, otherwise categorize by channel)
    const revenueBySource: { source: string; amount: number; percentage: number }[] = [];
    
    // Categorize revenue by how the job was created
    const phoneBookingRevenue = jobs
      .filter(j => calls.some(c => c.related_job_id === j.id))
      .reduce((sum, j) => sum + (j.paid_cents || 0), 0);
    
    const quoteConversionRevenue = acceptedQuotes
      .reduce((sum, j) => sum + (j.paid_cents || 0), 0);
    
    const directRevenue = thisMonthRevenue - phoneBookingRevenue - quoteConversionRevenue;

    if (phoneBookingRevenue > 0) {
      revenueBySource.push({
        source: 'Phone AI Bookings',
        amount: phoneBookingRevenue,
        percentage: Math.round((phoneBookingRevenue / thisMonthRevenue) * 1000) / 10,
      });
    }
    if (quoteConversionRevenue > 0) {
      revenueBySource.push({
        source: 'Quote Conversions',
        amount: quoteConversionRevenue,
        percentage: Math.round((quoteConversionRevenue / thisMonthRevenue) * 1000) / 10,
      });
    }
    if (directRevenue > 0) {
      revenueBySource.push({
        source: 'Direct / Walk-in',
        amount: directRevenue,
        percentage: Math.round((directRevenue / thisMonthRevenue) * 1000) / 10,
      });
    }

    // Sort by amount descending
    revenueBySource.sort((a, b) => b.amount - a.amount);

    return NextResponse.json({
      revenue: {
        total: thisMonthRevenue,
        thisMonth: thisMonthRevenue,
        lastMonth: lastMonthRevenue,
        growth,
        bySource: revenueBySource,
      },
      jobs: {
        total: jobs.length,
        completed: completedJobs.length,
        pending: pendingJobs.length,
        completionRate: jobs.length > 0 ? Math.round((completedJobs.length / jobs.length) * 100) : 0,
        avgValue: jobs.length > 0 ? Math.round(totalJobValue / jobs.length) : 0,
      },
      customers: {
        total: customers.length,
        new: newCustomers.length,
        returning: returningCustomers.length,
        retentionRate,
      },
      phone: {
        totalCalls: calls.length,
        avgDuration,
        appointmentsBooked: callsWithBookings.length,
        conversionRate: calls.length > 0
          ? Math.round((callsWithBookings.length / calls.length) * 1000) / 10
          : 0,
      },
      quotes: {
        total: quotedJobs.length,
        sent: quotedJobs.length,
        accepted: acceptedQuotes.length,
        conversionRate: quoteConversionRate,
        avgValue: avgQuoteValue,
      },
      reviews: {
        total: receivedReviews.length,
        sent: sentRequests.length,
        received: receivedReviews.length,
        avgRating: 0, // Would need to query reviews table with ratings
      },
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
