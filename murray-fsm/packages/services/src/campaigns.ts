// Murray's FSM - Campaigns Service
// ==================================
// Campaign recipient building, stats aggregation, and metrics formatting

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
  const recipients: Array<{ customer_id: string; destination: string; channel: 'email' | 'sms' }> = [];

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
// Campaign Stats Aggregation
// ============================================================================

/**
 * Aggregate campaign recipient statuses into summary stats.
 */
export function calculateCampaignStats(
  recipients: Array<{ status: string }>
): {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
} {
  const stats = {
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    failed: 0,
  };

  for (const recipient of recipients) {
    switch (recipient.status) {
      case 'sent':
        stats.sent++;
        break;
      case 'delivered':
        stats.sent++;
        stats.delivered++;
        break;
      case 'opened':
        stats.sent++;
        stats.delivered++;
        stats.opened++;
        break;
      case 'clicked':
        stats.sent++;
        stats.delivered++;
        stats.opened++;
        stats.clicked++;
        break;
      case 'bounced':
        stats.sent++;
        stats.bounced++;
        break;
      case 'failed':
        stats.failed++;
        break;
      default:
        // 'pending' or unknown — no increment
        break;
    }
  }

  return stats;
}

// ============================================================================
// Campaign Metrics Formatting
// ============================================================================

/**
 * Format campaign metrics as human-readable percentage strings.
 */
export function formatCampaignMetrics(stats: {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
}): {
  deliveryRate: string;
  openRate: string;
  clickRate: string;
} {
  const deliveryRate =
    stats.sent > 0
      ? ((stats.delivered / stats.sent) * 100).toFixed(1) + '%'
      : '0.0%';

  const openRate =
    stats.delivered > 0
      ? ((stats.opened / stats.delivered) * 100).toFixed(1) + '%'
      : '0.0%';

  const clickRate =
    stats.opened > 0
      ? ((stats.clicked / stats.opened) * 100).toFixed(1) + '%'
      : '0.0%';

  return { deliveryRate, openRate, clickRate };
}
