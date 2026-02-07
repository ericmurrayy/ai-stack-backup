/**
 * Customer Referral Tracking Service
 * ===================================
 * Track and reward customer referrals
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

export type ReferralStatus = 'pending' | 'contacted' | 'booked' | 'completed' | 'rewarded' | 'expired';

export interface Referral {
  id: string;
  referral_code: string;

  // Referrer (existing customer)
  referrer_id: string;
  referrer_name?: string;
  referrer_email?: string;
  referrer_phone?: string;

  // Referee (new customer)
  referee_name: string;
  referee_email?: string;
  referee_phone?: string;
  referee_customer_id?: string; // Once they become a customer

  // Tracking
  status: ReferralStatus;
  source?: string; // How the referral was made (email, sms, in-person, etc.)

  // Job/conversion tracking
  first_job_id?: string;
  first_job_value?: number;
  jobs_count?: number;
  total_revenue?: number;

  // Rewards
  referrer_reward_type?: 'credit' | 'discount' | 'gift_card' | 'cash';
  referrer_reward_amount?: number;
  referrer_reward_issued?: boolean;
  referrer_reward_issued_at?: string;

  referee_reward_type?: 'discount' | 'credit' | 'waived_fee';
  referee_reward_amount?: number;
  referee_reward_used?: boolean;

  // Timing
  created_at: string;
  contacted_at?: string;
  booked_at?: string;
  completed_at?: string;
  expires_at?: string;

  notes?: string;
}

export interface ReferralProgram {
  id: string;
  name: string;
  description: string;
  is_active: boolean;

  // Referrer rewards
  referrer_reward_type: 'credit' | 'discount' | 'gift_card' | 'cash';
  referrer_reward_amount: number;
  referrer_min_job_value?: number;

  // Referee rewards
  referee_reward_type: 'discount' | 'credit' | 'waived_fee';
  referee_reward_amount: number;

  // Rules
  max_referrals_per_customer?: number;
  referral_expiry_days: number;
  require_completed_job: boolean;

  // Tracking
  total_referrals: number;
  total_conversions: number;
  total_rewards_issued: number;
}

// Default referral program settings
export const defaultReferralProgram: ReferralProgram = {
  id: 'default',
  name: 'Friends & Family Referral Program',
  description: 'Refer a friend and you both save!',
  is_active: true,
  referrer_reward_type: 'credit',
  referrer_reward_amount: 50, // $50 credit
  referrer_min_job_value: 100,
  referee_reward_type: 'discount',
  referee_reward_amount: 25, // $25 off first service
  max_referrals_per_customer: 10,
  referral_expiry_days: 90,
  require_completed_job: true,
  total_referrals: 0,
  total_conversions: 0,
  total_rewards_issued: 0,
};

export const referralsService = {
  /**
   * Generate unique referral code
   */
  generateReferralCode(customerName?: string): string {
    const prefix = customerName
      ? customerName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X')
      : 'REF';
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${random}`;
  },

  /**
   * Get referral program settings
   */
  getProgram(): ReferralProgram {
    return defaultReferralProgram;
  },

  /**
   * Create a new referral
   */
  async create(
    referrer: { id: string; name?: string; email?: string; phone?: string },
    referee: { name: string; email?: string; phone?: string },
    source?: string
  ): Promise<{ success: boolean; referralId?: string; referralCode?: string; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    const program = this.getProgram();
    const referralCode = this.generateReferralCode(referrer.name);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + program.referral_expiry_days);

    const { data, error } = await supabase
      .from('referrals')
      .insert({
        referral_code: referralCode,
        referrer_id: referrer.id,
        referrer_name: referrer.name,
        referrer_email: referrer.email,
        referrer_phone: referrer.phone,
        referee_name: referee.name,
        referee_email: referee.email,
        referee_phone: referee.phone,
        status: 'pending',
        source: source || 'manual',
        referrer_reward_type: program.referrer_reward_type,
        referrer_reward_amount: program.referrer_reward_amount,
        referee_reward_type: program.referee_reward_type,
        referee_reward_amount: program.referee_reward_amount,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('[Referrals] Create error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, referralId: data.id, referralCode };
  },

  /**
   * Get referral by code
   */
  async getByCode(code: string): Promise<Referral | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referral_code', code)
      .single();

    if (error) {
      console.error('[Referrals] Get by code error:', error);
      return null;
    }

    return data;
  },

  /**
   * Get referrals by referrer
   */
  async getByReferrer(referrerId: string): Promise<Referral[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_id', referrerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Referrals] Get by referrer error:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Get all referrals with filters
   */
  async getReferrals(filter: {
    status?: ReferralStatus;
    referrer_id?: string;
    limit?: number;
  } = {}): Promise<Referral[]> {
    if (!supabase) return [];

    let query = supabase
      .from('referrals')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter.status) {
      query = query.eq('status', filter.status);
    }
    if (filter.referrer_id) {
      query = query.eq('referrer_id', filter.referrer_id);
    }
    if (filter.limit) {
      query = query.limit(filter.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Referrals] Query error:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Update referral status
   */
  async updateStatus(
    referralId: string,
    status: ReferralStatus,
    additionalData?: Partial<Referral>
  ): Promise<{ success: boolean; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    const updates: Partial<Referral> = {
      status,
      ...additionalData,
    };

    // Set timestamps based on status
    switch (status) {
      case 'contacted':
        updates.contacted_at = new Date().toISOString();
        break;
      case 'booked':
        updates.booked_at = new Date().toISOString();
        break;
      case 'completed':
        updates.completed_at = new Date().toISOString();
        break;
    }

    const { error } = await supabase
      .from('referrals')
      .update(updates)
      .eq('id', referralId);

    if (error) {
      console.error('[Referrals] Update status error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  },

  /**
   * Convert referral (when referee books their first job)
   */
  async convert(
    referralId: string,
    jobId: string,
    jobValue: number,
    newCustomerId?: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.updateStatus(referralId, 'booked', {
      first_job_id: jobId,
      first_job_value: jobValue,
      referee_customer_id: newCustomerId,
      jobs_count: 1,
      total_revenue: jobValue,
    });
  },

  /**
   * Complete referral and issue rewards
   */
  async complete(referralId: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    // Get the referral
    const { data: referral, error: getError } = await supabase
      .from('referrals')
      .select('*')
      .eq('id', referralId)
      .single();

    if (getError || !referral) {
      return { success: false, error: 'Referral not found' };
    }

    const program = this.getProgram();

    // Check if minimum job value is met
    if (program.referrer_min_job_value && (referral.first_job_value || 0) < program.referrer_min_job_value) {
      return {
        success: false,
        error: `Minimum job value of $${program.referrer_min_job_value} not met`,
      };
    }

    // Mark as completed and issue reward
    const { error } = await supabase
      .from('referrals')
      .update({
        status: 'rewarded',
        completed_at: new Date().toISOString(),
        referrer_reward_issued: true,
        referrer_reward_issued_at: new Date().toISOString(),
      })
      .eq('id', referralId);

    if (error) {
      console.error('[Referrals] Complete error:', error);
      return { success: false, error: error.message };
    }

    // In production, this would also:
    // - Apply credit to referrer's account
    // - Send notification emails
    // - Update customer records

    return { success: true };
  },

  /**
   * Apply referee discount to a job
   */
  async applyRefereeDiscount(
    referralCode: string,
    jobId: string
  ): Promise<{ success: boolean; discount?: number; error?: string }> {
    const referral = await this.getByCode(referralCode);

    if (!referral) {
      return { success: false, error: 'Invalid referral code' };
    }

    if (referral.status === 'expired') {
      return { success: false, error: 'Referral code has expired' };
    }

    if (referral.referee_reward_used) {
      return { success: false, error: 'Referral discount already used' };
    }

    if (referral.expires_at && new Date(referral.expires_at) < new Date()) {
      return { success: false, error: 'Referral code has expired' };
    }

    // Mark discount as used
    if (supabase) {
      await supabase
        .from('referrals')
        .update({
          referee_reward_used: true,
          first_job_id: jobId,
        })
        .eq('id', referral.id);
    }

    return { success: true, discount: referral.referee_reward_amount };
  },

  /**
   * Get referral statistics
   */
  async getStats(): Promise<{
    totalReferrals: number;
    pending: number;
    converted: number;
    conversionRate: number;
    totalRewardsIssued: number;
    totalRevenueGenerated: number;
    topReferrers: Array<{ name: string; referrals: number; conversions: number }>;
  }> {
    if (!supabase) {
      return {
        totalReferrals: 0,
        pending: 0,
        converted: 0,
        conversionRate: 0,
        totalRewardsIssued: 0,
        totalRevenueGenerated: 0,
        topReferrers: [],
      };
    }

    const { data } = await supabase
      .from('referrals')
      .select('status, referrer_name, referrer_id, total_revenue, referrer_reward_amount, referrer_reward_issued');

    if (!data) {
      return {
        totalReferrals: 0,
        pending: 0,
        converted: 0,
        conversionRate: 0,
        totalRewardsIssued: 0,
        totalRevenueGenerated: 0,
        topReferrers: [],
      };
    }

    const converted = data.filter(r => ['booked', 'completed', 'rewarded'].includes(r.status));
    const rewarded = data.filter(r => r.referrer_reward_issued);

    // Calculate top referrers
    const referrerMap = new Map<string, { name: string; referrals: number; conversions: number }>();
    data.forEach(r => {
      const key = r.referrer_id;
      if (!referrerMap.has(key)) {
        referrerMap.set(key, {
          name: r.referrer_name || 'Unknown',
          referrals: 0,
          conversions: 0,
        });
      }
      const entry = referrerMap.get(key)!;
      entry.referrals++;
      if (['booked', 'completed', 'rewarded'].includes(r.status)) {
        entry.conversions++;
      }
    });

    const topReferrers = Array.from(referrerMap.values())
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, 10);

    return {
      totalReferrals: data.length,
      pending: data.filter(r => r.status === 'pending').length,
      converted: converted.length,
      conversionRate: data.length > 0 ? Math.round((converted.length / data.length) * 100) : 0,
      totalRewardsIssued: rewarded.reduce((sum, r) => sum + (r.referrer_reward_amount || 0), 0),
      totalRevenueGenerated: data.reduce((sum, r) => sum + (r.total_revenue || 0), 0),
      topReferrers,
    };
  },

  /**
   * Get customer's referral link
   */
  getCustomerReferralLink(customerId: string, customerName?: string): string {
    const code = this.generateReferralCode(customerName);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://murray-fsm.vercel.app';
    return `${baseUrl}/refer/${code}`;
  },
};

export default referralsService;
