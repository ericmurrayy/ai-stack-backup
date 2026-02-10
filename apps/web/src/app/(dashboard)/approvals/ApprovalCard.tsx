// Murray's FSM - Approval Card Component
// =======================================

'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatRelativeTime, actionKindConfig, formatPhone, formatDuration } from '@/lib/utils';
import {
  Calendar,
  FileText,
  Briefcase,
  MessageSquare,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  ChevronDown,
  ChevronUp,
  Mic,
  Play,
} from 'lucide-react';
import { ApprovalActions } from './ApprovalActions';
import type { ActionQueueItem, CallLog } from '@/types/database';
import Link from 'next/link';

interface ActionWithCall extends ActionQueueItem {
  relatedCall?: CallLog;
}

interface ApprovalCardProps {
  action: ActionWithCall;
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

export function ApprovalCard({ action }: ApprovalCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const kindConfig = actionKindConfig[action.kind as keyof typeof actionKindConfig] || {
    label: action.kind,
  };

  const call = action.relatedCall;

  return (
    <Card padding="none" className="overflow-hidden">
      {/* Main Card Content */}
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-yellow-100 rounded-lg text-yellow-700">
            {getKindIcon(action.kind)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-slate-900">{kindConfig.label}</span>
              <Badge variant="warning">Pending</Badge>
              <span className="text-sm text-slate-500">from {action.source_type}</span>
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
                  <strong>Schedule:</strong> {(action.payload as any).scheduled_start || 'TBD'}
                </div>
              )}
              {action.kind === 'send_estimate' && (
                <div>
                  <strong>Send estimate</strong> to customer
                </div>
              )}
              {action.kind === 'send_sms' && action.payload && (
                <div>
                  <strong>Message:</strong> {(action.payload as any).message?.substring(0, 100)}
                  {(action.payload as any).message?.length > 100 && '...'}
                </div>
              )}
            </div>

            <div className="text-xs text-slate-400">
              Created {formatRelativeTime(action.created_at)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Expand Button (only if there's a related call) */}
            {call && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Phone className="w-4 h-4" />
                {isExpanded ? 'Hide Call' : 'View Call'}
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            )}

            <ApprovalActions actionId={action.id} payload={action.payload} kind={action.kind} />
          </div>
        </div>
      </div>

      {/* Expanded Call Details */}
      {isExpanded && call && (
        <div className="border-t border-slate-200 bg-slate-50">
          {/* Call Header */}
          <div className="p-4 border-b border-slate-200 flex items-center gap-4">
            <div
              className={`p-2 rounded-lg ${
                call.direction === 'inbound'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {call.direction === 'inbound' ? (
                <PhoneIncoming className="w-4 h-4" />
              ) : (
                <PhoneOutgoing className="w-4 h-4" />
              )}
            </div>

            <div className="flex-1">
              <div className="font-medium text-slate-900">
                {formatPhone(call.direction === 'inbound' ? call.from_phone : call.to_phone)}
              </div>
              <div className="text-sm text-slate-500 flex items-center gap-3">
                <span>{call.direction === 'inbound' ? 'Inbound' : 'Outbound'} call</span>
                {call.duration_seconds && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration(call.duration_seconds)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {call.recording_url && (
                <a
                  href={call.recording_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Play
                </a>
              )}
              <Link
                href={`/calls/${call.id}`}
                className="text-sm text-primary-600 hover:text-primary-800"
              >
                Full Details
              </Link>
            </div>
          </div>

          {/* Call Summary */}
          {call.summary && (
            <div className="p-4 border-b border-slate-200">
              <h4 className="text-sm font-medium text-slate-700 mb-2">Summary</h4>
              <p className="text-sm text-slate-600">{call.summary}</p>
            </div>
          )}

          {/* Call Transcript */}
          {call.transcript && (
            <div className="p-4">
              <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                Transcript
              </h4>
              <div className="bg-white rounded-lg p-4 max-h-64 overflow-y-auto border border-slate-200">
                <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {call.transcript}
                </pre>
              </div>
            </div>
          )}

          {/* Action Items from Call */}
          {call.action_items && (call.action_items as string[]).length > 0 && (
            <div className="p-4 border-t border-slate-200">
              <h4 className="text-sm font-medium text-slate-700 mb-2">AI-Extracted Action Items</h4>
              <ul className="space-y-1">
                {(call.action_items as string[]).map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="w-5 h-5 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
                      {i + 1}
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
