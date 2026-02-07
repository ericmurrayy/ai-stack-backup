/**
 * Murray's FSM - AI Engine
 * ========================
 * Universal AI engine supporting multiple providers:
 * - Anthropic Claude (cloud)
 * - OpenAI GPT (cloud)
 * - Ollama (local, free)
 * - Custom endpoints
 *
 * Features:
 * - Call transcript analysis
 * - Lead scoring and qualification
 * - Smart job routing and scheduling
 * - Automated response generation
 * - Spam detection
 * - Service categorization
 * - Customer sentiment analysis
 */

// Types
export type AIProvider = 'anthropic' | 'openai' | 'ollama' | 'custom'

export interface AIConfig {
  provider: AIProvider
  model: string
  apiKey?: string
  baseUrl?: string
  temperature?: number
  maxTokens?: number
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIResponse {
  content: string
  model: string
  provider: AIProvider
  tokensUsed?: number
  latencyMs: number
}

export interface CallAnalysis {
  isSpam: boolean
  spamConfidence: number
  intent: CallIntent
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent'
  serviceCategory: ServiceCategory
  extractedInfo: ExtractedInfo
  suggestedActions: SuggestedAction[]
  summary: string
  urgency: 'low' | 'medium' | 'high' | 'emergency'
}

export type CallIntent =
  | 'schedule_repair'
  | 'get_quote'
  | 'emergency_service'
  | 'follow_up'
  | 'complaint'
  | 'general_inquiry'
  | 'cancel_appointment'
  | 'reschedule'
  | 'payment_inquiry'
  | 'warranty_claim'
  | 'spam'
  | 'unknown'

export type ServiceCategory =
  | 'spring_repair'
  | 'spring_replacement'
  | 'opener_repair'
  | 'opener_installation'
  | 'panel_replacement'
  | 'cable_repair'
  | 'track_repair'
  | 'roller_replacement'
  | 'weatherseal'
  | 'new_door_installation'
  | 'maintenance'
  | 'inspection'
  | 'emergency'
  | 'other'

export interface ExtractedInfo {
  customerName?: string
  phoneNumber?: string
  email?: string
  address?: string
  city?: string
  state?: string
  doorType?: string
  doorBrand?: string
  problemDescription?: string
  preferredDate?: string
  preferredTime?: string
  isExistingCustomer?: boolean
  referralSource?: string
}

export interface SuggestedAction {
  type: 'create_job' | 'create_customer' | 'schedule' | 'send_quote' | 'send_sms' | 'flag_review' | 'no_action'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  description: string
  data?: Record<string, unknown>
}

export interface LeadScore {
  score: number // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  factors: LeadFactor[]
  recommendedAction: string
}

export interface LeadFactor {
  name: string
  impact: number // -20 to +20
  reason: string
}

// Default configurations for each provider
const PROVIDER_DEFAULTS: Record<AIProvider, Partial<AIConfig>> = {
  anthropic: {
    model: 'claude-sonnet-4-20250514',
    baseUrl: 'https://api.anthropic.com',
    maxTokens: 4096,
    temperature: 0.3,
  },
  openai: {
    model: 'gpt-4o',
    baseUrl: 'https://api.openai.com/v1',
    maxTokens: 4096,
    temperature: 0.3,
  },
  ollama: {
    model: 'llama3.2:latest',
    baseUrl: 'http://localhost:11434',
    maxTokens: 4096,
    temperature: 0.3,
  },
  custom: {
    model: 'default',
    maxTokens: 4096,
    temperature: 0.3,
  },
}

// System prompts
const SYSTEM_PROMPTS = {
  callAnalysis: `You are an AI assistant for Murray's Garage Door Services in Chelmsford, MA.
Analyze phone call transcripts and extract structured information.

Murray's serves 100+ towns across Middlesex and Worcester counties.
Services: garage door spring repair/replacement, opener installation/repair, panel replacement,
cable repair, track alignment, roller replacement, weathersealing, new door installation,
maintenance plans, and emergency service.

Business hours: Mon-Fri 7am-6pm, Saturday 8am-2pm. Emergency service available 24/7.

Return your analysis as JSON with this exact structure:
{
  "isSpam": boolean,
  "spamConfidence": number (0-1),
  "intent": "schedule_repair" | "get_quote" | "emergency_service" | "follow_up" | "complaint" | "general_inquiry" | "cancel_appointment" | "reschedule" | "payment_inquiry" | "warranty_claim" | "spam" | "unknown",
  "sentiment": "positive" | "neutral" | "negative" | "urgent",
  "serviceCategory": "spring_repair" | "spring_replacement" | "opener_repair" | "opener_installation" | "panel_replacement" | "cable_repair" | "track_repair" | "roller_replacement" | "weatherseal" | "new_door_installation" | "maintenance" | "inspection" | "emergency" | "other",
  "extractedInfo": {
    "customerName": string or null,
    "phoneNumber": string or null,
    "email": string or null,
    "address": string or null,
    "city": string or null,
    "state": string or null,
    "doorType": string or null,
    "doorBrand": string or null,
    "problemDescription": string or null,
    "preferredDate": string or null,
    "preferredTime": string or null,
    "isExistingCustomer": boolean or null,
    "referralSource": string or null
  },
  "suggestedActions": [
    {
      "type": "create_job" | "create_customer" | "schedule" | "send_quote" | "send_sms" | "flag_review" | "no_action",
      "priority": "low" | "medium" | "high" | "urgent",
      "description": string,
      "data": object or null
    }
  ],
  "summary": string (2-3 sentence summary),
  "urgency": "low" | "medium" | "high" | "emergency"
}`,

  leadScoring: `You are a lead scoring AI for Murray's Garage Door Services.
Score leads from 0-100 based on:
- Urgency (broken spring = high, maintenance = low)
- Service value (new door installation > roller replacement)
- Customer readiness (has date preference = ready)
- Location (in service area = bonus)
- Referral (word of mouth = bonus)

Return JSON:
{
  "score": number (0-100),
  "grade": "A" | "B" | "C" | "D" | "F",
  "factors": [{"name": string, "impact": number, "reason": string}],
  "recommendedAction": string
}`,

  responseGeneration: `You are a professional and friendly SMS/email response generator for Murray's Garage Door Services.
Generate concise, professional responses. Keep SMS under 160 characters when possible.
Include relevant details: pricing ranges, availability, next steps.
Murray's tone: professional, knowledgeable, friendly, local-business feel.
Owner: Eric Murray. Phone: 978-758-0690.`,

  chatAssistant: `You are Murray's AI Assistant, helping manage a garage door service business.
You can help with:
- Reviewing pending actions and approvals
- Analyzing call transcripts
- Generating quotes and invoices
- Scheduling jobs
- Customer lookup
- Business analytics
- Inventory management

Be concise, actionable, and business-focused. When suggesting actions,
always note they require approval before execution.`,
}

/**
 * Universal AI completion function
 */
export async function aiComplete(
  messages: AIMessage[],
  config?: Partial<AIConfig>
): Promise<AIResponse> {
  // Determine provider from config or environment
  const provider = config?.provider || getDefaultProvider()
  const defaults = PROVIDER_DEFAULTS[provider]
  const fullConfig: AIConfig = {
    provider,
    model: config?.model || defaults.model || 'default',
    apiKey: config?.apiKey || getApiKey(provider),
    baseUrl: config?.baseUrl || defaults.baseUrl,
    temperature: config?.temperature ?? defaults.temperature ?? 0.3,
    maxTokens: config?.maxTokens ?? defaults.maxTokens ?? 4096,
  }

  const startTime = Date.now()

  switch (fullConfig.provider) {
    case 'anthropic':
      return callAnthropic(messages, fullConfig, startTime)
    case 'openai':
      return callOpenAI(messages, fullConfig, startTime)
    case 'ollama':
      return callOllama(messages, fullConfig, startTime)
    case 'custom':
      return callCustom(messages, fullConfig, startTime)
    default:
      throw new Error(`Unsupported AI provider: ${fullConfig.provider}`)
  }
}

/**
 * Anthropic Claude API
 */
async function callAnthropic(
  messages: AIMessage[],
  config: AIConfig,
  startTime: number
): Promise<AIResponse> {
  const systemMsg = messages.find(m => m.role === 'system')
  const nonSystemMsgs = messages.filter(m => m.role !== 'system')

  const response = await fetch(`${config.baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      system: systemMsg?.content || '',
      messages: nonSystemMsgs.map(m => ({
        role: m.role,
        content: m.content,
      })),
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Anthropic API error (${response.status}): ${err}`)
  }

