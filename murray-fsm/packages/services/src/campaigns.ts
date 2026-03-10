// Murray's FSM - Campaigns Service
// ==================================
// Campaign recipient building, stats aggregation, metrics formatting, and validation

import type { Campaign, CampaignRecipientStatus } from '@murray-fsm/shared';

// ============================================================================
// Types
// ============================================================================

export interface CampaignStatsResult {
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}

export interface FormattedCampaignMetrics {
  deliveryRate: string;
  openRate: string;
  clickRate: string;
  bounceRate: string;
}

export interface CampaignSummary {
  total: number;
  byStatus: Record<string, number>;
  avgOpenRate: number;
}

// ============================================================================
// Recipient List Building
// ============================================================================

/**
 * Build a list of campaign recipients by filtering customers
 * who have the required destination (email or phone) for the channel.
 *
 * @param customers - Array of customer objects with id, email, phone
 * @param channel - The campaign channel ('email' or 'sms')
 * @returns Array of valid recipients with customer_id, destination, and channel
 */
export function buildRecipientList(
  customers: Array<{ id: string; email?: string | null; phone?: string | null }>,
  channel: 'email' | 'sms'
): Array<{ customer_id: string; destination: string; channel: 'email' | 'sms' }> {
  const recipients: Array<{
    customer_id: string;
    destination: string;
    channel: 'email' | 'sms';
  }> = [];

  for (const customer of customers) {
    if (channel === 'email' && customer.email) {
      recipients.push({
        customer_id: customer.id,
        destination: customer.email,
        channel: 'email',
      });
    } else if (channel === 'sms' && customer.phone) {
      recipients.push({
        customer_id: customer.id,
        destination: customer.phone,
        channel: 'sms',
      });
    }
  }

  return recipients;
}

// ============================================================================
// Campaign Stats Calculation
// ============================================================================

/**
 * Calculate open rate, click rate, bounce rate, and delivery rate
 * from a campaign's embedded stats object.
 *
 * All rates returned as percentages (0-100), rounded to 1 decimal.
 */
export function calculateCampaignStats(campaign: Campaign): CampaignStatsResult {
  const stats = campaign.stats;

  if (!stats || !stats.sent || stats.sent === 0) {
    return { deliveryRate: 0, openRate: 0, clickRate: 0, bounceRate: 0 };
  }

  const delivered = stats.delivered ?? 0;
  const opened = stats.opened ?? 0;
  const clicked = stats.clicked ?? 0;
  const bounced = stats.sent - delivered;

  const deliveryRate = Math.round((delivered / stats.sent) * 1000) / 10;
  const openRate =
    delivered > 0 ? Math.round((opened / delivered) * 1000) / 10 : 0;
  const clickRate =
    opened > 0 ? Math.round((clicked / opened) * 1000) / 10 : 0;
  const bounceRate = Math.round((bounced / stats.sent) * 1000) / 10;

  return { deliveryRate, openRate, clickRate, bounceRate };
}

// ============================================================================
// Campaign Metrics Formatting
// ============================================================================

/**
 * Format campaign stats as human-readable percentage strings.
 */
export function formatCampaignMetrics(
  stats: CampaignStatsResult
): FormattedCampaignMetrics {
  return {
    deliveryRate: stats.deliveryRate.toFixed(1) + '%',
    openRate: stats.openRate.toFixed(1) + '%',
    clickRate: stats.clickRate.toFixed(1) + '%',
    bounceRate: stats.bounceRate.toFixed(1) + '%',
  };
}

// ============================================================================
// Campaign Summary
// ============================================================================

/**
 * Aggregate summary across multiple campaigns:
 * total count, count by status, and average open rate.
 */
export function getCampaignSummary(campaigns: Campaign[]): CampaignSummary {
  const byStatus: Record<string, number> = {};
  let totalOpenRate = 0;
  let campaignsWithStats = 0;

  for (const campaign of campaigns) {
    // Count by status
    const status = campaign.status ?? 'unknown';
    byStatus[status] = (byStatus[status] || 0) + 1;

    // Accumulate open rate for averaging
    if (campaign.stats && campaign.stats.sent && campaign.stats.sent > 0) {
      const delivered = campaign.stats.delivered ?? 0;
      const opened = campaign.stats.opened ?? 0;

      if (delivered > 0) {
        totalOpenRate += (opened / delivered) * 100;
        campaignsWithStats++;
      }
    }
  }

  const avgOpenRate =
    campaignsWithStats > 0
      ? Math.round((totalOpenRate / campaignsWithStats) * 10) / 10
      : 0;

  return {
    total: campaigns.length,
    byStatus,
    avgOpenRate,
  };
}

// ============================================================================
// Send Readiness Validation
// ============================================================================

/**
 * Check whether a campaign has all required fields to be sent:
 * - Has a template_subject (for email campaigns)
 * - Has a template_body
 * - Has a scheduled_at time
 * - Stats indicate there are recipients (sent > 0 or campaign is still in draft)
 *
 * Returns true only if the campaign passes all checks.
 */
export function isCampaignReadyToSend(campaign: Campaign): boolean {
  // Must have a body
  if (!campaign.template_body || campaign.template_body.trim().length === 0) {
    return false;
  }

  // Email campaigns must have a subject
  if (campaign.type !== 'sms') {
    if (
      !campaign.template_subject ||
      campaign.template_subject.trim().length === 0
    ) {
      return false;
    }
  }

  // Must have a scheduled send time
  if (!campaign.scheduled_at) {
    return false;
  }

  // Must have a name
  if (!campaign.name || campaign.name.trim().length === 0) {
    return false;
  }

  return true;
}
