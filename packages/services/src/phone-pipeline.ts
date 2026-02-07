/**
 * Murray's FSM - Phone Pipeline Service
 * ======================================
 * Complete call-to-job automation pipeline:
 *
 * 1. Phone call comes in (OpenPhone webhook)
 * 2. Transcript analyzed by AI
 * 3. Spam filtered
 * 4. Customer matched or created
 * 5. Lead scored
 * 6. Job created (pending approval)
 * 7. Suggested actions queued
 * 8. Notifications sent
 *
 * This is the #1 revenue driver for the business.
 */

import {
  analyzeCallTranscript,
  scoreLead,
  detectSpam,
  generateResponse,
  type CallAnalysis,
  type LeadScore,
  type AIConfig,
} from './ai-engine'

export interface IncomingCall {
  callId: string
  direction: 'inbound' | 'outbound'
  fromPhone: string
  toPhone: string
  startedAt: string
  endedAt?: string
  duration?: number
  transcript?: string
  recordingUrl?: string
  webhookSource: 'openphone' | 'beside' | 'twilio' | 'custom'
}

export interface PipelineResult {
  callId: string
  stage: PipelineStage
  analysis?: CallAnalysis
  leadScore?: LeadScore
  customerId?: string
  jobId?: string
  actions: PipelineAction[]
  errors: string[]
  processingTime: number
}

export type PipelineStage =
  | 'received'
  | 'transcribing'
  | 'analyzing'
  | 'scoring'
  | 'matching'
  | 'creating'
  | 'complete'
  | 'error'

export interface PipelineAction {
  type: string
  status: 'pending' | 'approved' | 'executed' | 'rejected'
  description: string
  data?: Record<string, unknown>
}

export interface SupabaseClient {
  from: (table: string) => {
    insert: (data: Record<string, unknown> | Record<string, unknown>[]) => { select: (cols?: string) => { single: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> } }
    update: (data: Record<string, unknown>) => { eq: (col: string, val: string) => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> }
    select: (cols?: string) => {
      eq: (col: string, val: unknown) => {
        single: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>
        limit: (n: number) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>
      }
      ilike: (col: string, val: string) => {
        limit: (n: number) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>
      }
    }
  }
}

/**
 * Process an incoming call through the full pipeline
 */
