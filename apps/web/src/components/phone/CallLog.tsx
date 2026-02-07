'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  Calendar,
  User,
  MessageSquare
} from 'lucide-react';

interface Call {
  call_id: string;
  phone_number: string;
  direction: 'inbound' | 'outbound';
  status: string;
  duration_seconds?: number;
  summary?: string;
  sentiment?: string;
  action_required?: boolean;
  job_id?: string;
  created_at: string;
}

const sentimentColors: Record<string, 'success' | 'default' | 'danger'> = {
  positive: 'success',
  neutral: 'default',
  negative: 'danger',
};

export function CallLog() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [callsRes, statsRes] = await Promise.all([
          fetch('/api/phone?action=history&limit=20'),
          fetch('/api/phone?action=stats'),
        ]);

        if (callsRes.ok) {
          const data = await callsRes.json();
          setCalls(data.calls || []);
        }
        if (statsRes.ok) {
          setStats(await statsRes.json());
        }
      } catch (error) {
        console.error('Failed to fetch call data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString('en-US', {
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
        <Card className="p-6 animate-pulse">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-100">
                <Phone className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalCalls}</p>
                <p className="text-sm text-gray-500">Total Calls</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100">
                <PhoneIncoming className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.todayCalls}</p>
                <p className="text-sm text-gray-500">Today</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-purple-100">
                <Calendar className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.appointmentsBooked}</p>
                <p className="text-sm text-gray-500">Jobs Booked</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-yellow-100">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {formatDuration(Math.round(stats.avgDuration))}
                </p>
                <p className="text-sm text-gray-500">Avg Duration</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Call List */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h3 className="font-semibold">Recent Calls</h3>
        </div>

        <div className="divide-y">
          {calls.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Phone className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No calls yet</p>
              <p className="text-sm mt-1">
                Calls will appear here when customers call your AI phone line
              </p>
            </div>
          ) : (
            calls.map((call) => (
              <div
                key={call.call_id}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-full ${
                        call.direction === 'inbound'
                          ? 'bg-green-100'
                          : 'bg-blue-100'
                      }`}
                    >
                      {call.direction === 'inbound' ? (
                        <PhoneIncoming
                          className={`h-4 w-4 ${
                            call.direction === 'inbound'
                              ? 'text-green-600'
                              : 'text-blue-600'
                          }`}
                        />
                      ) : (
                        <PhoneOutgoing className="h-4 w-4 text-blue-600" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{call.phone_number}</span>
                        {call.action_required && (
                          <Badge variant="danger">Action Needed</Badge>
                        )}
                        {call.job_id && (
                          <Badge variant="success">Job Booked</Badge>
                        )}
                      </div>

                      {call.summary && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {call.summary}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(call.duration_seconds)}
                        </span>
                        {call.sentiment && (
                          <Badge
                            variant={sentimentColors[call.sentiment] || 'default'}
                          >
                            {call.sentiment}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right text-sm text-gray-500">
                    <p>{formatDate(call.created_at)}</p>
                    <p>{formatTime(call.created_at)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
