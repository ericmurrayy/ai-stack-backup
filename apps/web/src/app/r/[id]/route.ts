/**
 * Review Tracking Redirect
 * ========================
 * Short URL that tracks clicks before redirecting to Google Reviews
 */

import { NextRequest, NextResponse } from 'next/server';
import { reviewService } from '@packages/services/reviews';

export const runtime = 'nodejs';

/**
 * GET /r/[id]
 * Track click and redirect to Google Reviews
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const requestId = params.id;

    // Track the click and get redirect URL
    const redirectUrl = await reviewService.trackClick(requestId);

    // Redirect to Google Reviews
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Review redirect error:', error);
    // Fallback to generic Google page
    return NextResponse.redirect('https://www.google.com/maps');
  }
}
