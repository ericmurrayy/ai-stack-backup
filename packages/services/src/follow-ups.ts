/**
 * Automated Follow-Up Service
 * ===========================
 * Schedule and manage post-job follow-ups
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

export type FollowUpType = 'satisfaction_check' | 'review_request' | 'maintenance_reminder' | 'survey' | 'upsell' | 'custom';
export type FollowUpChannel = 'email' | 'sms' | 'both';
export type FollowUpStatus = 'scheduled' | 'sent' | 'completed' | 'cancelled' | 'failed';

export interface FollowUp {
  id: string;
  job_id: string;
  job_number?: string;
  customer_id: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;

  type: FollowUpType;
  channel: FollowUpChannel;
  status: FollowUpStatus;

  // Timing
  scheduled_for: string;
  sent_at?: string;
  completed_at?: string;

  // Content
  subject?: string;
  message?: string;
  template_id?: string;

  // Tracking
  email_opened?: boolean;
  link_clicked?: boolean;
  response_received?: boolean;
  response?: string;

  // Metadata
  created_at: string;
  updated_at?: string;
  notes?: string;
}

export interface FollowUpRule {
  id: string;
  name: string;
  type: FollowUpType;
  channel: FollowUpChannel;
  delay_days: number;
  delay_hours?: number;
  subject: string;
  message: string;
  is_active: boolean;
  conditions?: {
    service_categories?: string[];
    min_job_value?: number;
    customer_type?: 'new' | 'returning' | 'all';
  };
}

// Default follow-up rules
export const defaultFollowUpRules: FollowUpRule[] = [
  {
    id: 'satisfaction-24h',
    name: '24-Hour Satisfaction Check',
    type: 'satisfaction_check',
    channel: 'email',
    delay_days: 1,
    delay_hours: 0,
    subject: 'How was your service experience?',
    message: `Hi {{customer_name}},

We hope your recent service went smoothly! Our technician {{technician_name}} completed {{service_type}} at your property yesterday.

We'd love to hear how everything is working. If you have any questions or concerns, please don't hesitate to reach out.

Is everything working as expected?

Best regards,
Murray's Field Service`,
    is_active: true,
    conditions: {
      customer_type: 'all',
    },
  },
  {
    id: 'review-request-3d',
    name: '3-Day Review Request',
    type: 'review_request',
    channel: 'email',
    delay_days: 3,
    subject: 'Would you recommend us? ⭐',
    message: `Hi {{customer_name}},

Thank you for choosing Murray's Field Service for your recent {{service_type}}.

If you were happy with our service, would you take a moment to leave us a review? Your feedback helps other homeowners find reliable service.

{{review_link}}

Thank you for your support!

Best regards,
Murray's Field Service`,
    is_active: true,
    conditions: {
      customer_type: 'all',
    },
  },
  {
    id: 'survey-7d',
    name: '7-Day Survey',
    type: 'survey',
    channel: 'email',
    delay_days: 7,
    subject: 'Quick Survey: How are things working?',
    message: `Hi {{customer_name}},

It's been a week since our service at your property. We wanted to check in and make sure everything is still working great.

Would you mind taking our quick 2-minute survey? Your feedback helps us improve.

{{survey_link}}

Thank you!

Best regards,
Murray's Field Service`,
    is_active: true,
    conditions: {
      customer_type: 'all',
    },
  },
  {
    id: 'maintenance-90d',
    name: '90-Day Maintenance Reminder',
    type: 'maintenance_reminder',
    channel: 'both',
    delay_days: 90,
    subject: 'Time for a maintenance check?',
    message: `Hi {{customer_name}},

It's been about 3 months since we serviced your {{equipment_type}}. Regular maintenance helps prevent unexpected breakdowns and keeps your system running efficiently.

Would you like to schedule a maintenance visit?

Book online: {{booking_link}}
Or call us: {{phone_number}}

Best regards,
Murray's Field Service`,
    is_active: true,
    conditions: {
      service_categories: ['hvac_repair', 'hvac_install', 'plumbing_repair'],
    },
  },
  {
    id: 'upsell-14d',
    name: '14-Day Service Agreement Offer',
    type: 'upsell',
    channel: 'email',
    delay_days: 14,
    subject: 'Save on future service with a maintenance plan',
    message: `Hi {{customer_name}},

Thank you for being a valued customer! We noticed you had service on your {{equipment_type}} recently.

Did you know our maintenance plans can save you up to 20% on repairs and include priority scheduling?

Benefits include:
• Regular tune-ups included
• Discounts on parts and labor
• Priority emergency service
• No service call fees

Learn more: {{contract_link}}

Best regards,
Murray's Field Service`,
    is_active: true,
    conditions: {
      min_job_value: 200,
      customer_type: 'returning',
    },
  },
];

export const followUpsService = {
  /**
   * Get all follow-up rules
   */
  getRules(): FollowUpRule[] {
    return defaultFollowUpRules.filter(r => r.is_active);
  },

  /**
   * Get rule by ID
   */
  getRuleById(ruleId: string): FollowUpRule | undefined {
    return defaultFollowUpRules.find(r => r.id === ruleId);
  },

  /**
   * Schedule follow-ups for a completed job
   */
  async scheduleForJob(
    job: {
      id: string;
      job_number?: string;
      service_category?: string;
      total_amount?: number;
      completed_at?: string;
    },
    customer: {
      id: string;
      name?: string;
      email?: string;
      phone?: string;
      is_new?: boolean;
    },
    options?: {
      rules?: string[];
      skipTypes?: FollowUpType[];
    }
  ): Promise<{ success: boolean; scheduled: number; error?: string }> {
    if (!supabase) {
      return { success: false, scheduled: 0, error: 'Database not configured' };
    }

    const applicableRules = this.getRules().filter(rule => {
      // Skip if rule type is excluded
      if (options?.skipTypes?.includes(rule.type)) return false;

      // Check specific rules
      if (options?.rules && options.rules.length > 0) {
        return options.rules.includes(rule.id);
      }

      // Check conditions
      if (rule.conditions) {
        if (rule.conditions.service_categories && job.service_category) {
          if (!rule.conditions.service_categories.includes(job.service_category)) {
            return false;
          }
        }

        if (rule.conditions.min_job_value && job.total_amount) {
          if (job.total_amount < rule.conditions.min_job_value) {
            return false;
          }
        }

        if (rule.conditions.customer_type && rule.conditions.customer_type !== 'all') {
          const isNew = customer.is_new ?? true;
          if (rule.conditions.customer_type === 'new' && !isNew) return false;
          if (rule.conditions.customer_type === 'returning' && isNew) return false;
        }
      }

      return true;
    });

    const baseDate = job.completed_at ? new Date(job.completed_at) : new Date();
    const followUps: Partial<FollowUp>[] = [];

    for (const rule of applicableRules) {
      const scheduledFor = new Date(baseDate);
      scheduledFor.setDate(scheduledFor.getDate() + rule.delay_days);
      if (rule.delay_hours) {
        scheduledFor.setHours(scheduledFor.getHours() + rule.delay_hours);
      }

      followUps.push({
        job_id: job.id,
        job_number: job.job_number,
        customer_id: customer.id,
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
        type: rule.type,
        channel: rule.channel,
        status: 'scheduled',
        scheduled_for: scheduledFor.toISOString(),
        subject: rule.subject,
        message: rule.message,
        template_id: rule.id,
        created_at: new Date().toISOString(),
      });
    }

    if (followUps.length === 0) {
      return { success: true, scheduled: 0 };
    }

    const { error } = await supabase.from('follow_ups').insert(followUps);

    if (error) {
      console.error('[FollowUps] Schedule error:', error);
      return { success: false, scheduled: 0, error: error.message };
    }

    return { success: true, scheduled: followUps.length };
  },

  /**
   * Get due follow-ups
   */
  async getDueFollowUps(): Promise<FollowUp[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('follow_ups')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(100);

    if (error) {
      console.error('[FollowUps] Get due error:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Get follow-ups with filters
   */
  async getFollowUps(filter: {
    job_id?: string;
    customer_id?: string;
    status?: FollowUpStatus;
    type?: FollowUpType;
    limit?: number;
  } = {}): Promise<FollowUp[]> {
    if (!supabase) return [];

    let query = supabase
      .from('follow_ups')
      .select('*')
      .order('scheduled_for', { ascending: false });

    if (filter.job_id) {
      query = query.eq('job_id', filter.job_id);
    }
    if (filter.customer_id) {
      query = query.eq('customer_id', filter.customer_id);
    }
    if (filter.status) {
      query = query.eq('status', filter.status);
    }
    if (filter.type) {
      query = query.eq('type', filter.type);
    }
    if (filter.limit) {
      query = query.limit(filter.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[FollowUps] Query error:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Mark follow-up as sent
   */
  async markSent(followUpId: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    const { error } = await supabase
      .from('follow_ups')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', followUpId);

    if (error) {
      console.error('[FollowUps] Mark sent error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  },

  /**
   * Mark follow-up as completed
   */
  async markCompleted(followUpId: string, response?: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    const { error } = await supabase
      .from('follow_ups')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        response_received: !!response,
        response,
        updated_at: new Date().toISOString(),
      })
      .eq('id', followUpId);

    if (error) {
      console.error('[FollowUps] Mark completed error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  },

  /**
   * Cancel follow-up
   */
  async cancel(followUpId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    const { error } = await supabase
      .from('follow_ups')
      .update({
        status: 'cancelled',
        notes: reason ? `Cancelled: ${reason}` : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', followUpId);

    if (error) {
      console.error('[FollowUps] Cancel error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  },

  /**
   * Record tracking event
   */
  async recordEvent(
    followUpId: string,
    event: 'opened' | 'clicked' | 'responded'
  ): Promise<{ success: boolean; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    const updates: Partial<FollowUp> = {
      updated_at: new Date().toISOString(),
    };

    switch (event) {
      case 'opened':
        updates.email_opened = true;
        break;
      case 'clicked':
        updates.link_clicked = true;
        break;
      case 'responded':
        updates.response_received = true;
        break;
    }

    const { error } = await supabase
      .from('follow_ups')
      .update(updates)
      .eq('id', followUpId);

    if (error) {
      console.error('[FollowUps] Record event error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  },

  /**
   * Process due follow-ups (called by cron)
   */
  async processDueFollowUps(): Promise<{
    processed: number;
    sent: number;
    failed: number;
  }> {
    const dueFollowUps = await this.getDueFollowUps();

    let sent = 0;
    let failed = 0;

    for (const followUp of dueFollowUps) {
      try {
        // In production, this would actually send the email/SMS
        // For now, just mark as sent
        const result = await this.markSent(followUp.id);
        if (result.success) {
          sent++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    return {
      processed: dueFollowUps.length,
      sent,
      failed,
    };
  },

  /**
   * Get follow-up statistics
   */
  async getStats(): Promise<{
    total: number;
    scheduled: number;
    sent: number;
    completed: number;
    openRate: number;
    clickRate: number;
  }> {
    if (!supabase) {
      return { total: 0, scheduled: 0, sent: 0, completed: 0, openRate: 0, clickRate: 0 };
    }

    const { data } = await supabase
      .from('follow_ups')
      .select('status, email_opened, link_clicked');

    if (!data) {
      return { total: 0, scheduled: 0, sent: 0, completed: 0, openRate: 0, clickRate: 0 };
    }

    const sent = data.filter(f => f.status === 'sent' || f.status === 'completed');
    const opened = sent.filter(f => f.email_opened);
    const clicked = sent.filter(f => f.link_clicked);

    return {
      total: data.length,
      scheduled: data.filter(f => f.status === 'scheduled').length,
      sent: sent.length,
      completed: data.filter(f => f.status === 'completed').length,
      openRate: sent.length > 0 ? Math.round((opened.length / sent.length) * 100) : 0,
      clickRate: sent.length > 0 ? Math.round((clicked.length / sent.length) * 100) : 0,
    };
  },
};

export default followUpsService;
