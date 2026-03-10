// Murray's FSM - Activity/Audit Log Page
// ========================================
// System-wide activity feed showing all changes

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatRelativeTime } from '@/lib/utils';
import {
  Activity,
  Briefcase,
  Users,
  FileText,
  Phone,
  MessageSquare,
  DollarSign,
  Star,
  Calendar,
  CheckCircle,
  AlertCircle,
  Plus,
  Edit,
  Trash2,
  Send,
  Clock,
  Filter,
} from 'lucide-react';

// ---------- Types ----------

interface ActivityEvent {
  id: string;
  type: string;
  entity: string;
  action: string;
  description: string;
  timestamp: string;
  icon: typeof Activity;
  color: string;
}

// ---------- Data Fetcher ----------

async function getActivityData() {
  const supabase = createClient();
  const events: ActivityEvent[] = [];

  // Recent jobs
  const { data: recentJobs } = await supabase
    .from('jobs')
    .select('id, title, status, created_at, updated_at')
    .eq('is_spam', false)
    .order('updated_at', { ascending: false })
    .limit(10);

  (recentJobs || []).forEach(j => {
    events.push({
      id: `job-${j.id}`,
      type: 'job',
      entity: j.title,
      action: j.status === 'new' ? 'created' : `status → ${j.status}`,
      description: `Job "${j.title}" was ${j.status === 'new' ? 'created' : `moved to ${j.status}`}`,
      timestamp: j.updated_at || j.created_at,
      icon: Briefcase,
      color: 'text-blue-600 bg-blue-50',
    });
  });

  // Recent estimates
  const { data: recentEstimates } = await supabase
    .from('estimates')
    .select('id, title, status, total_cents, created_at')
    .eq('deleted', false)
    .order('created_at', { ascending: false })
    .limit(8);

  (recentEstimates || []).forEach(e => {
    const action = e.status === 'approved' ? 'approved' : e.status === 'sent' ? 'sent' : 'created';
    events.push({
      id: `est-${e.id}`,
      type: 'estimate',
      entity: e.title,
      action,
      description: `Estimate "${e.title}" was ${action}${e.status === 'approved' ? ' ✓' : ''}`,
      timestamp: e.created_at,
      icon: FileText,
      color: action === 'approved' ? 'text-green-600 bg-green-50' : 'text-yellow-600 bg-yellow-50',
    });
  });

  // Recent customers
  const { data: recentCustomers } = await supabase
    .from('customers')
    .select('id, name, created_at')
    .eq('deleted', false)
    .order('created_at', { ascending: false })
    .limit(5);

  (recentCustomers || []).forEach(c => {
    events.push({
      id: `cust-${c.id}`,
      type: 'customer',
      entity: c.name,
      action: 'added',
      description: `New customer "${c.name}" was added`,
      timestamp: c.created_at,
      icon: Users,
      color: 'text-purple-600 bg-purple-50',
    });
  });

  // Recent reviews
  const { data: recentReviews } = await supabase
    .from('reviews')
    .select('id, reviewer_name, rating, reviewed_at')
    .eq('deleted', false)
    .order('reviewed_at', { ascending: false })
    .limit(5);

  (recentReviews || []).forEach(r => {
    events.push({
      id: `rev-${r.id}`,
      type: 'review',
      entity: r.reviewer_name || 'Customer',
      action: `${r.rating} ★ review`,
      description: `${r.reviewer_name || 'Customer'} left a ${r.rating}-star review`,
      timestamp: r.reviewed_at,
      icon: Star,
      color: r.rating >= 4 ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50',
    });
  });

  // Recent calls
  const { data: recentCalls } = await supabase
    .from('call_logs')
    .select('id, direction, duration_seconds, created_at, customer:customers(name)')
    .order('created_at', { ascending: false })
    .limit(5);

  (recentCalls || []).forEach((c: any) => {
    const custName = Array.isArray(c.customer) ? c.customer[0]?.name : c.customer?.name;
    events.push({
      id: `call-${c.id}`,
      type: 'call',
      entity: custName || 'Unknown',
      action: `${c.direction} call`,
      description: `${c.direction === 'inbound' ? 'Received' : 'Made'} call ${custName ? `with ${custName}` : ''}`,
      timestamp: c.created_at,
      icon: Phone,
      color: 'text-green-600 bg-green-50',
    });
  });

  // Recent messages
  const { data: recentMessages } = await supabase
    .from('message_logs')
    .select('id, direction, channel, created_at, customer:customers(name)')
    .order('created_at', { ascending: false })
    .limit(5);

  (recentMessages || []).forEach((m: any) => {
    const custName = Array.isArray(m.customer) ? m.customer[0]?.name : m.customer?.name;
    events.push({
      id: `msg-${m.id}`,
      type: 'message',
      entity: custName || 'Unknown',
      action: `${m.direction} ${m.channel}`,
      description: `${m.direction === 'outbound' ? 'Sent' : 'Received'} ${m.channel} ${custName ? `with ${custName}` : ''}`,
      timestamp: m.created_at,
      icon: MessageSquare,
      color: 'text-blue-600 bg-blue-50',
    });
  });

  // Sort by timestamp
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Group by date
  const grouped: Record<string, ActivityEvent[]> = {};
  events.forEach(e => {
    const date = new Date(e.timestamp).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(e);
  });

  return { events, grouped };
}

// ---------- Page ----------

export default async function ActivityPage() {
  const { events, grouped } = await getActivityData();
  const dates = Object.keys(grouped);

  return (
    <div>
      <Header title="Activity Log" />

      <div className="p-6 space-y-6 max-w-3xl">
        {/* Summary */}
        <div className="flex items-center gap-4">
          <Card className="p-3 flex-1">
            <div className="text-center">
              <div className="text-xl font-bold text-slate-900">{events.length}</div>
              <div className="text-xs text-slate-500">Total Events</div>
            </div>
          </Card>
          <Card className="p-3 flex-1">
            <div className="text-center">
              <div className="text-xl font-bold text-blue-600">
                {events.filter(e => e.type === 'job').length}
              </div>
              <div className="text-xs text-slate-500">Job Updates</div>
            </div>
          </Card>
          <Card className="p-3 flex-1">
            <div className="text-center">
              <div className="text-xl font-bold text-green-600">
                {events.filter(e => ['call', 'message'].includes(e.type)).length}
              </div>
              <div className="text-xs text-slate-500">Communications</div>
            </div>
          </Card>
          <Card className="p-3 flex-1">
            <div className="text-center">
              <div className="text-xl font-bold text-yellow-600">
                {events.filter(e => e.type === 'review').length}
              </div>
              <div className="text-xs text-slate-500">Reviews</div>
            </div>
          </Card>
        </div>

        {/* Timeline */}
        {dates.map(date => (
          <div key={date}>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">{date}</h3>
            <div className="space-y-1">
              {grouped[date].map((event, i) => {
                const IconComponent = event.icon;
                return (
                  <div key={event.id} className="flex items-start gap-3 p-3 hover:bg-slate-50 rounded-lg transition-colors">
                    <div className={`p-2 rounded-lg ${event.color}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">{event.entity}</span>
                        <Badge className="bg-slate-100 text-slate-600 text-xs">{event.action}</Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{event.description}</p>
                    </div>
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {formatRelativeTime(event.timestamp)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {events.length === 0 && (
          <Card className="p-12 text-center">
            <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <div className="text-slate-500 font-medium">No activity yet</div>
            <div className="text-sm text-slate-400 mt-1">Activity will appear here as you use the system</div>
          </Card>
        )}
      </div>
    </div>
  );
}
