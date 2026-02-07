// Murray's FSM - Approvals Page
// ===============================
// Critical page for approval-gated automation

import { createAdminClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { formatRelativeTime, actionStatusConfig, actionKindConfig, formatPhone, formatDuration } from '@/lib/utils';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Briefcase,
  Calendar,
  FileText,
  Send,
  MessageSquare,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  Mic,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ApprovalActions } from './ApprovalActions';
import { ApprovalCard } from './ApprovalCard';
import type { ActionQueueItem, CallLog } from '@/types/database';
import Link from 'next/link';

interface ActionWithCall extends ActionQueueItem {
  relatedCall?: CallLog;
}

async function getPendingApprovals(): Promise<ActionWithCall[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('action_queue')
    .select('*')
    .eq('deleted', false)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
      return [];
    }
    console.error('Error fetching approvals:', error);
    return [];
  }

  // Fetch related calls for call-sourced approvals
  const approvals = data || [];
  const callSourcedApprovals = approvals.filter(a => a.source_type === 'call' && a.source_id);

  if (callSourcedApprovals.length > 0) {
    const callIds = callSourcedApprovals.map(a => a.source_id);
    const { data: calls } = await supabase
      .from('call_logs')
      .select('*')
      .in('id', callIds);

    if (calls) {
      const callMap = new Map(calls.map(c => [c.id, c]));
      return approvals.map(a => ({
        ...a,
        relatedCall: a.source_type === 'call' && a.source_id ? callMap.get(a.source_id) : undefined,
      }));
    }
  }

  return approvals;
}

async function getRecentApprovals(): Promise<ActionQueueItem[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('action_queue')
    .select('*')
    .eq('deleted', false)
    .neq('status', 'pending')
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
      return [];
    }
    console.error('Error fetching recent approvals:', error);
    return [];
  }

  return data || [];
}

function getKindIcon(kind: string) {
  switch (kind) {
    case 'create_job':
    case 'schedule_job':
    case 'reschedule_job':
      return <Calendar className="w-5 h-5" />;
    case 'create_estimate':
    case 'send_estimate':
      return <FileText className="w-5 h-5" />;
    case 'send_sms':
      return <MessageSquare className="w-5 h-5" />;
    default:
      return <Briefcase className="w-5 h-5" />;
  }
}

export default async function ApprovalsPage() {
  const [pendingApprovals, recentApprovals] = await Promise.all([
    getPendingApprovals(),
    getRecentApprovals(),
  ]);

  return (
    <div>
      <Header title="Approvals" />

      <div className="p-6 space-y-6">
        {/* Alert Banner */}
        {pendingApprovals.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <div>
              <div className="font-medium text-yellow-800">
                {pendingApprovals.length} pending approval{pendingApprovals.length !== 1 ? 's' : ''}
              </div>
              <div className="text-sm text-yellow-700">
                Review and approve actions before they are executed
              </div>
            </div>
          </div>
        )}

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">
              Pending ({pendingApprovals.length})
            </TabsTrigger>
            <TabsTrigger value="history">
              History ({recentApprovals.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            {/* Pending Approvals */}
            <div className="space-y-4">
              {pendingApprovals.map((action) => (
                <ApprovalCard key={action.id} action={action} />
              ))}

              {pendingApprovals.length === 0 && (
                <Card>
                  <div className="py-12 text-center">
                    <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                    <div className="text-slate-500 font-medium">No pending approvals</div>
                    <div className="text-sm text-slate-400">
                      All actions have been reviewed
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {/* Recent Activity */}
            <Card padding="none">
              <div className="divide-y divide-slate-200">
                {recentApprovals.map((action) => {
                  const statusConfig = actionStatusConfig[action.status] || {
                    label: action.status,
                    color: 'bg-slate-100 text-slate-800',
                  };
                  const kindConfig = actionKindConfig[action.kind as keyof typeof actionKindConfig] || {
                    label: action.kind,
                  };

                  return (
                    <div key={action.id} className="px-6 py-4 flex items-center gap-4">
                      <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                        {getKindIcon(action.kind)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900">{kindConfig.label}</div>
                        <div className="text-sm text-slate-500">
                          {formatRelativeTime(action.updated_at)}
                          {action.source_type && (
                            <span> · from {action.source_type}</span>
                          )}
                        </div>
                      </div>

                      <Badge className={statusConfig.color}>{statusConfig.label}</Badge>

                      {action.error && (
                        <div className="text-sm text-red-600" title={action.error}>
                          <XCircle className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {recentApprovals.length === 0 && (
                  <div className="p-6 text-center text-slate-500">No recent activity</div>
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
