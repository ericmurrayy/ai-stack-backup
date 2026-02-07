// Murray's FSM - Reputation Management
// =====================================
// Review tracking and response automation

import { createAdminClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatRelativeTime } from '@/lib/utils';
import {
  Star,
  MessageSquare,
  TrendingUp,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  Send,
  Plus,
  Filter,
} from 'lucide-react';

interface Review {
  id: string;
  platform: string;
  reviewer_name: string;
  rating: number;
  title?: string;
  content: string;
  review_date: string;
  response?: string;
  response_date?: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  review_url?: string;
}

async function getReviewsData() {
  const supabase = createAdminClient();

  // Try to get review requests from our table
  const { data: reviewRequests } = await supabase
    .from('review_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  // Build stats from review requests
  const requestStats = {
    sent: reviewRequests?.filter(r => r.status === 'sent').length || 0,
    clicked: reviewRequests?.filter(r => r.status === 'clicked').length || 0,
    reviewed: reviewRequests?.filter(r => r.status === 'reviewed').length || 0,
    pending: reviewRequests?.filter(r => r.status === 'pending').length || 0,
  };

  // In production, fetch from Supabase or Google API
  const reviews: Review[] = [
    {
      id: '1',
      platform: 'google',
      reviewer_name: 'John Smith',
      rating: 5,
      title: 'Excellent service!',
      content: 'Mike was fantastic! He arrived on time, explained everything clearly, and fixed my garage door quickly. Highly recommend!',
      review_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      response: 'Thank you John! We appreciate your kind words and are glad we could help.',
      response_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      sentiment: 'positive',
      review_url: 'https://google.com/review/123',
    },
    {
      id: '2',
      platform: 'yelp',
      reviewer_name: 'Sarah Johnson',
      rating: 5,
      content: 'Best garage door service in Austin! They were professional, affordable, and did a great job on my new opener installation.',
      review_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      sentiment: 'positive',
    },
    {
      id: '3',
      platform: 'google',
      reviewer_name: 'Mike Davis',
      rating: 4,
      content: 'Good service overall. The technician was knowledgeable and fixed the problem. Only minor issue was arrival was about 30 minutes late.',
      review_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      sentiment: 'positive',
    },
    {
      id: '4',
      platform: 'facebook',
      reviewer_name: 'Lisa Brown',
      rating: 3,
      content: 'Service was okay but pricing seemed higher than quoted. Would like more transparency on final costs.',
      review_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      sentiment: 'neutral',
    },
  ];

  const stats = {
    totalReviews: reviews.length,
    averageRating: reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length,
    responseRate: reviews.filter(r => r.response).length / reviews.length * 100,
    positive: reviews.filter(r => r.sentiment === 'positive').length,
    neutral: reviews.filter(r => r.sentiment === 'neutral').length,
    negative: reviews.filter(r => r.sentiment === 'negative').length,
    needsResponse: reviews.filter(r => !r.response).length,
  };

  return { reviews, stats, requestStats, reviewRequests: reviewRequests || [] };
}

const platformColors: Record<string, string> = {
  google: 'bg-blue-100 text-blue-800',
  yelp: 'bg-red-100 text-red-800',
  facebook: 'bg-indigo-100 text-indigo-800',
  homeadvisor: 'bg-orange-100 text-orange-800',
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${
            star <= rating ? 'text-yellow-500 fill-yellow-500' : 'text-slate-300'
          }`}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-semibold">
            {review.reviewer_name.split(' ').map(n => n[0]).join('')}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900">{review.reviewer_name}</span>
              <Badge className={platformColors[review.platform]}>
                {review.platform}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <StarRating rating={review.rating} />
              <span className="text-sm text-slate-500">{formatRelativeTime(review.review_date)}</span>
            </div>
          </div>
        </div>
        {review.review_url && (
          <a
            href={review.review_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <ExternalLink className="w-4 h-4 text-slate-400" />
          </a>
        )}
      </div>

      {review.title && (
        <h4 className="font-medium text-slate-900 mt-3">{review.title}</h4>
      )}
      <p className="text-slate-600 mt-2">{review.content}</p>

      {review.response ? (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
          <div className="text-sm font-medium text-blue-800 mb-1">Your Response</div>
          <p className="text-sm text-blue-700">{review.response}</p>
          <div className="text-xs text-blue-600 mt-2">
            Responded {formatRelativeTime(review.response_date!)}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2">
          <button className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-1">
            <Send className="w-4 h-4" />
            Respond
          </button>
          <button className="px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 rounded-lg">
            Use Template
          </button>
        </div>
      )}
    </Card>
  );
}

export default async function ReviewsPage() {
  const { reviews, stats, requestStats, reviewRequests } = await getReviewsData();

  return (
    <div>
      <Header title="Reputation Management" />

      <div className="p-6 space-y-6">
        {/* Review Stats */}
        <div className="grid grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-50">
                <Star className="w-5 h-5 text-yellow-600 fill-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">
                  {stats.averageRating.toFixed(1)}
                </div>
                <div className="text-sm text-slate-500">Avg Rating</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <MessageSquare className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{stats.totalReviews}</div>
                <div className="text-sm text-slate-500">Total Reviews</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <ThumbsUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{stats.positive}</div>
                <div className="text-sm text-slate-500">Positive</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">
                  {Math.round(stats.responseRate)}%
                </div>
                <div className="text-sm text-slate-500">Response Rate</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stats.needsResponse > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}>
                <AlertCircle className={`w-5 h-5 ${stats.needsResponse > 0 ? 'text-yellow-600' : 'text-green-600'}`} />
              </div>
              <div>
                <div className={`text-2xl font-bold ${stats.needsResponse > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {stats.needsResponse}
                </div>
                <div className="text-sm text-slate-500">Needs Response</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Review Request Stats */}
        <Card className="p-4">
          <h3 className="font-semibold text-slate-900 mb-4">Review Request Performance</h3>
          <div className="grid grid-cols-4 gap-4">
            <div className="p-3 bg-blue-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-600">{requestStats.sent}</div>
              <div className="text-sm text-blue-700">Requests Sent</div>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-purple-600">{requestStats.clicked}</div>
              <div className="text-sm text-purple-700">Link Clicked</div>
            </div>
            <div className="p-3 bg-green-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">{requestStats.reviewed}</div>
              <div className="text-sm text-green-700">Reviews Left</div>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {requestStats.sent > 0 ? Math.round((requestStats.reviewed / requestStats.sent) * 100) : 0}%
              </div>
              <div className="text-sm text-yellow-700">Conversion Rate</div>
            </div>
          </div>
        </Card>

        {/* Rating Distribution */}
        <Card className="p-4">
          <h3 className="font-semibold text-slate-900 mb-4">Rating Distribution</h3>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = reviews.filter(r => r.rating === rating).length;
              const percent = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
              return (
                <div key={rating} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-16">
                    <span className="text-sm font-medium text-slate-600">{rating}</span>
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  </div>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-500 rounded-full"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="text-sm text-slate-500 w-12 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
              All Reviews
            </button>
            <button className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg">
              Needs Response ({stats.needsResponse})
            </button>
            <button className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg">
              Negative
            </button>
          </div>
          <div className="flex items-center gap-2">
            <select className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">All Platforms</option>
              <option value="google">Google</option>
              <option value="yelp">Yelp</option>
              <option value="facebook">Facebook</option>
            </select>
            <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Request Reviews
            </button>
          </div>
        </div>

        {/* Reviews List */}
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      </div>
    </div>
  );
}
