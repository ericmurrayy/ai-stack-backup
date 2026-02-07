/**
 * Invoices API Route
 * ==================
 * Manage invoices - create, list, update
 */

import { NextRequest, NextResponse } from 'next/server';
import { invoicingService } from '@packages/services/invoicing';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET /api/invoices
 * List invoices or get stats
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
        const stats = await invoicingService.getStats();
        return NextResponse.json(stats);

      case 'overdue':
        const overdue = await invoicingService.getOverdueInvoices();
        return NextResponse.json({ invoices: overdue });

      default:
        // List invoices
        const status = searchParams.get('status');
        const limit = parseInt(searchParams.get('limit') || '50');

        let query = supabase
          .from('invoices')
          .select(`
            *,
            customer:customers(name, email, phone),
            job:jobs(title)
          `)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (status) {
          query = query.eq('status', status);
        }

        const { data: invoices, error } = await query;

        if (error) throw error;

        return NextResponse.json({ invoices });
    }
  } catch (error: any) {
    console.error('Invoices API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get invoices' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/invoices
 * Create new invoice or perform actions
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, jobId, invoiceId, items, customerId, taxRate, dueInDays } = body;

    switch (action) {
      case 'create':
        // Create invoice manually
        if (!customerId || !items?.length) {
          return NextResponse.json(
            { error: 'customerId and items are required' },
            { status: 400 }
          );
        }

        const newInvoice = await invoicingService.createInvoice({
          jobId: jobId || null,
          customerId,
          items,
          taxRate,
          dueInDays,
        });

        return NextResponse.json({ success: true, invoice: newInvoice });

      case 'create-from-job':
        // Auto-generate from completed job
        if (!jobId) {
          return NextResponse.json(
            { error: 'jobId is required' },
            { status: 400 }
          );
        }

        const jobInvoice = await invoicingService.createFromJob(jobId);
        if (!jobInvoice) {
          return NextResponse.json(
            { error: 'No items to invoice for this job' },
            { status: 400 }
          );
        }

        return NextResponse.json({ success: true, invoice: jobInvoice });

      case 'mark-paid':
        // Mark invoice as paid
        if (!invoiceId) {
          return NextResponse.json(
            { error: 'invoiceId is required' },
            { status: 400 }
          );
        }

        await invoicingService.markPaid(invoiceId, body.paymentMethod);
        return NextResponse.json({ success: true });

      case 'send-reminders':
        // Send reminders for overdue invoices
        const result = await invoicingService.sendReminders();
        return NextResponse.json({ success: true, ...result });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Invoices API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process invoice request' },
      { status: 500 }
    );
  }
}
