/**
 * AI Call Analysis Endpoint
 * =========================
 * Analyzes phone call transcripts using Claude to:
 * - Detect spam/robocalls
 * - Categorize service type
 * - Extract customer info
 * - Assess urgency
 * - Suggest job creation
 *
 * DB Tables: call_logs (ai_extraction JSONB), jobs, customers
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Service categories for garage door work
const SERVICE_CATEGORIES = [
  'spring_repair',
  'spring_replacement',
  'opener_repair',
  'opener_install',
  'panel_replacement',
  'cable_repair',
  'roller_replacement',
  'off_track',
  'tune_up',
  'new_door_install',
  'weather_seal',
  'general_repair',
  'inspection',
  'other',
] as const;

type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

interface CallAnalysis {
  is_spam: boolean;
  spam_reason?: string;
  is_service_call: boolean;
  service_category: ServiceCategory | null;
  urgency: 'emergency' | 'same_day' | 'this_week' | 'flexible';
  customer_info: {
    name: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
  };
  issue_summary: string;
  suggested_price_range: {
    low: number;
    high: number;
  } | null;
  recommended_action: 'create_job' | 'send_quote' | 'follow_up' | 'ignore';
  confidence: number;
  notes: string;
}

const ANALYSIS_PROMPT = `You are an AI assistant for Murray's Garage Door Services in Chelmsford, MA. Analyze this phone call transcript and extract structured information.

Murray's serves 100+ towns across Middlesex and Worcester counties in Massachusetts.

TASK: Analyze the transcript and return a JSON object with these fields:

{
  "is_spam": boolean - true if robocall, solicitation, wrong number, non-service inquiry
  "spam_reason": string | null - why it's spam (if applicable)
  "is_service_call": boolean - true if someone needs garage door service
  "service_category": string | null - one of: spring_repair, spring_replacement, opener_repair, opener_install, panel_replacement, cable_repair, roller_replacement, off_track, tune_up, new_door_install, weather_seal, general_repair, inspection, other
  "urgency": "emergency" | "same_day" | "this_week" | "flexible"
    - emergency: door won't close (security risk), car trapped, spring just broke with loud bang
    - same_day: door not working but secure, significant inconvenience
    - this_week: door working but noisy, slow, cosmetic issue
    - flexible: maintenance, quotes for future work
  "customer_info": {
    "name": string | null,
    "phone": string | null,
    "address": string | null,
    "city": string | null
  }
  "issue_summary": string - 1-2 sentence plain English summary of the problem
  "suggested_price_range": { "low": number, "high": number } | null - estimated price in CENTS based on:
    - Spring replacement: 18900-38900
    - Opener install: 35000-55000
    - Panel replacement: 25000-50000
    - Cable repair: 15000-25000
    - Roller replacement: 15000-25000
    - Off-track: 12500-22500
    - Tune-up: 8900-12900
    - New door: 80000-250000
    - Add 5000-10000 for emergency/after-hours
  "recommended_action": "create_job" | "send_quote" | "follow_up" | "ignore"
    - create_job: clear service need, ready to schedule
    - send_quote: wants pricing info, not ready to commit
    - follow_up: interested but needs callback or more info
    - ignore: spam or not a service call
  "confidence": number 0-1 - how confident you are in this analysis
  "notes": string - any additional context or recommendations for the dispatcher
}

Return ONLY the JSON object. No markdown, no explanation.`;

/**
 * POST /api/ai/analyze-call
 * Analyze a call transcript
 */
