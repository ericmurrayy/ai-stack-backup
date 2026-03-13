// Murray's FSM - Approvals Page
// ===============================
// Critical page for approval-gated automation

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatRelativeTime, actionStatusConfig, actionKindConfig } from '@/lib/utils';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Briefcase,
  Calendar,
  FileText,
  Send,
  MessageSquare
} from 'lucide-react';
import { ApprovalActions } from './ApprovalActions';
import type { ActionQueueItem } from '@/types/database';

async function getPendingApprovals(): Promise<ActionQueueItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('action_queue')
    .select('*')
    .eq('deleted', false)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching approvals:', error);
    return [];
  }

  return data || [];
}

async function getRecentApprovals(): Promise<ActionQueueItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('action_queue')
    .select('*')
    .eq('deleted', false)
    .neq('status', 'pending')
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error) {
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
            <AlertCircle className="w-5 h-5 text-yellow-600" />
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

        {/* Pending Approvals */}
        <Card padding="none">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Pending Approvals</h2>
            <p className="text-sm text-slate-500">
              Actions waiting for your approval before execution
            </p>
          </div>

          <div className="divide-y divide-slate-200">
            {pendingApprovals.map((action) => {
              const kindConfig = actionKindConfig[action.kind as keyof typeof actionKindConfig] || {
                label: action.kind,
              };

              return (
                <div key={action.id} className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-yellow-100 rounded-lg text-yellow-700">
                      {getKindIcon(action.kind)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-slate-900">{kindConfig.label}</span>
                        <Badge variant="warning">Pending</Badge>
                        <span className="text-sm text-slate-500">
                          from {action.source_type}
                        </span>
                      </div>

                      {/* Payload Preview */}
                      <div className="text-sm text-slate-600 mb-3">
                        {action.kind === 'create_job' && action.payload && (
                          <div>
                            <strong>Job:</strong> {(action.payload as any).title || 'New Job'}
                            {(action.payload as any).customer?.name && (
                              <span> for {(action.payload as any).customer.name}</span>
                            )}
                          </div>
                        )}
                        {action.kind === 'schedule_job' && action.payload && (
                          <div>
                            <strong>Schedule:</strong>{' '}
                            {(action.payload as any).scheduled_start || 'TBD'}
                          </div>
                        )}
                        {action.kind === 'send_estimate' && (
                          <div>
                            <strong>Send estimate</strong> to customer
                          </div>
                        )}
                        {action.kind === 'send_sms' && action.payload && (
                          <div>
                            <strong>Message:</strong> {(action.payload as any).message?.substring(0, 100)}...
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-slate-400">
                        Created {formatRelativeTime(action.created_at)}
                      </div>
                    </div>

                    <ApprovalActions actionId={action.id} />
                  </div>
                </div>
              );
            })}

            {pendingApprovals.length === 0 && (
              <div className="p-12 text-center">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <div className="text-slate-500">No pending approvals</div>
                <div className="text-sm text-slate-400">
                  All actions have been reviewed
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Recent Activity */}
        <Card padding="none">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
          </div>

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
      </div>
    </div>
  );
}
