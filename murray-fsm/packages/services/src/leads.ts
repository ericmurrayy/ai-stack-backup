// Murray's FSM - Leads Service
// ==============================
// Pipeline value calculations, lead scoring, and stage analytics

import type { Lead, PipelineStage } from '@murray-fsm/shared';
import { differenceInDays, parseISO } from 'date-fns';

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
 * - Value (0-40 points): higher value = higher score
 * - Probability (0-30 points): higher probability = higher score
 * - Freshness/Age (0-30 points): newer leads score higher
 *
 * Value is scored relative to a reference of $50,000 (5_000_000 cents).
 * Age is scored with a decay: full points at 0 days, 0 points at 90+ days.
 */
export function scoreLeadPriority(lead: Lead): number {
  // Value score (0-40)
  const VALUE_REFERENCE = 5_000_000; // 50,000 dollars in cents
  const valueRatio = Math.min(lead.estimated_value_cents / VALUE_REFERENCE, 1);
  const valueScore = valueRatio * 40;

  // Probability score (0-30)
  const probabilityScore = lead.probability * 30;

  // Age/freshness score (0-30)
  const ageInDays = differenceInDays(new Date(), parseISO(lead.created_at));
  const MAX_AGE_DAYS = 90;
  const freshness = Math.max(0, 1 - ageInDays / MAX_AGE_DAYS);
  const ageScore = freshness * 30;

  return Math.round(valueScore + probabilityScore + ageScore);
}

// ============================================================================
// Pipeline Stats
// ============================================================================

/**
 * Get summary stats for each pipeline stage: count of leads and total value.
 *
 * @param leads - All leads
 * @param stages - Pipeline stage definitions
 * @returns Array of stage stats with lead count and total estimated value (cents)
 */
export function getPipelineStats(
  leads: Lead[],
  stages: PipelineStage[]
): Array<{ stage: PipelineStage; count: number; value: number }> {
  return stages.map((stage) => {
    const stageLeads = leads.filter((lead) => lead.stage_id === stage.id);
    const value = stageLeads.reduce(
      (sum, lead) => sum + lead.estimated_value_cents,
      0
    );

    return {
      stage,
      count: stageLeads.length,
      value,
    };
  });
}