export async function POST(req: NextRequest) {
  try {
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'AI not configured - missing ANTHROPIC_API_KEY' },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { transcript, call_id, phone_number, caller_name } = body;

    if (!transcript || transcript.trim().length < 10) {
      return NextResponse.json(
        { error: 'Transcript is required and must be at least 10 characters' },
        { status: 400 }
      );
    }

    // Build context for the analysis
    let context = `PHONE CALL TRANSCRIPT:\n${transcript}`;
    if (phone_number) context += `\n\nCaller phone: ${phone_number}`;
    if (caller_name) context += `\nCaller name: ${caller_name}`;

    // Call Claude API
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: ANALYSIS_PROMPT,
      messages: [{ role: 'user', content: context }],
    });

    // Extract the text response
    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '';

    // Parse the JSON response
    let analysis: CallAnalysis;
    try {
      const jsonStr = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      analysis = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response:', responseText);
      return NextResponse.json(
        { error: 'AI returned invalid response format', raw: responseText },
        { status: 502 }
      );
    }

    // Store analysis in database if call_id provided
    let created_job_id: string | null = null;
    let customer_id: string | null = null;

    if (call_id) {
      const supabase = createAdminClient();

      // Update the call_logs record with AI extraction
      await supabase
        .from('call_logs')
        .update({
          ai_extraction: analysis,
          summary: analysis.issue_summary,
          action_items: analysis.recommended_action === 'ignore'
            ? []
            : [{ action: analysis.recommended_action, urgency: analysis.urgency }],
        })
        .eq('id', call_id);

      // If it's a real service call, create a job
      if (
        analysis.is_service_call &&
        !analysis.is_spam &&
        analysis.recommended_action === 'create_job'
      ) {
        // Look up or create customer
        if (phone_number) {
          const { data: existingCustomer } = await supabase
            .from('customers')
            .select('id')
            .eq('phone', phone_number)
            .single();

          if (existingCustomer) {
            customer_id = existingCustomer.id;
          } else if (analysis.customer_info.name) {
            const { data: newCustomer } = await supabase
              .from('customers')
              .insert({
                owner_id: process.env.DEFAULT_OWNER_ID || '00000000-0000-0000-0000-000000000000',
                name: analysis.customer_info.name,
                phone: phone_number,
                notes: `Auto-created from call analysis. ${analysis.issue_summary}`,
              })
              .select('id')
              .single();

            customer_id = newCustomer?.id || null;
          }
        }

        // Create job only if we have a customer
        if (customer_id) {
          const { data: job, error: jobError } = await supabase
            .from('jobs')
            .insert({
              owner_id: process.env.DEFAULT_OWNER_ID || '00000000-0000-0000-0000-000000000000',
              customer_id,
              title: `${formatCategory(analysis.service_category)} - ${analysis.customer_info.city || 'Location TBD'}`,
              service_type: analysis.service_category,
              problem_description: analysis.issue_summary,
              status: 'scheduled',
              internal_notes: `AI analysis (confidence: ${Math.round(analysis.confidence * 100)}%)\nUrgency: ${analysis.urgency}\n${analysis.notes}`,
              total_estimate_cents: analysis.suggested_price_range
                ? Math.round((analysis.suggested_price_range.low + analysis.suggested_price_range.high) / 2)
                : 0,
              diagnostics: {
                source: 'ai_call_analysis',
                call_id,
                urgency: analysis.urgency,
                price_range: analysis.suggested_price_range,
              },
            })
            .select('id')
            .single();

          if (job) {
            created_job_id = job.id;

            // Link the call to the job
            await supabase
              .from('call_logs')
              .update({ related_job_id: job.id })
              .eq('id', call_id);
          }

          if (jobError) {
            console.error('Failed to create job from call analysis:', jobError);
          }
        }
      }
    }

    return NextResponse.json({
      analysis,
      job_id: created_job_id,
      customer_id,
      model: message.model,
      usage: message.usage,
    });
  } catch (error: any) {
    console.error('AI call analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Call analysis failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/analyze-call
 * Get analysis for a specific call or recent analyses
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(req.url);
    const callId = searchParams.get('call_id');

    if (callId) {
      const { data: call, error } = await supabase
        .from('call_logs')
        .select('id, from_phone, transcript, ai_extraction, summary, related_job_id, created_at')
        .eq('id', callId)
        .single();

      if (error || !call) {
        return NextResponse.json({ error: 'Call not found' }, { status: 404 });
      }

      return NextResponse.json({ call });
    }

    // Get recent analyses
    const limit = parseInt(searchParams.get('limit') || '20');
    const { data: calls, error } = await supabase
      .from('call_logs')
      .select('id, from_phone, ai_extraction, summary, related_job_id, created_at')
      .not('ai_extraction', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ calls: calls || [] });
  } catch (error: any) {
    console.error('Get call analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get analyses' },
      { status: 500 }
    );
  }
}

/**
 * Format service category for display
 */
function formatCategory(category: string | null): string {
  if (!category) return 'Garage Door Service';

  const labels: Record<string, string> = {
    spring_repair: 'Spring Repair',
    spring_replacement: 'Spring Replacement',
    opener_repair: 'Opener Repair',
    opener_install: 'Opener Installation',
    panel_replacement: 'Panel Replacement',
    cable_repair: 'Cable Repair',
    roller_replacement: 'Roller Replacement',
    off_track: 'Off-Track Repair',
    tune_up: 'Tune-Up & Maintenance',
    new_door_install: 'New Door Installation',
    weather_seal: 'Weather Seal Replacement',
    general_repair: 'General Repair',
    inspection: 'Inspection',
    other: 'Garage Door Service',
  };

  return labels[category] || 'Garage Door Service';
}
