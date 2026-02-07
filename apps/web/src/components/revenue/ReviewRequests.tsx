'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Star,
  Send,
  CheckCircle,
  Clock,
  ExternalLink,
  RefreshCw
} from 'lucide-react';

interface ReviewRequest {
  id: string;
  customer_name: string;
  customer_phone?: string;
  status: string;
  sent_at?: string;
  clicked_at?: string;
  reviewed_at?: string;
  follow_up_count: number;
  created_at: string;
  job?: {
    title: string;
    completed_at?: string;
  };
}

interface ReviewStats {
  totalRequests: number;
  sent: number;
  clicked: number;
  reviewed: number;
  conversionRate: number;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'gray' },
  sent: { label: 'Sent', color: 'blue' },
  clicked: { label: 'Clicked', color: 'yellow' },
  reviewed: { label: 'Reviewed', color: 'green' },
  declined: { label: 'Declined', color: 'red' },
};

export function ReviewRequests() {
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingFollowUps, setSendingFollowUps] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [requestsRes, statsRes] = await Promise.all([
        fetch('/api/reviews?limit=20'),
        fetch('/api/reviews?action=stats'),
      ]);

      if (requestsRes.ok) {
        const data = await requestsRes.json();
        setRequests(data.requests || []);
      }
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
    } catch (error) {
      console.error('Failed to fetch review data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function sendRequest(requestId: string) {
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          requestId,
        }),
      });

      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to send review request:', error);
    }
  }

  async function sendFollowUps() {
    setSendingFollowUps(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-follow-ups',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Sent ${data.sent} follow-up reminders`);
        fetchData();
      }
    } catch (error) {
      console.error('Failed to send follow-ups:', error);
    } finally {
      setSendingFollowUps(false);
    }
  }

  async function markReviewed(requestId: string) {
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark-reviewed',
          requestId,
        }),
      });

      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to mark as reviewed:', error);
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '--';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-16 bg-gray-200 rounded" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-2xl font-bold">{stats.totalRequests}</p>
            <p className="text-sm text-gray-500">Total Requests</p>
          </Card>
          <Card className="p-4">
            <p className="text-2xl font-bold">{stats.sent}</p>
            <p className="text-sm text-gray-500">Sent</p>
          </Card>
          <Card className="p-4">
            <p className="text-2xl font-bold">{stats.reviewed}</p>
            <p className="text-sm text-gray-500">Reviews Received</p>
          </Card>
          <Card className="p-4 bg-green-50">
            <p className="text-2xl font-bold text-green-600">
              {stats.conversionRate}%
            </p>
            <p className="text-sm text-gray-500">Conversion Rate</p>
          </Card>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={sendFollowUps}
          disabled={sendingFollowUps}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${sendingFollowUps ? 'animate-spin' : ''}`}
          />
          Send Follow-Ups
        </Button>
      </div>

      {/* Request List */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h3 className="font-semibold">Review Requests</h3>
        </div>

        <div className="divide-y">
          {requests.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Star className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No review requests yet</p>
              <p className="text-sm mt-1">
                Review requests are automatically created when jobs are completed
              </p>
            </div>
          ) : (
            requests.map((request) => {
              const status = statusConfig[request.status] || statusConfig.pending;

              return (
                <div
                  key={request.id}
                  className="p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-yellow-100">
                        <Star className="h-4 w-4 text-yellow-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {request.customer_name}
                          </span>
                          <Badge variant={status.color as any}>
                            {status.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500">
                          {request.job?.title || 'Service'}
                          {request.follow_up_count > 0 && (
                            <span className="ml-2">
                              • {request.follow_up_count} follow-up(s)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right text-sm text-gray-500">
                        <p>Created {formatDate(request.created_at)}</p>
                        {request.sent_at && (
                          <p>Sent {formatDate(request.sent_at)}</p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {request.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => sendRequest(request.id)}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Send
                          </Button>
                        )}
                        {['sent', 'clicked'].includes(request.status) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markReviewed(request.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Got Review
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
