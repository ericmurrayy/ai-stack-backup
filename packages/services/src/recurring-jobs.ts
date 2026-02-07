/**
 * Recurring Jobs Service
 * ======================
 * Manage recurring/scheduled maintenance jobs
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

export interface RecurringJobTemplate {
  id: string;
  customer_id: string;
  customer_name?: string;
  service_category: string;
  description: string;
  address?: string;
  city?: string;
  zip_code?: string;
  assigned_technician_id?: string;
  quoted_amount?: number;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'semiannual' | 'annual';
  day_of_week?: number; // 0-6 for weekly/biweekly
  day_of_month?: number; // 1-31 for monthly+
  preferred_time?: string;
  notes?: string;
  is_active: boolean;
  next_scheduled_date: string;
  last_generated_date?: string;
  created_at: string;
}

export interface RecurringJobResult {
  templateId: string;
  jobId?: string;
  success: boolean;
  error?: string;
}

// Calculate next occurrence based on frequency
function calculateNextDate(
  frequency: RecurringJobTemplate['frequency'],
  fromDate: Date,
  dayOfWeek?: number,
  dayOfMonth?: number
): Date {
  const next = new Date(fromDate);

  switch (frequency) {
    case 'weekly':
      next.setDate(next.getDate() + 7);
      if (dayOfWeek !== undefined) {
        // Adjust to specific day of week
        const currentDay = next.getDay();
        const daysUntil = (dayOfWeek - currentDay + 7) % 7 || 7;
        next.setDate(next.getDate() + daysUntil);
      }
      break;

    case 'biweekly':
      next.setDate(next.getDate() + 14);
      if (dayOfWeek !== undefined) {
        const currentDay = next.getDay();
        const daysUntil = (dayOfWeek - currentDay + 7) % 7;
        next.setDate(next.getDate() + daysUntil);
      }
      break;

    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      if (dayOfMonth) {
        // Handle months with fewer days
        const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        next.setDate(Math.min(dayOfMonth, maxDay));
      }
      break;

    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      if (dayOfMonth) {
        const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        next.setDate(Math.min(dayOfMonth, maxDay));
      }
      break;

    case 'semiannual':
      next.setMonth(next.getMonth() + 6);
      if (dayOfMonth) {
        const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        next.setDate(Math.min(dayOfMonth, maxDay));
      }
      break;

    case 'annual':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }

  return next;
}

// Get frequency label
export function getFrequencyLabel(frequency: RecurringJobTemplate['frequency']): string {
  const labels: Record<RecurringJobTemplate['frequency'], string> = {
    weekly: 'Weekly',
    biweekly: 'Every 2 Weeks',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    semiannual: 'Every 6 Months',
    annual: 'Annually',
  };
  return labels[frequency] || frequency;
}

export const recurringJobsService = {
  /**
   * Create a recurring job template
   */
  async createTemplate(template: Omit<RecurringJobTemplate, 'id' | 'created_at' | 'last_generated_date'>): Promise<{ success: boolean; templateId?: string; error?: string }> {
    if (!supabase) return { success: false, error: 'Database not configured' };

    const { data, error } = await supabase
      .from('recurring_job_templates')
      .insert({
        ...template,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('[RecurringJobs] Create template error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, templateId: data.id };
  },

  /**
   * Get all recurring job templates
   */
  async getTemplates(activeOnly = true): Promise<RecurringJobTemplate[]> {
    if (!supabase) return [];

    let query = supabase
      .from('recurring_job_templates')
      .select('*')
      .order('next_scheduled_date', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[RecurringJobs] Get templates error:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Get templates due for job creation
   */
  async getDueTemplates(): Promise<RecurringJobTemplate[]> {
    if (!supabase) return [];

    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('recurring_job_templates')
      .select('*')
      .eq('is_active', true)
      .lte('next_scheduled_date', today);

    if (error) {
      console.error('[RecurringJobs] Get due templates error:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Generate a job from a recurring template
   */
  async generateJobFromTemplate(template: RecurringJobTemplate): Promise<RecurringJobResult> {
    if (!supabase) {
      return { templateId: template.id, success: false, error: 'Database not configured' };
    }

    try {
      // Generate job number
      const jobNumber = `J-${Date.now().toString(36).toUpperCase()}`;

      // Create the job
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert({
          job_number: jobNumber,
          customer_id: template.customer_id,
          customer_name: template.customer_name,
          address: template.address,
          city: template.city,
          zip_code: template.zip_code,
          service_category: template.service_category,
          issue_description: template.description,
          preferred_time: template.preferred_time,
          scheduled_at: new Date(template.next_scheduled_date).toISOString(),
          assigned_technician_id: template.assigned_technician_id,
          quoted_amount: template.quoted_amount,
          notes: template.notes ? `[Recurring] ${template.notes}` : '[Recurring Job]',
          source: 'recurring',
          status: 'scheduled',
          urgency: 'medium',
          recurring_template_id: template.id,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (jobError) {
        throw new Error(jobError.message);
      }

      // Calculate and update next scheduled date
      const nextDate = calculateNextDate(
        template.frequency,
        new Date(template.next_scheduled_date),
        template.day_of_week,
        template.day_of_month
      );

      await supabase
        .from('recurring_job_templates')
        .update({
          next_scheduled_date: nextDate.toISOString().split('T')[0],
          last_generated_date: new Date().toISOString(),
        })
        .eq('id', template.id);

      console.log(`[RecurringJobs] Generated job ${jobNumber} from template ${template.id}`);

      return {
        templateId: template.id,
        jobId: job.id,
        success: true,
      };
    } catch (error: any) {
      console.error('[RecurringJobs] Generate job error:', error);
      return {
        templateId: template.id,
        success: false,
        error: error.message,
      };
    }
  },

  /**
   * Process all due recurring jobs
   */
  async processDueJobs(): Promise<RecurringJobResult[]> {
    const results: RecurringJobResult[] = [];

    const dueTemplates = await this.getDueTemplates();
    console.log(`[RecurringJobs] Processing ${dueTemplates.length} due templates`);

    for (const template of dueTemplates) {
      const result = await this.generateJobFromTemplate(template);
      results.push(result);
    }

    return results;
  },

  /**
   * Update a recurring template
   */
  async updateTemplate(
    templateId: string,
    updates: Partial<RecurringJobTemplate>
  ): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Database not configured' };

    const { error } = await supabase
      .from('recurring_job_templates')
      .update(updates)
      .eq('id', templateId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  },

  /**
   * Pause a recurring template
   */
  async pauseTemplate(templateId: string): Promise<{ success: boolean; error?: string }> {
    return this.updateTemplate(templateId, { is_active: false });
  },

  /**
   * Resume a recurring template
   */
  async resumeTemplate(templateId: string): Promise<{ success: boolean; error?: string }> {
    return this.updateTemplate(templateId, { is_active: true });
  },

  /**
   * Delete a recurring template
   */
  async deleteTemplate(templateId: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Database not configured' };

    const { error } = await supabase
      .from('recurring_job_templates')
      .delete()
      .eq('id', templateId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  },

  /**
   * Get upcoming recurring jobs for a customer
   */
  async getCustomerRecurringJobs(customerId: string): Promise<RecurringJobTemplate[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('recurring_job_templates')
      .select('*')
      .eq('customer_id', customerId)
      .eq('is_active', true)
      .order('next_scheduled_date', { ascending: true });

    if (error) {
      console.error('[RecurringJobs] Get customer templates error:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Get recurring job stats
   */
  async getStats(): Promise<{
    totalActive: number;
    dueThisWeek: number;
    dueThisMonth: number;
    generatedThisMonth: number;
  }> {
    if (!supabase) {
      return { totalActive: 0, dueThisWeek: 0, dueThisMonth: 0, generatedThisMonth: 0 };
    }

    const now = new Date();
    const weekFromNow = new Date(now);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const monthFromNow = new Date(now);
    monthFromNow.setMonth(monthFromNow.getMonth() + 1);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      { count: totalActive },
      { count: dueThisWeek },
      { count: dueThisMonth },
      { count: generatedThisMonth },
    ] = await Promise.all([
      supabase.from('recurring_job_templates').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('recurring_job_templates').select('*', { count: 'exact', head: true }).eq('is_active', true).lte('next_scheduled_date', weekFromNow.toISOString().split('T')[0]),
      supabase.from('recurring_job_templates').select('*', { count: 'exact', head: true }).eq('is_active', true).lte('next_scheduled_date', monthFromNow.toISOString().split('T')[0]),
      supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('source', 'recurring').gte('created_at', startOfMonth.toISOString()),
    ]);

    return {
      totalActive: totalActive || 0,
      dueThisWeek: dueThisWeek || 0,
      dueThisMonth: dueThisMonth || 0,
      generatedThisMonth: generatedThisMonth || 0,
    };
  },
};

export default recurringJobsService;
