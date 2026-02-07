/**
 * Recurring Jobs API
 * ==================
 * Manage recurring job templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { recurringJobsService, type RecurringJobTemplate } from '@packages/services/recurring-jobs';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * GET /api/recurring-jobs
 * Get all recurring job templates
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get('active') !== 'false';
  const customerId = searchParams.get('customerId');

  try {
    let templates: RecurringJobTemplate[];

    if (customerId) {
      templates = await recurringJobsService.getCustomerRecurringJobs(customerId);
    } else {
      templates = await recurringJobsService.getTemplates(activeOnly);
    }

    const stats = await recurringJobsService.getStats();

    return NextResponse.json({
      templates,
      stats,
    });
  } catch (error: any) {
    console.error('[Recurring Jobs API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch recurring jobs' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/recurring-jobs
 * Create a new recurring job template
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate required fields
    if (!body.customer_id || !body.service_category || !body.frequency) {
      return NextResponse.json(
        { error: 'Missing required fields: customer_id, service_category, frequency' },
        { status: 400 }
      );
    }

    // Calculate initial next_scheduled_date if not provided
    if (!body.next_scheduled_date) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7); // Default to 1 week from now
      body.next_scheduled_date = startDate.toISOString().split('T')[0];
    }

    // Get customer name if not provided
    if (!body.customer_name && body.customer_id) {
      const supabase = createAdminClient();
      const { data: customer } = await supabase
        .from('customers')
        .select('name')
        .eq('id', body.customer_id)
        .single();
      body.customer_name = customer?.name;
    }

    const result = await recurringJobsService.createTemplate({
      customer_id: body.customer_id,
      customer_name: body.customer_name,
      service_category: body.service_category,
      description: body.description || '',
      address: body.address,
      city: body.city,
      zip_code: body.zip_code,
      assigned_technician_id: body.assigned_technician_id,
      quoted_amount: body.quoted_amount,
      frequency: body.frequency,
      day_of_week: body.day_of_week,
      day_of_month: body.day_of_month,
      preferred_time: body.preferred_time,
      notes: body.notes,
      is_active: body.is_active !== false,
      next_scheduled_date: body.next_scheduled_date,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      templateId: result.templateId,
    });
  } catch (error: any) {
    console.error('[Recurring Jobs API] Create error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create recurring job template' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/recurring-jobs
 * Update a recurring job template
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { templateId, ...updates } = body;

    if (!templateId) {
      return NextResponse.json(
        { error: 'templateId is required' },
        { status: 400 }
      );
    }

    const result = await recurringJobsService.updateTemplate(templateId, updates);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Recurring Jobs API] Update error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update recurring job template' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/recurring-jobs
 * Delete a recurring job template
 */
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const templateId = searchParams.get('templateId');

  if (!templateId) {
    return NextResponse.json(
      { error: 'templateId is required' },
      { status: 400 }
    );
  }

  try {
    const result = await recurringJobsService.deleteTemplate(templateId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Recurring Jobs API] Delete error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete recurring job template' },
      { status: 500 }
    );
  }
}