  const data = await response.json()
  return {
    content: data.content?.[0]?.text || '',
    model: config.model,
    provider: 'anthropic',
    tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    latencyMs: Date.now() - startTime,
  }
}

/**
 * OpenAI API (GPT-4, etc.)
 */
async function callOpenAI(
  messages: AIMessage[],
  config: AIConfig,
  startTime: number
): Promise<AIResponse> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI API error (${response.status}): ${err}`)
  }

  const data = await response.json()
  return {
    content: data.choices?.[0]?.message?.content || '',
    model: config.model,
    provider: 'openai',
    tokensUsed: data.usage?.total_tokens || 0,
    latencyMs: Date.now() - startTime,
  }
}

/**
 * Ollama local API (free, runs locally)
 */
async function callOllama(
  messages: AIMessage[],
  config: AIConfig,
  startTime: number
): Promise<AIResponse> {
  const response = await fetch(`${config.baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      stream: false,
      options: {
        temperature: config.temperature,
        num_predict: config.maxTokens,
      },
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Ollama API error (${response.status}): ${err}`)
  }

  const data = await response.json()
  return {
    content: data.message?.content || '',
    model: config.model,
    provider: 'ollama',
    tokensUsed: data.eval_count || 0,
    latencyMs: Date.now() - startTime,
  }
}

/**
 * Custom endpoint (OpenAI-compatible)
 */
async function callCustom(
  messages: AIMessage[],
  config: AIConfig,
  startTime: number
): Promise<AIResponse> {
  if (!config.baseUrl) {
    throw new Error('Custom provider requires baseUrl')
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Custom API error (${response.status}): ${err}`)
  }

  const data = await response.json()
  return {
    content: data.choices?.[0]?.message?.content || '',
    model: config.model,
    provider: 'custom',
    tokensUsed: data.usage?.total_tokens || 0,
    latencyMs: Date.now() - startTime,
  }
}

