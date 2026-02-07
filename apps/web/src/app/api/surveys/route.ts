/**
 * Surveys API
 * ===========
 * Manage customer satisfaction surveys
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';
import crypto from 'crypto';

export const runtime = 'nodejs';

// Validation schemas
const SurveyCreateSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID'),
  job_id: z.string().uuid().optional().nullable(),
  template_id: z.string().max(100).optional().nullable(),
  type: z.enum(['post_job', 'nps', 'custom']).default('post_job'),
  questions: z.array(z.object({
    id: z.string(),
    type: z.enum(['rating', 'nps', 'text', 'multiselect', 'yesno']),
    question: z.string(),
    required: z.boolean().default(false),
    order: z.number().int(),
    options: z.array(z.string()).optional(),
  })).optional(),
});

const SurveyUpdateSchema = z.object({
  id: z.string().uuid().optional(),
  token: z.string().max(64).optional(),
  status: z.enum(['pending', 'sent', 'viewed', 'completed', 'expired']).optional(),
  responses: z.array(z.object({
    question_id: z.string(),
    answer: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  })).optional(),
  overall_rating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  nps_score: z.coerce.number().int().min(0).max(10).optional().nullable(),
  feedback: z.string().max(5000).optional().nullable(),
}).refine(
  (data) => data.id || data.token,
  { message: 'Either id or token is required' }
);

const SurveyQuerySchema = z.object({
  status: z.string().optional(),
  customer_id: z.string().uuid().optional(),
  job_id: z.string().uuid().optional(),
  technician_id: z.string().uuid().optional(),
  templates: z.enum(['true', 'false']).optional(),
  stats: z.enum(['true', 'false']).optional(),
});

// Default survey templates
type SurveyQuestionType = 'rating' | 'nps' | 'text' | 'multiselect' | 'yesno';
interface SurveyQuestion {
  id: string;
  type: SurveyQuestionType;
  question: string;
  required: boolean;
  order: number;
  options?: string[];
}
interface SurveyTemplate {
  id: string;
  name: string;
  type: string;
  description: string;
  is_default: boolean;
  questions: SurveyQuestion[];
}

const DEFAULT_TEMPLATES: SurveyTemplate[] = [
  {
    id: 'post-job-standard',
    name: 'Post-Job Survey (Standard)',
    type: 'post_job',
    description: 'Standard feedback survey sent after job completion',
    is_default: true,
    questions: [
      { id: 'q1', type: 'rating', question: 'How would you rate the overall quality of service?', required: true, order: 1 },
      { id: 'q2', type: 'rating', question: 'How would you rate our technician\'s professionalism?', required: true, order: 2 },
      { id: 'q3', type: 'rating', question: 'How would you rate the timeliness of our service?', required: true, order: 3 },
      { id: 'q4', type: 'rating', question: 'How would you rate the value for money?', required: true, order: 4 },
      { id: 'q5', type: 'nps', question: 'How likely are you to recommend us?', required: true, order: 5 },
      { id: 'q6', type: 'text', question: 'What did we do well?', required: false, order: 6 },
      { id: 'q7', type: 'text', question: 'What could we improve?', required: false, order: 7 },
    ],
  },
  {
    id: 'post-job-quick',
    name: 'Post-Job Survey (Quick)',
    type: 'post_job',
    description: 'Short 3-question survey for quick feedback',
    is_default: false,
    questions: [
      { id: 'q1', type: 'rating', question: 'How satisfied are you with our service?', required: true, order: 1 },
      { id: 'q2', type: 'nps', question: 'How likely are you to recommend us?', required: true, order: 2 },
      { id: 'q3', type: 'text', question: 'Any additional comments?', required: false, order: 3 },
    ],
  },
  {
    id: 'nps-only',
    name: 'NPS Survey',
    type: 'nps',
    description: 'Single question Net Promoter Score survey',
    is_default: false,
    questions: [
      { id: 'q1', type: 'nps', question: 'How likely are you to recommend our services?', required: true, order: 1 },
      { id: 'q2', type: 'text', question: 'What is the reason for your score?', required: false, order: 2 },
    ],
  },
];

/**
 * GET /api/surveys
 * Get surveys or templates
 */
