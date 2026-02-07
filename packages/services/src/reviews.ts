/**
 * Review Request Service
 * ======================
 * Auto-request Google reviews after completed jobs
 *
 * Features:
 * - Send review request via WhatsApp/SMS
 * - Track review status
 * - Follow-up on non-responses
 * - Track conversion rates
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { jarvisBridge } from './jarvis-bridge';

// Use any for now until Supabase types are generated
type SupabaseClientAny = SupabaseClient<any, any, any>;

// Types
export interface ReviewRequest {
  id: string;
  jobId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  status: 'pending' | 'sent' | 'clicked' | 'reviewed' | 'declined';
  sentAt?: string;
  clickedAt?: string;
  reviewedAt?: string;
  followUpCount: number;
  createdAt: string;
}

export interface ReviewStats {
  totalRequests: number;
  sent: number;
  clicked: number;
  reviewed: number;
  conversionRate: number;
}

class ReviewService {
  private supabase: SupabaseClientAny | null = null;
  private googleReviewUrl: string;

  constructor() {
    // Murray's Google Business review URL
    this.googleReviewUrl = process.env.GOOGLE_REVIEW_URL ||
      'https://g.page/r/YOUR_BUSINESS_ID/review';

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      this.supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
    }
  }

  /**
   * Create review request for completed job
   */
  async createRequest(jobId: string): Promise<ReviewRequest | null> {
    if (!this.supabase) return null;

    // Get job and customer details
    const { data: job } = await this.supabase
      .from('jobs')
      .select(`
        *,
        customer:customers(*)
      `)
      .eq('id', jobId)
      .single();

    if (!job || !job.customer) {
      console.log(`[Reviews] Job or customer not found: ${jobId}`);
      return null;
    }

    // Check if request already exists
    const { data: existing } = await this.supabase
      .from('review_requests')
      .select('id')
      .eq('job_id', jobId)
      .single();

    if (existing) {
      console.log(`[Reviews] Request already exists for job: ${jobId}`);
      return null;
    }

    const request: ReviewRequest = {
      id: crypto.randomUUID(),
      jobId,
      customerId: job.customer.id,
      customerName: job.customer.name,
      customerPhone: job.customer.phone,
      status: 'pending',
      followUpCount: 0,
      createdAt: new Date().toISOString(),
    };

    await this.supabase.from('review_requests').insert({
      id: request.id,
      job_id: request.jobId,
      customer_id: request.customerId,
      customer_name: request.customerName,
      customer_phone: request.customerPhone,
      status: request.status,
      follow_up_count: request.followUpCount,
      created_at: request.createdAt,
    });

    return request;
  }

  /**
   * Send review request to customer
   */
  async sendRequest(requestId: string, customMessage?: string): Promise<boolean> {
    if (!this.supabase) return false;

    // Get request details
    const { data: request } = await this.supabase
      .from('review_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (!request || !request.customer_phone) {
      console.log(`[Reviews] Request not found or no phone: ${requestId}`);
      return false;
    }

    // Generate tracking link (short URL that we track)
    const trackingUrl = await this.createTrackingLink(requestId);

    // Build message
    const message = customMessage ||
      `Hi ${request.customer_name}! Thank you for choosing us. ` +
      `If you were happy with our service, we'd really appreciate a quick Google review. ` +
      `It only takes 30 seconds: ${trackingUrl} 🙏`;

    try {
      const result = await jarvisBridge.sendWhatsApp(request.customer_phone, message);

      if (result.success) {
        await this.supabase
          .from('review_requests')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', requestId);

        return true;
      }
    } catch (error) {
      console.error('[Reviews] Failed to send request:', error);
    }

    return false;
  }

  /**
   * Create tracking link for review
   */
  private async createTrackingLink(requestId: string): Promise<string> {
    // In production, this would be a short URL that tracks clicks
    // For now, return the Google review URL with tracking param
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return `${baseUrl}/r/${requestId}`;
  }

  /**
   * Handle tracking link click
   */
  async trackClick(requestId: string): Promise<string> {
    if (this.supabase) {
      await this.supabase
        .from('review_requests')
        .update({
          status: 'clicked',
          clicked_at: new Date().toISOString(),
        })
        .eq('id', requestId);
    }

    // Redirect to actual Google review page
    return this.googleReviewUrl;
  }

  /**
   * Mark review as received (manual or via Google API)
   */
  async markReviewed(requestId: string): Promise<void> {
    if (!this.supabase) return;

    await this.supabase
      .from('review_requests')
      .update({
        status: 'reviewed',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    // Log this as revenue-generating activity
    const { data: request } = await this.supabase
      .from('review_requests')
      .select('job_id')
      .eq('id', requestId)
      .single();

    if (request) {
      await this.supabase.from('ai_revenue').insert({
        source: 'google_review',
        amount: 0, // Reviews are indirect revenue
        job_id: request.job_id,
        notes: 'Customer left Google review',
      });
    }
  }

  /**
   * Send follow-up for pending requests
   */
  async sendFollowUps(daysAfterSent = 3, maxFollowUps = 2): Promise<{ sent: number }> {
    if (!this.supabase) return { sent: 0 };

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysAfterSent);

    // Get requests that need follow-up
    const { data: requests } = await this.supabase
      .from('review_requests')
      .select('*')
      .eq('status', 'sent')
      .lt('sent_at', cutoffDate.toISOString())
      .lt('follow_up_count', maxFollowUps);

    let sent = 0;

    for (const request of requests || []) {
      const message =
        `Hi ${request.customer_name}! Just a gentle reminder - ` +
        `we'd love to hear about your experience. ` +
        `A quick review helps us serve you better: ${await this.createTrackingLink(request.id)} 🌟`;

      try {
        const result = await jarvisBridge.sendWhatsApp(request.customer_phone, message);

        if (result.success) {
          await this.supabase
            .from('review_requests')
            .update({
              follow_up_count: request.follow_up_count + 1,
              last_follow_up_at: new Date().toISOString(),
            })
            .eq('id', request.id);

          sent++;
        }
      } catch (error) {
        console.error(`[Reviews] Follow-up failed for ${request.id}:`, error);
      }
    }

    return { sent };
  }

  /**
   * Get pending review requests (not yet sent)
   */
  async getPendingRequests(): Promise<ReviewRequest[]> {
    if (!this.supabase) return [];

    const { data } = await this.supabase
      .from('review_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    return (data || []).map(this.mapRequest);
  }

  /**
   * Get review stats
   */
  async getStats(): Promise<ReviewStats> {
    if (!this.supabase) {
      return { totalRequests: 0, sent: 0, clicked: 0, reviewed: 0, conversionRate: 0 };
    }

    const { data } = await this.supabase
      .from('review_requests')
      .select('status');

    const stats = {
      totalRequests: data?.length || 0,
      sent: 0,
      clicked: 0,
      reviewed: 0,
      conversionRate: 0,
    };

    for (const row of data || []) {
      if (['sent', 'clicked', 'reviewed'].includes(row.status)) stats.sent++;
      if (['clicked', 'reviewed'].includes(row.status)) stats.clicked++;
      if (row.status === 'reviewed') stats.reviewed++;
    }

    stats.conversionRate = stats.sent > 0
      ? Math.round((stats.reviewed / stats.sent) * 100)
      : 0;

    return stats;
  }

  /**
   * Auto-process completed jobs (called by cron/webhook)
   */
  async processCompletedJobs(): Promise<{ created: number; sent: number }> {
    if (!this.supabase) return { created: 0, sent: 0 };

    // Get recently completed jobs without review requests
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { data: jobs } = await this.supabase
      .from('jobs')
      .select('id')
      .eq('status', 'completed')
      .gte('completed_at', yesterday.toISOString())
      .is('review_request_id', null);

    let created = 0;
    let sent = 0;

    for (const job of jobs || []) {
      const request = await this.createRequest(job.id);
      if (request) {
        created++;

        // Auto-send after 2 hours (or configure delay)
        const success = await this.sendRequest(request.id);
        if (success) sent++;
      }
    }

    return { created, sent };
  }

  /**
   * Map database row to ReviewRequest type
   */
  private mapRequest(row: any): ReviewRequest {
    return {
      id: row.id,
      jobId: row.job_id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      status: row.status,
      sentAt: row.sent_at,
      clickedAt: row.clicked_at,
      reviewedAt: row.reviewed_at,
      followUpCount: row.follow_up_count,
      createdAt: row.created_at,
    };
  }
}

// Export singleton
export const reviewService = new ReviewService();
export default reviewService;