// ============================================
// HIGH-LEVEL BUSINESS FUNCTIONS
// ============================================

/**
 * Analyze a phone call transcript
 */
export async function analyzeCallTranscript(
  transcript: string,
  metadata?: {
    callerPhone?: string
    direction?: 'inbound' | 'outbound'
    duration?: number
  },
  config?: Partial<AIConfig>
): Promise<CallAnalysis> {
  const context = metadata
    ? `Call metadata: ${metadata.direction || 'unknown'} call, ` +
      `from: ${metadata.callerPhone || 'unknown'}, ` +
      `duration: ${metadata.duration ? `${metadata.duration}s` : 'unknown'}\n\n`
    : ''

  const response = await aiComplete(
    [
      { role: 'system', content: SYSTEM_PROMPTS.callAnalysis },
      { role: 'user', content: `${context}Transcript:\n${transcript}` },
    ],
    config
  )

  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }
    return JSON.parse(jsonMatch[0]) as CallAnalysis
  } catch {
    // Return a safe default if parsing fails
    return {
      isSpam: false,
      spamConfidence: 0,
      intent: 'unknown',
      sentiment: 'neutral',
      serviceCategory: 'other',
      extractedInfo: {},
      suggestedActions: [
        {
          type: 'flag_review',
          priority: 'medium',
          description: 'AI could not fully analyze this transcript. Manual review recommended.',
        },
      ],
      summary: 'Transcript analysis inconclusive. Please review manually.',
      urgency: 'medium',
    }
  }
}

/**
 * Score a lead based on extracted information
 */
export async function scoreLead(
  info: ExtractedInfo,
  callAnalysis?: Partial<CallAnalysis>,
  config?: Partial<AIConfig>
): Promise<LeadScore> {
  const context = JSON.stringify({ extractedInfo: info, callAnalysis }, null, 2)

  const response = await aiComplete(
    [
      { role: 'system', content: SYSTEM_PROMPTS.leadScoring },
      { role: 'user', content: `Score this lead:\n${context}` },
    ],
    config
  )

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found')
    return JSON.parse(jsonMatch[0]) as LeadScore
  } catch {
    return {
      score: 50,
      grade: 'C',
      factors: [{ name: 'Parse Error', impact: 0, reason: 'Could not analyze lead' }],
      recommendedAction: 'Manual review recommended',
    }
  }
}