export async function GET(req: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);

  // Validate query params
  const queryResult = SurveyQuerySchema.safeParse({
    status: searchParams.get('status') || undefined,
    customer_id: searchParams.get('customer_id') || undefined,
    job_id: searchParams.get('job_id') || undefined,
    technician_id: searchParams.get('technician_id') || undefined,
    templates: searchParams.get('templates') || undefined,
    stats: searchParams.get('stats') || undefined,
  });

  if (!queryResult.success) {
    return NextResponse.json(
      { error: 'Invalid parameters', details: queryResult.error.flatten() },
      { status: 400 }
    );
  }

  const { status, customer_id, job_id, technician_id, templates, stats } = queryResult.data;

  // Return templates if requested
  if (templates === 'true') {
    return NextResponse.json({ templates: DEFAULT_TEMPLATES });
  }

  // Return stats if requested
  if (stats === 'true') {
    try {
      const { data: surveys } = await supabase
        .from('surveys')
        .select('status, overall_rating, nps_score')
        .eq('deleted', false);

      const allSurveys = surveys || [];
      const completed = allSurveys.filter(s => s.status === 'completed');
      const withRatings = completed.filter(s => s.overall_rating != null);
      const withNps = completed.filter(s => s.nps_score != null);

      return NextResponse.json({
        stats: {
          total: allSurveys.length,
          pending: allSurveys.filter(s => s.status === 'pending').length,
          sent: allSurveys.filter(s => s.status === 'sent').length,
          completed: completed.length,
          responseRate: allSurveys.length > 0 ? Math.round((completed.length / allSurveys.length) * 100) : 0,
          avgRating: withRatings.length > 0
            ? Math.round(withRatings.reduce((sum, s) => sum + (s.overall_rating || 0), 0) / withRatings.length * 10) / 10
            : 0,
          avgNps: withNps.length > 0
            ? Math.round(withNps.reduce((sum, s) => sum + (s.nps_score || 0), 0) / withNps.length * 10) / 10
            : 0,
          npsBreakdown: {
            promoters: withNps.filter(s => (s.nps_score || 0) >= 9).length,
            passives: withNps.filter(s => (s.nps_score || 0) >= 7 && (s.nps_score || 0) < 9).length,
            detractors: withNps.filter(s => (s.nps_score || 0) < 7).length,
          },
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Surveys API] Stats error:', errorMessage);
      return NextResponse.json(
        { error: 'Failed to fetch stats', message: errorMessage },
        { status: 500 }
      );
    }
  }

  try {
    let query = supabase
      .from('surveys')
      .select(`
        *,
        customers(name, email),
        jobs(title, assigned_to, team_members(full_name))
      `)
      .eq('deleted', false)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }
    if (customer_id) {
      query = query.eq('customer_id', customer_id);
    }
    if (job_id) {
      query = query.eq('job_id', job_id);
    }
    if (technician_id) {
      query = query.eq('technician_id', technician_id);
    }

    const { data: surveys, error } = await query.limit(50);

    if (error) throw error;

    // Transform to include related data
    const transformedSurveys = (surveys || []).map(s => ({
      ...s,
      customer_name: (s.customers as any)?.name || null,
      customer_email: (s.customers as any)?.email || null,
      job_title: (s.jobs as any)?.title || null,
      technician_name: (s.jobs as any)?.team_members?.full_name || null,
      customers: undefined,
      jobs: undefined,
    }));

    return NextResponse.json({ surveys: transformedSurveys });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Surveys API] Error:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to fetch surveys', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST /api/surveys
 * Create a new survey
 */
export async function POST(req: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await req.json();

    // Validate input
    const parseResult = SurveyCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const validatedData = parseResult.data;

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');

    // Set expiry (2 weeks)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    // Get questions from template if not provided
    let questions = validatedData.questions;
    if (!questions && validatedData.template_id) {
      const template = DEFAULT_TEMPLATES.find(t => t.id === validatedData.template_id);
      if (template) {
        questions = template.questions;
      }
    }
    if (!questions) {
      // Use default template
      questions = DEFAULT_TEMPLATES[0].questions;
    }

    const { data, error } = await supabase
      .from('surveys')
      .insert({
        customer_id: validatedData.customer_id,
        job_id: validatedData.job_id,
        type: validatedData.type,
        status: 'pending',
        questions,
        token,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id, token')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      id: data.id,
      token: data.token,
      public_url: `/survey/${data.token}`,
    }, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Surveys API] Create error:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to create survey', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/surveys
 * Update a survey (status, responses, etc.)
 */
export async function PATCH(req: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await req.json();

    // Validate input
    const parseResult = SurveyUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { id, token, ...updates } = parseResult.data;

    // Add timestamps based on status
    const updateData: Record<string, unknown> = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (updates.status === 'sent' && !body.sent_at) {
      updateData.sent_at = new Date().toISOString();
    }
    if (updates.status === 'viewed' && !body.viewed_at) {
      updateData.viewed_at = new Date().toISOString();
    }
    if (updates.status === 'completed' && !body.completed_at) {
      updateData.completed_at = new Date().toISOString();
    }

    // Calculate overall rating from responses if completing
    if (updates.responses && updates.status === 'completed') {
      const ratingResponses = updates.responses.filter(
        r => typeof r.answer === 'number' && r.question_id.startsWith('q') && !r.question_id.includes('nps')
      );
      if (ratingResponses.length > 0) {
        const avgRating = ratingResponses.reduce((sum, r) => sum + (r.answer as number), 0) / ratingResponses.length;
        updateData.overall_rating = Math.round(avgRating * 10) / 10;
      }

      // Extract NPS score
      const npsResponse = updates.responses.find(r => r.question_id.includes('nps') || r.question_id === 'q5');
      if (npsResponse && typeof npsResponse.answer === 'number') {
        updateData.nps_score = npsResponse.answer;
      }
    }

    let query = supabase.from('surveys').update(updateData);

    if (id) {
      query = query.eq('id', id);
    } else if (token) {
      query = query.eq('token', token);
    }

    const { error } = await query.eq('deleted', false);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Surveys API] Update error:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to update survey', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/surveys
 * Soft delete a survey
 */
export async function DELETE(req: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Survey ID is required' }, { status: 400 });
  }

  const uuidResult = z.string().uuid().safeParse(id);
  if (!uuidResult.success) {
    return NextResponse.json({ error: 'Invalid survey ID format' }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from('surveys')
      .update({
        deleted: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Surveys API] Delete error:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to delete survey', message: errorMessage },
      { status: 500 }
    );
  }
}
