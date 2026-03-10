// Murray's FSM - Reviews Service
// ================================
// Review analytics: ratings, distributions, response rates

import type { Review } from '@murray-fsm/shared';

// ============================================================================
// Rating Calculations
// ============================================================================

/**
 * Calculate the average rating across a set of reviews.
 * Returns 0 if no reviews are provided.
 * Rounded to 1 decimal place.
 */
export function calculateAverageRating(reviews: Review[]): number {
  if (reviews.length === 0) return 0;

  const sum = reviews.reduce((total, review) => total + review.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}

// ============================================================================
// Rating Distribution
// ============================================================================

/**
 * Get the count of reviews per star rating (1 through 5).
 */
export function getRatingDistribution(
  reviews: Review[]
): Record<1 | 2 | 3 | 4 | 5, number> {
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  for (const review of reviews) {
    const rating = Math.round(review.rating) as 1 | 2 | 3 | 4 | 5;
    if (rating >= 1 && rating <= 5) {
      distribution[rating]++;
    }
  }

  return distribution;
}

// ============================================================================
// Response Rate
// ============================================================================

/**
 * Calculate the percentage of reviews that have a response.
 * Returns 0 if no reviews are provided.
 */
export function calculateResponseRate(reviews: Review[]): number {
  if (reviews.length === 0) return 0;

  const responded = reviews.filter(
    (review) => review.response_text != null && review.response_text.length > 0
  ).length;

  return Math.round((responded / reviews.length) * 1000) / 10;
}
