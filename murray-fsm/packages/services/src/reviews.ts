// Murray's FSM - Reviews Service
// ================================
// Review analytics: ratings, distributions, response rates, and priority sorting

import type { Review, ReviewPlatform } from '@murray-fsm/shared';

// ============================================================================
// Types
// ============================================================================

export interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  responseRate: number;
  byPlatform: Record<string, { count: number; averageRating: number }>;
}

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

// ============================================================================
// Aggregate Review Stats
// ============================================================================

/**
 * Get aggregate review statistics: average rating, total count,
 * response rate, and per-platform breakdowns.
 */
export function getReviewStats(reviews: Review[]): ReviewStats {
  const averageRating = calculateAverageRating(reviews);
  const responseRate = calculateResponseRate(reviews);

  // Group by platform
  const platformMap = new Map<
    string,
    { totalRating: number; count: number }
  >();

  for (const review of reviews) {
    const platform = review.platform ?? 'unknown';
    const existing = platformMap.get(platform);

    if (existing) {
      existing.totalRating += review.rating;
      existing.count++;
    } else {
      platformMap.set(platform, { totalRating: review.rating, count: 1 });
    }
  }

  const byPlatform: Record<string, { count: number; averageRating: number }> =
    {};

  for (const [platform, data] of platformMap) {
    byPlatform[platform] = {
      count: data.count,
      averageRating: Math.round((data.totalRating / data.count) * 10) / 10,
    };
  }

  return {
    averageRating,
    totalReviews: reviews.length,
    responseRate,
    byPlatform,
  };
}

// ============================================================================
// Priority Sorting
// ============================================================================

/**
 * Sort reviews by priority for owner action.
 * Order:
 *   1. Unresponded reviews first
 *   2. Within each group, lower ratings first (most urgent)
 *   3. Within same rating, newest first (by reviewed_at)
 */
export function sortReviewsByPriority(reviews: Review[]): Review[] {
  return [...reviews].sort((a, b) => {
    // Unresponded first
    const aResponded = a.response_text != null && a.response_text.length > 0;
    const bResponded = b.response_text != null && b.response_text.length > 0;

    if (!aResponded && bResponded) return -1;
    if (aResponded && !bResponded) return 1;

    // Lower rating first (more urgent)
    if (a.rating !== b.rating) return a.rating - b.rating;

    // Newer reviews first
    const aDate = a.reviewed_at ?? a.created_at;
    const bDate = b.reviewed_at ?? b.created_at;
    return bDate.localeCompare(aDate);
  });
}