export async function processCall(
  call: IncomingCall,
  supabase: SupabaseClient,
  aiConfig?: Partial<AIConfig>
): Promise<PipelineResult> {
  const startTime = Date.now()
  const result: PipelineResult = {
    callId: call.callId,
    stage: 'received',
    actions: [],
    errors: [],
    processingTime: 0,
  }

  try {
    // Step 1: Log the call
    result.stage = 'received'
    await logCall(call, supabase)

    // Step 2: Check for transcript
    if (!call.transcript) {
      result.stage = 'transcribing'
      // If no transcript yet, queue for later processing
      result.actions.push({
        type: 'await_transcript',
        status: 'pending',
        description: 'Waiting for call transcript from phone provider',
      })
      result.processingTime = Date.now() - startTime
      return result
    }

    // Step 3: Spam detection (fast, cheap)
    const spamResult = await detectSpam(call.transcript, 'call', aiConfig)
    if (spamResult.isSpam && spamResult.confidence > 0.8) {
      await updateCallLog(call.callId, {
        is_spam: true,
        spam_confidence: spamResult.confidence,
        spam_reason: spamResult.reason,
      }, supabase)

      result.stage = 'complete'
      result.actions.push({
        type: 'no_action',
        status: 'executed',
        description: `Spam detected (${Math.round(spamResult.confidence * 100)}%): ${spamResult.reason}`,
      })
      result.processingTime = Date.now() - startTime
      return result
    }

    // Step 4: Full transcript analysis
    result.stage = 'analyzing'
    const analysis = await analyzeCallTranscript(
      call.transcript,
      {
        callerPhone: call.fromPhone,
        direction: call.direction,
        duration: call.duration,
      },
      aiConfig
    )
    result.analysis = analysis

    // Update call log with analysis
    await updateCallLog(call.callId, {
      summary: analysis.summary,
      intent: analysis.intent,
      sentiment: analysis.sentiment,
      service_category: analysis.serviceCategory,
      urgency: analysis.urgency,
      extracted_info: analysis.extractedInfo,
      is_spam: analysis.isSpam,
      spam_confidence: analysis.spamConfidence,
    }, supabase)

    // Step 5: Score the lead
    result.stage = 'scoring'
    const leadScore = await scoreLead(analysis.extractedInfo, analysis, aiConfig)
    result.leadScore = leadScore

    // Step 6: Match or create customer
    result.stage = 'matching'
    const customerId = await matchOrCreateCustomer(
      call.fromPhone,
      analysis.extractedInfo as unknown as Record<string, unknown>,
      supabase
    )
    result.customerId = customerId

    // Step 7: Create job if appropriate
    result.stage = 'creating'
    if (shouldCreateJob(analysis)) {
      const jobId = await createJobFromAnalysis(
        analysis,
        customerId,
        call.callId,
        leadScore,
        supabase
      )
      result.jobId = jobId

      result.actions.push({
        type: 'create_job',
        status: 'executed',
        description: `Job created: ${analysis.serviceCategory} - ${analysis.summary}`,
        data: { jobId },
      })
    }

    // Step 8: Queue suggested actions (approval-gated)
    for (const action of analysis.suggestedActions) {
      await queueAction(action, call.callId, result.customerId, result.jobId, supabase)
      result.actions.push({
        type: action.type,
        status: 'pending',
        description: action.description,
        data: action.data,
      })
    }

    // Step 9: Auto-respond if high urgency
    if (analysis.urgency === 'emergency' && call.direction === 'inbound') {
      const responseText = await generateResponse({
        type: 'sms',
        customerName: analysis.extractedInfo.customerName,
        inquiry: analysis.summary,
        serviceNeeded: analysis.serviceCategory,
      }, aiConfig)

      result.actions.push({
        type: 'send_sms',
        status: 'pending', // Still needs approval for emergency response
        description: `Auto-response queued: "${responseText}"`,
        data: { to: call.fromPhone, message: responseText },
      })
    }

    result.stage = 'complete'
  } catch (error) {
    result.stage = 'error'
    result.errors.push(error instanceof Error ? error.message : 'Unknown error')
  }

  result.processingTime = Date.now() - startTime
  return result
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function logCall(call: IncomingCall, supabase: SupabaseClient) {
  await supabase.from('call_logs').insert({
    external_id: call.callId,
    direction: call.direction,
    from_phone: call.fromPhone,
    to_phone: call.toPhone,
    started_at: call.startedAt,
    ended_at: call.endedAt,
    duration_seconds: call.duration,
    transcript: call.transcript,
    recording_url: call.recordingUrl,
    source: call.webhookSource,
    status: 'processing',
    created_at: new Date().toISOString(),
  }).select().single()
}

async function updateCallLog(
  callId: string,
  data: Record<string, unknown>,
  supabase: SupabaseClient
) {
  await supabase
    .from('call_logs')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('external_id', callId)
}

async function matchOrCreateCustomer(
  phone: string,
  info: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<string> {
  // Normalize phone number
  const normalizedPhone = normalizePhone(phone)

  // Try to find existing customer by phone
  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('phone', normalizedPhone)
    .maybeSingle()

  if (existing) {
    return existing.id as string
  }

  // Create new customer
  const { data: newCustomer } = await supabase
    .from('customers')
    .insert({
      name: (info.customerName as string) || `Caller ${normalizedPhone}`,
      phone: normalizedPhone,
      email: (info.email as string) || null,
      address: (info.address as string) || null,
      city: (info.city as string) || null,
      state: (info.state as string) || 'MA',
      source: 'phone_call',
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  return newCustomer?.id as string || ''
}

function shouldCreateJob(analysis: CallAnalysis): boolean {
  const jobIntents: string[] = [
    'schedule_repair',
    'get_quote',
    'emergency_service',
    'warranty_claim',
  ]
  return jobIntents.includes(analysis.intent) && !analysis.isSpam
}

async function createJobFromAnalysis(
  analysis: CallAnalysis,
  customerId: string,
  callId: string,
  leadScore: LeadScore,
  supabase: SupabaseClient
): Promise<string> {
  const { data: job } = await supabase
    .from('jobs')
    .insert({
      customer_id: customerId,
      title: `${formatServiceCategory(analysis.serviceCategory)} - ${analysis.extractedInfo.address || 'Address TBD'}`,
      description: analysis.summary,
      status: 'new',
      service_category: analysis.serviceCategory,
      urgency: analysis.urgency,
      source: 'phone_call',
      source_id: callId,
      lead_score: leadScore.score,
      lead_grade: leadScore.grade,
      address: analysis.extractedInfo.address || null,
      city: analysis.extractedInfo.city || null,
      scheduled_start: analysis.extractedInfo.preferredDate || null,
      notes: `AI Analysis: ${analysis.summary}\nLead Score: ${leadScore.score}/100 (${leadScore.grade})`,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  return job?.id as string || ''
}

async function queueAction(
  action: {
    type: string
    priority: string
    description: string
    data?: Record<string, unknown>
  },
  callId: string,
  customerId?: string,
  jobId?: string,
  supabase?: SupabaseClient
) {
  if (!supabase) return

  await supabase.from('action_queue').insert({
    kind: action.type,
    priority: action.priority,
    description: action.description,
    status: 'pending',
    source: 'ai_analysis',
    source_id: callId,
    customer_id: customerId || null,
    job_id: jobId || null,
    payload: action.data || {},
    created_at: new Date().toISOString(),
  }).select().single()
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return phone
}

function formatServiceCategory(category: string): string {
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
