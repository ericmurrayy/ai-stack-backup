/**
 * Expenses API
 * ============
 * Manage business expenses
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'nodejs';

// Validation schemas
const ExpenseCreateSchema = z.object({
  category: z.string().min(1, 'Category is required').max(100),
  description: z.string().max(500).optional().nullable(),
  amount_cents: z.coerce.number().int().min(1, 'Amount must be greater than zero'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
  vendor: z.string().max(200).optional().nullable(),
  job_id: z.string().uuid().optional().nullable(),
  team_member_id: z.string().uuid().optional().nullable(),
  receipt_url: z.string().url().max(500).optional().nullable(),
  is_billable: z.boolean().default(false),
  is_reimbursable: z.boolean().default(false),
  notes: z.string().max(1000).optional().nullable(),
});

const ExpenseQuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d', '365d']).default('30d'),
  category: z.string().optional(),
});

/**
 * GET /api/expenses
 * List expenses with stats
 */
export async function GET(req: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);

  // Validate query parameters
  const queryResult = ExpenseQuerySchema.safeParse({
    range: searchParams.get('range') || '30d',
    category: searchParams.get('category') || undefined,
  });

  if (!queryResult.success) {
    return NextResponse.json(
      { error: 'Invalid parameters', details: queryResult.error.flatten() },
      { status: 400 }
    );
  }

  const { range, category } = queryResult.data;

  // Calculate date range
  const now = new Date();
  let startDate: Date;

  switch (range) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '365d':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default: // 30d
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  try {
    // Build query for expenses in range
    let query = supabase
      .from('expenses')
      .select(`
        *,
        jobs(id, title),
        team_members(id, full_name)
      `)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    const { data: expenses, error } = await query;

    if (error) throw error;

    // Calculate stats
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get this month's expenses
    const { data: thisMonthExpenses } = await supabase
      .from('expenses')
      .select('amount_cents, category')
      .gte('date', thisMonthStart.toISOString().split('T')[0]);

    // Get last month's expenses
    const { data: lastMonthExpenses } = await supabase
      .from('expenses')
      .select('amount_cents')
      .gte('date', lastMonthStart.toISOString().split('T')[0])
      .lte('date', lastMonthEnd.toISOString().split('T')[0]);

    // Calculate category totals for this month
    const categoryTotals = new Map<string, number>();
    (thisMonthExpenses || []).forEach((e) => {
      const cat = e.category || 'other';
      categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + (e.amount_cents || 0));
    });

    const byCategory = Array.from(categoryTotals.entries())
      .map(([cat, amount]) => ({ category: cat, amount: amount / 100 }))
      .sort((a, b) => b.amount - a.amount);

    // Transform expenses to include related data
    const transformedExpenses = (expenses || []).map((exp) => ({
      ...exp,
      amount: (exp.amount_cents || 0) / 100, // Convert to dollars for display
      job_title: (exp.jobs as any)?.title || null,
      team_member_name: (exp.team_members as any)?.full_name || null,
      jobs: undefined,
      team_members: undefined,
    }));

    const totalThisMonth = (thisMonthExpenses || []).reduce((sum, e) => sum + (e.amount_cents || 0), 0) / 100;
    const totalLastMonth = (lastMonthExpenses || []).reduce((sum, e) => sum + (e.amount_cents || 0), 0) / 100;

    return NextResponse.json({
      expenses: transformedExpenses,
      stats: {
        totalThisMonth,
        totalLastMonth,
        changePercent: totalLastMonth > 0 
          ? Math.round(((totalThisMonth - totalLastMonth) / totalLastMonth) * 100) 
          : 0,
        byCategory,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Expenses API] Error:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to fetch expenses', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST /api/expenses
 * Create new expense
 */
export async function POST(req: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await req.json();

    // Validate input
    const parseResult = ExpenseCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const validatedData = parseResult.data;

    const { data: expense, error } = await supabase
      .from('expenses')
      .insert({
        ...validatedData,
        date: validatedData.date || new Date().toISOString().split('T')[0],
        reimbursed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, id: expense.id }, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Expenses API] Create error:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to create expense', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/expenses
 * Update an expense
 */
export async function PATCH(req: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Expense ID is required' }, { status: 400 });
    }

    // Validate ID format
    const idResult = z.string().uuid().safeParse(id);
    if (!idResult.success) {
      return NextResponse.json({ error: 'Invalid expense ID format' }, { status: 400 });
    }

    // Validate updates
    const updateSchema = ExpenseCreateSchema.partial();
    const parseResult = updateSchema.safeParse(updates);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('expenses')
      .update({
        ...parseResult.data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Expenses API] Update error:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to update expense', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/expenses
 * Delete an expense
 */
export async function DELETE(req: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Expense ID is required' }, { status: 400 });
  }

  // Validate UUID
  const uuidResult = z.string().uuid().safeParse(id);
  if (!uuidResult.success) {
    return NextResponse.json({ error: 'Invalid expense ID format' }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Expenses API] Delete error:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to delete expense', message: errorMessage },
      { status: 500 }
    );
  }
}
