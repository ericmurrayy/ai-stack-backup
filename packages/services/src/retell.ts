/**
 * Retell AI Phone Service
 * =======================
 * Handles inbound/outbound calls for Murray's FSM
 *
 * Features:
 * - Answer incoming calls 24/7
 * - Book appointments
 * - Handle customer inquiries
 * - Transfer to human when needed
 *
 * Cost: ~$0.07/min
 * Docs: https://docs.retellai.com
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Use any for now until Supabase types are generated
type SupabaseClientAny = SupabaseClient<any, any, any>;

// Types
export interface RetellConfig {
  apiKey: string;
  agentId: string;
  webhookUrl: string;
}

export interface CallData {
  callId: string;
  phoneNumber: string;
  direction: 'inbound' | 'outbound';
  status: 'ringing' | 'in_progress' | 'completed' | 'failed';
  duration?: number;
  transcript?: string;
  summary?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  actionRequired?: boolean;
  bookedAppointment?: {
    date: string;
    time: string;
    service: string;
    customerName: string;
  };
}

export interface CreateCallParams {
  toNumber: string;
  fromNumber?: string;
  metadata?: Record<string, any>;
}

export interface RetellWebhookEvent {
  event: 'call.started' | 'call.ended' | 'call.analyzed' | 'call.transferred';
  call_id: string;
  data: Record<string, any>;
}

class RetellService {
  private apiKey: string;
  private agentId: string;
  private baseUrl = 'https://api.retellai.com/v2';
  private supabase: SupabaseClientAny | null = null;

  constructor() {
    this.apiKey = process.env.RETELL_API_KEY || '';
    this.agentId = process.env.RETELL_AGENT_ID || '';

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      this.supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
    }
  }

  /**
   * Check if Retell is configured
   */
  isConfigured(): boolean {
    return !!(this.apiKey && this.agentId);
  }

  /**
   * Create an outbound call
   */
  async createCall(params: CreateCallParams): Promise<CallData> {
    if (!this.isConfigured()) {
      throw new Error('Retell AI not configured. Set RETELL_API_KEY and RETELL_AGENT_ID');
    }

    const response = await fetch(`${this.baseUrl}/create-phone-call`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_id: this.agentId,
        to_number: params.toNumber,
        from_number: params.fromNumber || process.env.RETELL_PHONE_NUMBER,
        metadata: params.metadata,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Retell API error: ${error}`);
    }

    const data = await response.json();

    const callData: CallData = {
      callId: data.call_id,
      phoneNumber: params.toNumber,
      direction: 'outbound',
      status: 'ringing',
    };

    // Log to database
    await this.logCall(callData);

    return callData;
  }

  /**
   * Get call status and details
   */
  async getCall(callId: string): Promise<CallData> {
    const response = await fetch(`${this.baseUrl}/get-call/${callId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get call: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      callId: data.call_id,
      phoneNumber: data.to_number || data.from_number,
      direction: data.direction,
      status: data.status,
      duration: data.duration_seconds,
      transcript: data.transcript,
      summary: data.call_summary,
      sentiment: data.sentiment,
    };
  }

  /**
   * Handle webhook events from Retell
   */
  async handleWebhook(event: RetellWebhookEvent): Promise<void> {
    console.log(`[Retell] Webhook received: ${event.event}`, event.call_id);

    switch (event.event) {
      case 'call.started':
        await this.onCallStarted(event);
        break;
      case 'call.ended':
        await this.onCallEnded(event);
        break;
      case 'call.analyzed':
        await this.onCallAnalyzed(event);
        break;
      case 'call.transferred':
        await this.onCallTransferred(event);
        break;
    }
  }

  /**
   * Call started - log it
   */
  private async onCallStarted(event: RetellWebhookEvent): Promise<void> {
    const callData: CallData = {
      callId: event.call_id,
      phoneNumber: event.data.from_number || event.data.to_number,
      direction: event.data.direction || 'inbound',
      status: 'in_progress',
    };

    await this.logCall(callData);
  }

  /**
   * Call ended - update status
   */
  private async onCallEnded(event: RetellWebhookEvent): Promise<void> {
    if (!this.supabase) return;

    await this.supabase
      .from('ai_calls')
      .update({
        status: 'completed',
        duration_seconds: event.data.duration_seconds,
        ended_at: new Date().toISOString(),
      })
      .eq('call_id', event.call_id);
  }

  /**
   * Call analyzed - extract insights and actions
   */
  private async onCallAnalyzed(event: RetellWebhookEvent): Promise<void> {
    if (!this.supabase) return;

    const { data } = event;

    // Update call with analysis
    await this.supabase
      .from('ai_calls')
      .update({
        transcript: data.transcript,
        summary: data.call_summary,
        sentiment: data.sentiment,
        action_required: data.action_items?.length > 0,
        analysis: data,
      })
      .eq('call_id', event.call_id);

    // Check if appointment was booked
    if (data.appointment_booked) {
      await this.createJobFromCall(event.call_id, data);
    }

    // Check if follow-up needed
    if (data.action_items?.length > 0) {
      await this.createFollowUpTask(event.call_id, data.action_items);
    }
  }

  /**
   * Call transferred to human
   */
  private async onCallTransferred(event: RetellWebhookEvent): Promise<void> {
    if (!this.supabase) return;

    await this.supabase
      .from('ai_calls')
      .update({
        transferred: true,
        transfer_reason: event.data.reason,
      })
      .eq('call_id', event.call_id);

    // TODO: Send notification to Murray
  }

  /**
   * Create a job from a booked appointment
   */
  private async createJobFromCall(callId: string, data: Record<string, any>): Promise<void> {
    if (!this.supabase) return;

    // Get call details
    const { data: callRecord } = await this.supabase
      .from('ai_calls')
      .select('phone_number, customer_id')
      .eq('call_id', callId)
      .single();

    if (!callRecord) return;

    // Find or create customer
    let customerId = callRecord.customer_id;
    if (!customerId) {
      const { data: customer } = await this.supabase
        .from('customers')
        .select('id')
        .eq('phone', callRecord.phone_number)
        .single();

      customerId = customer?.id;
    }

    // Create the job
    const { data: job, error } = await this.supabase
      .from('jobs')
      .insert({
        customer_id: customerId,
        title: data.service_requested || 'Service Call',
        description: `Booked via AI phone call.\n\nSummary: ${data.call_summary}`,
        scheduled_date: data.appointment_date,
        scheduled_time: data.appointment_time,
        status: 'scheduled',
        source: 'ai_phone',
        ai_call_id: callId,
      })
      .select()
      .single();

    if (job) {
      console.log(`[Retell] Created job ${job.id} from call ${callId}`);

      // Update call with job reference
      await this.supabase
        .from('ai_calls')
        .update({ job_id: job.id })
        .eq('call_id', callId);
    }
  }

  /**
   * Create follow-up task for action items
   */
  private async createFollowUpTask(callId: string, actionItems: string[]): Promise<void> {
    if (!this.supabase) return;

    await this.supabase.from('ai_tasks').insert({
      type: 'follow_up',
      reference_type: 'call',
      reference_id: callId,
      title: 'Phone Call Follow-Up Required',
      description: actionItems.join('\n'),
      priority: 'high',
      status: 'pending',
    });
  }

  /**
   * Log call to database
   */
  private async logCall(call: CallData): Promise<void> {
    if (!this.supabase) return;

    await this.supabase.from('ai_calls').upsert({
      call_id: call.callId,
      phone_number: call.phoneNumber,
      direction: call.direction,
      status: call.status,
      duration_seconds: call.duration,
      transcript: call.transcript,
      summary: call.summary,
      sentiment: call.sentiment,
      action_required: call.actionRequired,
      created_at: new Date().toISOString(),
    });
  }

  /**
   * Get call history
   */
  async getCallHistory(limit = 50): Promise<CallData[]> {
    if (!this.supabase) return [];

    const { data } = await this.supabase
      .from('ai_calls')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    return (data || []).map(row => ({
      callId: row.call_id,
      phoneNumber: row.phone_number,
      direction: row.direction,
      status: row.status,
      duration: row.duration_seconds,
      transcript: row.transcript,
      summary: row.summary,
      sentiment: row.sentiment,
      actionRequired: row.action_required,
    }));
  }

  /**
   * Get call stats
   */
  async getCallStats(): Promise<{
    totalCalls: number;
    todayCalls: number;
    avgDuration: number;
    appointmentsBooked: number;
    transferRate: number;
  }> {
    if (!this.supabase) {
      return { totalCalls: 0, todayCalls: 0, avgDuration: 0, appointmentsBooked: 0, transferRate: 0 };
    }

    const today = new Date().toISOString().split('T')[0];

    const { data: stats } = await this.supabase.rpc('get_call_stats', { today_date: today });

    return stats || { totalCalls: 0, todayCalls: 0, avgDuration: 0, appointmentsBooked: 0, transferRate: 0 };
  }
}

// Export singleton
export const retellService = new RetellService();
export default retellService;
