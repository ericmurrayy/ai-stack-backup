/**
 * Communication Log Service
 * =========================
 * Track all customer communications across channels
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

export type CommunicationType = 'email' | 'sms' | 'phone' | 'whatsapp' | 'chat' | 'in_person' | 'note';
export type CommunicationDirection = 'inbound' | 'outbound' | 'internal';

export interface CommunicationEntry {
  id: string;
  customer_id?: string;
  job_id?: string;
  type: CommunicationType;
  direction: CommunicationDirection;
  subject?: string;
  content: string;
  from_name?: string;
  from_contact?: string;
  to_name?: string;
  to_contact?: string;
  team_member_id?: string;
  attachments?: string[];
  metadata?: Record<string, any>;
  created_at: string;
}

export interface CommunicationFilter {
  customer_id?: string;
  job_id?: string;
  type?: CommunicationType;
  direction?: CommunicationDirection;
  team_member_id?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export const communicationLogService = {
  /**
   * Log a new communication
   */
  async log(entry: Omit<CommunicationEntry, 'id' | 'created_at'>): Promise<{ success: boolean; entryId?: string; error?: string }> {
    if (!supabase) return { success: false, error: 'Database not configured' };

    const { data, error } = await supabase
      .from('communication_log')
      .insert({
        ...entry,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('[CommunicationLog] Insert error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, entryId: data.id };
  },

  /**
   * Log an email communication
   */
  async logEmail(params: {
    customer_id?: string;
    job_id?: string;
    direction: CommunicationDirection;
    subject: string;
    content: string;
    from_email: string;
    to_email: string;
    from_name?: string;
    to_name?: string;
    team_member_id?: string;
    attachments?: string[];
  }): Promise<{ success: boolean; entryId?: string; error?: string }> {
    return this.log({
      customer_id: params.customer_id,
      job_id: params.job_id,
      type: 'email',
      direction: params.direction,
      subject: params.subject,
      content: params.content,
      from_name: params.from_name,
      from_contact: params.from_email,
      to_name: params.to_name,
      to_contact: params.to_email,
      team_member_id: params.team_member_id,
      attachments: params.attachments,
    });
  },

  /**
   * Log an SMS communication
   */
  async logSMS(params: {
    customer_id?: string;
    job_id?: string;
    direction: CommunicationDirection;
    content: string;
    from_phone: string;
    to_phone: string;
    team_member_id?: string;
  }): Promise<{ success: boolean; entryId?: string; error?: string }> {
    return this.log({
      customer_id: params.customer_id,
      job_id: params.job_id,
      type: 'sms',
      direction: params.direction,
      content: params.content,
      from_contact: params.from_phone,
      to_contact: params.to_phone,
      team_member_id: params.team_member_id,
    });
  },

  /**
   * Log a phone call
   */
  async logPhoneCall(params: {
    customer_id?: string;
    job_id?: string;
    direction: CommunicationDirection;
    duration_seconds?: number;
    summary?: string;
    from_phone: string;
    to_phone: string;
    team_member_id?: string;
    call_recording_url?: string;
  }): Promise<{ success: boolean; entryId?: string; error?: string }> {
    return this.log({
      customer_id: params.customer_id,
      job_id: params.job_id,
      type: 'phone',
      direction: params.direction,
      content: params.summary || 'Phone call',
      from_contact: params.from_phone,
      to_contact: params.to_phone,
      team_member_id: params.team_member_id,
      metadata: {
        duration_seconds: params.duration_seconds,
        recording_url: params.call_recording_url,
      },
    });
  },

  /**
   * Log an internal note
   */
  async logNote(params: {
    customer_id?: string;
    job_id?: string;
    content: string;
    team_member_id: string;
    team_member_name?: string;
  }): Promise<{ success: boolean; entryId?: string; error?: string }> {
    return this.log({
      customer_id: params.customer_id,
      job_id: params.job_id,
      type: 'note',
      direction: 'internal',
      content: params.content,
      from_name: params.team_member_name,
      team_member_id: params.team_member_id,
    });
  },

  /**
   * Get communications with filters
   */
  async getLog(filter: CommunicationFilter = {}): Promise<CommunicationEntry[]> {
    if (!supabase) return [];

    let query = supabase
      .from('communication_log')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter.customer_id) {
      query = query.eq('customer_id', filter.customer_id);
    }
    if (filter.job_id) {
      query = query.eq('job_id', filter.job_id);
    }
    if (filter.type) {
      query = query.eq('type', filter.type);
    }
    if (filter.direction) {
      query = query.eq('direction', filter.direction);
    }
    if (filter.team_member_id) {
      query = query.eq('team_member_id', filter.team_member_id);
    }
    if (filter.startDate) {
      query = query.gte('created_at', filter.startDate);
    }
    if (filter.endDate) {
      query = query.lte('created_at', filter.endDate);
    }
    if (filter.limit) {
      query = query.limit(filter.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[CommunicationLog] Query error:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Get customer communication history
   */
  async getCustomerHistory(customerId: string, limit = 50): Promise<CommunicationEntry[]> {
    return this.getLog({ customer_id: customerId, limit });
  },

  /**
   * Get job communication history
   */
  async getJobHistory(jobId: string): Promise<CommunicationEntry[]> {
    return this.getLog({ job_id: jobId });
  },

  /**
   * Get communication stats
   */
  async getStats(filter: { startDate?: string; endDate?: string } = {}): Promise<{
    total: number;
    byType: Record<CommunicationType, number>;
    byDirection: Record<CommunicationDirection, number>;
  }> {
    if (!supabase) {
      return {
        total: 0,
        byType: { email: 0, sms: 0, phone: 0, whatsapp: 0, chat: 0, in_person: 0, note: 0 },
        byDirection: { inbound: 0, outbound: 0, internal: 0 },
      };
    }

    let query = supabase
      .from('communication_log')
      .select('type, direction');

    if (filter.startDate) {
      query = query.gte('created_at', filter.startDate);
    }
    if (filter.endDate) {
      query = query.lte('created_at', filter.endDate);
    }

    const { data, error } = await query;

    if (error || !data) {
      return {
        total: 0,
        byType: { email: 0, sms: 0, phone: 0, whatsapp: 0, chat: 0, in_person: 0, note: 0 },
        byDirection: { inbound: 0, outbound: 0, internal: 0 },
      };
    }

    const byType: Record<CommunicationType, number> = {
      email: 0, sms: 0, phone: 0, whatsapp: 0, chat: 0, in_person: 0, note: 0,
    };
    const byDirection: Record<CommunicationDirection, number> = {
      inbound: 0, outbound: 0, internal: 0,
    };

    data.forEach(entry => {
      if (entry.type in byType) {
        byType[entry.type as CommunicationType]++;
      }
      if (entry.direction in byDirection) {
        byDirection[entry.direction as CommunicationDirection]++;
      }
    });

    return {
      total: data.length,
      byType,
      byDirection,
    };
  },

  /**
   * Search communications
   */
  async search(query: string, limit = 50): Promise<CommunicationEntry[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('communication_log')
      .select('*')
      .or(`content.ilike.%${query}%,subject.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[CommunicationLog] Search error:', error);
      return [];
    }

    return data || [];
  },
};

export default communicationLogService;