/**
 * Generate a professional response (SMS or email)
 */
export async function generateResponse(
  context: {
    type: 'sms' | 'email'
    customerName?: string
    inquiry?: string
    serviceNeeded?: string
    scheduledDate?: string
  },
  config?: Partial<AIConfig>
): Promise<string> {
  const prompt = `Generate a ${context.type} response for:
Customer: ${context.customerName || 'Customer'}
Inquiry: ${context.inquiry || 'General inquiry'}
Service: ${context.serviceNeeded || 'Not specified'}
${context.scheduledDate ? `Scheduled: ${context.scheduledDate}` : ''}
${context.type === 'sms' ? 'Keep under 160 characters.' : 'Keep professional and concise.'}`

  const response = await aiComplete(
    [
      { role: 'system', content: SYSTEM_PROMPTS.responseGeneration },
      { role: 'user', content: prompt },
    ],
    config
  )

  return response.content.trim()
}

/**
 * Chat with the AI assistant
 */
export async function chatWithAssistant(
  messages: AIMessage[],
  config?: Partial<AIConfig>
): Promise<AIResponse> {
  const fullMessages: AIMessage[] = [
    { role: 'system', content: SYSTEM_PROMPTS.chatAssistant },
    ...messages,
  ]

  return aiComplete(fullMessages, config)
}

/**
 * Detect spam from a call or message
 */
export async function detectSpam(
  content: string,
  type: 'call' | 'sms' | 'email',
  config?: Partial<AIConfig>
): Promise<{ isSpam: boolean; confidence: number; reason: string }> {
  const response = await aiComplete(
    [
      {
        role: 'system',
        content: `You are a spam detection AI for a garage door service business.
Analyze ${type} content and determine if it's spam.
Return JSON: {"isSpam": boolean, "confidence": number (0-1), "reason": string}
Common spam: robo-calls, SEO services, loan offers, insurance, political.
Legitimate: anything about garage doors, home repair, scheduling, existing customers.`,
      },
      { role: 'user', content },
    ],
    { ...config, temperature: 0.1 }
  )

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON')
    return JSON.parse(jsonMatch[0])
  } catch {
    return { isSpam: false, confidence: 0, reason: 'Analysis failed' }
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getDefaultProvider(): AIProvider {
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic'
  if (process.env.OPENAI_API_KEY) return 'openai'
  if (process.env.OLLAMA_URL || process.env.OLLAMA_MODEL) return 'ollama'
  // Fallback to Ollama (free, local)
  return 'ollama'
}

function getApiKey(provider: AIProvider): string {
  switch (provider) {
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY || ''
    case 'openai':
      return process.env.OPENAI_API_KEY || ''
    case 'custom':
      return process.env.CUSTOM_AI_API_KEY || ''
    default:
      return ''
  }
}

/**
 * Get available AI providers (checks which API keys are configured)
 */
export function getAvailableProviders(): AIProvider[] {
  const providers: AIProvider[] = []
  if (process.env.ANTHROPIC_API_KEY) providers.push('anthropic')
  if (process.env.OPENAI_API_KEY) providers.push('openai')
  // Ollama is always potentially available (local)
  providers.push('ollama')
  return providers
}

/**
 * Test an AI provider connection
 */
export async function testProvider(
  config?: Partial<AIConfig>
): Promise<{ ok: boolean; provider: AIProvider; model: string; latencyMs: number; error?: string }> {
  try {
    const response = await aiComplete(
      [
        { role: 'system', content: 'You are a test assistant. Respond with "OK".' },
        { role: 'user', content: 'Test connection.' },
      ],
      config
    )
    return {
      ok: true,
      provider: response.provider,
      model: response.model,
      latencyMs: response.latencyMs,
    }
  } catch (error) {
    return {
      ok: false,
      provider: config?.provider || getDefaultProvider(),
      model: config?.model || 'unknown',
      latencyMs: 0,
      error: error instanceof Error ? error.message : 'Connection failed',
    }
  }
}
