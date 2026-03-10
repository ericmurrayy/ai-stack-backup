// Murray's FSM - Leads Service
// ==============================
// Pipeline value calculations, lead scoring, stage analytics, and conversion tracking

import type { Lead, PipelineStage } from '@murray-fsm/shared';
import { differenceInDays, parseISO } from 'date-fns';

// ============================================================================
// Types
// ============================================================================

export interface PipelineStageStats {
  stage: PipelineStage;
  count: number;
  value: number;
  weightedValue: number;
  avgDealSize: number;
}

export interface PipelineOverview {
  stages: PipelineStageStats[];
  totalValue: number;
  totalWeightedValue: number;
  conversionRate: number;
  avgDealSize: number;
}

// ============================================================================
// Pipeline Value
// ============================================================================

/**
 * Calculate the weighted pipeline value across all leads.
 * Value = sum of (estimated_value_cents * probability) for each lead.
 *
 * @returns Weighted pipeline value in cents
 */
export function calculatePipelineValue(leads: Lead[]): number {
  return leads.reduce((total, lead) => {
    return total + Math.round(lead.estimated_value_cents * lead.probability);
  }, 0);
}

// ============================================================================
// Lead Scoring
// ============================================================================

/**
 * Score a lead's priority from 0 to 100 based on:
 * - Value (0-30 points): higher value = higher score
 * - Probability (0-25 points): higher probability = higher score
 * - Freshness/Age (0-20 points): newer leads score higher
 * - Assignment (0-10 points): leads with a technician assigned score higher
 * - Close date proximity (0-15 points): closer expected close = higher score
 *
 * Value is scored relative to a reference of $50,000 (5_000_000 cents).
 * Age is scored with a decay: full points at 0 days, 0 points at 90+ days.
 */
export function scoreLeadPriority(lead: Lead): number {
  // Value score (0-30)
  const VALUE_REFERENCE = 5_000_000; // 50,000 dollars in cents
  const valueRatio = Math.min(lead.estimated_value_cents / VALUE_REFERENCE, 1);
  const valueScore = valueRatio * 30;

  // Probability score (0-25)
  const probabilityScore = lead.probability * 25;

  // Age/freshness score (0-20)
  const now = new Date();
  const ageInDays = differenceInDays(now, parseISO(lead.created_at));
  const MAX_AGE_DAYS = 90;
  const freshness = Math.max(0, 1 - ageInDays / MAX_AGE_DAYS);
  const ageScore = freshness * 20;

  // Assignment bonus (0-10)
  const assignmentScore = lead.assigned_technician_id ? 10 : 0;

  // Close date proximity (0-15)
  let closeScore = 0;
  if (lead.expected_close_date) {
    const daysUntilClose = differenceInDays(
      parseISO(lead.expected_close_date),
      now
    );
    if (daysUntilClose <= 0) {
      // Overdue — full urgency
      closeScore = 15;
    } else if (daysUntilClose <= 30) {
      closeScore = (1 - daysUntilClose / 30) * 15;
    }
    // More than 30 days out gets 0 points
  }

  const total = valueScore + probabilityScore + ageScore + assignmentScore + closeScore;
  return Math.min(100, Math.max(0, Math.round(total)));
}

// ============================================================================
// Pipeline Stats
// ============================================================================

/**
 * Get detailed stats for each pipeline stage including value, weighted value,
 * conversion rates, and average deal size.
 *
 * @param leads - All leads
 * @param stages - Pipeline stage definitions
 * @returns Full pipeline overview with per-stage and aggregate stats
 */
export function getPipelineStats(
  leads: Lead[],
  stages: PipelineStage[]
): PipelineOverview {
  const sortedStages = [...stages].sort((a, b) => a.sort_order - b.sort_order);

  const stageStats: PipelineStageStats[] = sortedStages.map((stage) => {
    const stageLeads = leads.filter((lead) => lead.stage_id === stage.id);
    const value = stageLeads.reduce(
      (sum, lead) => sum + lead.estimated_value_cents,
      0
    );
    const weightedValue = stageLeads.reduce(
      (sum, lead) =>
        sum + Math.round(lead.estimated_value_cents * lead.probability),
      0
    );
    const avgDealSize =
      stageLeads.length > 0 ? Math.round(value / stageLeads.length) : 0;

    return {
      stage,
      count: stageLeads.length,
      value,
      weightedValue,
      avgDealSize,
    };
  });

  const totalValue = leads.reduce(
    (sum, lead) => sum + lead.estimated_value_cents,
    0
  );
  const totalWeightedValue = calculatePipelineValue(leads);
  const conversionRate = calculateConversionRate(leads);
  const avgDealSize =
    leads.length > 0 ? Math.round(totalValue / leads.length) : 0;

  return {
    stages: stageStats,
    totalValue,
    totalWeightedValue,
    conversionRate,
    avgDealSize,
  };
}

// ============================================================================
// Leads by Stage
// ============================================================================

/**
 * Group leads by their pipeline stage.
 * Returns a map of stage id to leads in that stage, ordered by stage sort_order.
 *
 * @param leads - All leads
 * @param stages - Pipeline stage definitions
 * @returns Array of { stage, leads } sorted by stage order
 */
export function getLeadsByStage(
  leads: Lead[],
  stages: PipelineStage[]
): Array<{ stage: PipelineStage; leads: Lead[] }> {
  const sortedStages = [...stages].sort((a, b) => a.sort_order - b.sort_order);

  return sortedStages.map((stage) => ({
    stage,
    leads: leads.filter((lead) => lead.stage_id === stage.id),
  }));
}

// ============================================================================
// Conversion Rate
// ============================================================================

/**
 * Calculate the lead conversion rate.
 * Conversion = won leads / (won leads + lost leads).
 *
 * Only considers leads that have reached a terminal state (won or lost).
 * Returns 0 if no leads have been won or lost.
 */
export function calculateConversionRate(leads: Lead[]): number {
  const won = leads.filter((lead) => lead.won_at != null).length;
  const lost = leads.filter((lead) => lead.lost_at != null).length;
  const total = won + lost;

  if (total === 0) return 0;

  return Math.round((won / total) * 1000) / 10;
}

// ============================================================================
// Stale Leads
// ============================================================================

/**
 * Find leads that haven't been updated within the specified number of days.
 * Excludes leads that are already won or lost.
 *
 * @param leads - All leads
 * @param staleDays - Number of days without an update to consider stale (default: 14)
 * @returns Array of stale leads, sorted by last update (oldest first)
 */
export function getStaleLeads(leads: Lead[], staleDays: number = 14): Lead[] {
  const now = new Date();

  return leads
    .filter((lead) => {
      // Skip terminal leads
      if (lead.won_at != null || lead.lost_at != null) return false;

      const lastUpdate = parseISO(lead.updated_at);
      const daysSinceUpdate = differenceInDays(now, lastUpdate);
      return daysSinceUpdate >= staleDays;
    })
    .sort((a, b) => {
      // Oldest update first (most stale)
      return a.updated_at.localeCompare(b.updated_at);
    });
}
