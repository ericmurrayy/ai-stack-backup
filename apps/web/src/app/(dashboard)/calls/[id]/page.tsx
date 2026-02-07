// Murray's FSM - Call Detail Page
// =================================

import { createAdminClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatPhone, formatRelativeTime, formatDuration, formatDateTime } from '@/lib/utils';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  FileText,
  Mic,
  User,
  Calendar,
  ArrowLeft,
  Play,
  CheckCircle,
  AlertCircle,
  Briefcase,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CallLog } from '@/types/database';

interface PageProps {
  params: { id: string };
}

async function getCall(id: string): Promise<CallLog | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('call_logs')
    .select('*')
    .eq('id', id)
    .eq('deleted', false)
    .single();

  if (error) {
    console.error('Error fetching call:', error);
    return null;
  }

  return data;
}

async function getRelatedActions(callId: string) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('action_queue')
    .select('*')
    .eq('source_id', callId)
    .eq('deleted', false)
    .order('created_at', { ascending: false });

  if (error) {
    return [];
  }

  return data || [];
}

export default async function CallDetailPage({ params }: PageProps) {
  const call = await getCall(params.id);

  if (!call) {
    notFound();
  }

  const relatedActions = await getRelatedActions(call.id);

  // Parse AI extraction data
  const aiExtraction = call.ai_extraction as {
    customerName?: string;
    serviceType?: string;
    urgency?: string;
    isSpam?: boolean;
    spamReason?: string;
    keyPoints?: string[];
    nextSteps?: string[];
  } | null;

  return (
    <div>
      <Header
        title="Call Details"
        breadcrumbs={[
          { label: 'Calls', href: '/calls' },
          { label: formatPhone(call.direction === 'inbound' ? call.from_phone : call.to_phone) },
        ]}
      />

      <div className="p-6 space-y-6">
        {/* Back Button */}
        <Link
          href="/calls"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Calls
        </Link>

        <div className="grid grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="col-span-2 space-y-6">
            {/* Call Header Card */}
            <Card>
              <div className="flex items-start gap-4">
                <div
                  className={`p-4 rounded-xl ${
                    call.direction === 'inbound'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {call.direction === 'inbound' ? (
                    <PhoneIncoming className="w-8 h-8" />
                  ) : (
                    <PhoneOutgoing className="w-8 h-8" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-bold text-slate-900">
                      {formatPhone(call.direction === 'inbound' ? call.from_phone : call.to_phone)}
                    </h2>
                    <Badge variant={call.direction === 'inbound' ? 'success' : 'info'} size="lg">
                      {call.direction}
                    </Badge>
                    {call.answered_at ? (
                      <Badge variant="success">Answered</Badge>
                    ) : (
                      <Badge variant="warning">Missed</Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-6 text-sm text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      {formatDateTime(call.started_at)}
                    </span>
                    {call.duration_seconds && (
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        {formatDuration(call.duration_seconds)}
                      </span>
                    )}
                    {call.recording_url && (
                      <a
                        href={call.recording_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-primary-600 hover:text-primary-800"
                      >
                        <Play className="w-4 h-4" />
                        Play Recording
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Summary Card */}
            {call.summary && (
              <Card>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Summary</h3>
                <p className="text-slate-700 leading-relaxed">{call.summary}</p>
              </Card>
            )}

            {/* Transcript Card */}
            {call.transcript && (
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-slate-400" />
                    Transcript
                  </h3>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                  <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                    {call.transcript}
                  </pre>
                </div>
              </Card>
            )}

            {/* Action Items Card */}
            {call.action_items && (call.action_items as string[]).length > 0 && (
              <Card>
                <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Action Items
                </h3>
                <ul className="space-y-2">
                  {(call.action_items as string[]).map((item, i) => (
                    <li key={i} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                      <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* Related Actions Card */}
            {relatedActions.length > 0 && (
              <Card>
                <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-slate-400" />
                  Generated Actions
                </h3>
                <div className="space-y-3">
                  {relatedActions.map((action) => (
                    <div
                      key={action.id}
                      className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-slate-900">{action.kind}</div>
                        <div className="text-sm text-slate-500">
                          {formatRelativeTime(action.created_at)}
                        </div>
                      </div>
                      <Badge
                        variant={
                          action.status === 'approved' || action.status === 'executed'
                            ? 'success'
                            : action.status === 'pending'
                              ? 'warning'
                              : 'error'
                        }
                      >
                        {action.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* AI Analysis Card */}
            {aiExtraction && Object.keys(aiExtraction).length > 0 && (
              <Card>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">AI Analysis</h3>
                <div className="space-y-4">
                  {aiExtraction.isSpam && (
                    <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex items-center gap-2 text-red-700 font-medium mb-1">
                        <AlertCircle className="w-4 h-4" />
                        Marked as Spam
                      </div>
                      {aiExtraction.spamReason && (
                        <div className="text-sm text-red-600">{aiExtraction.spamReason}</div>
                      )}
                    </div>
                  )}

                  {aiExtraction.customerName && (
                    <div>
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                        Customer
                      </div>
                      <div className="flex items-center gap-2 text-slate-900">
                        <User className="w-4 h-4 text-slate-400" />
                        {aiExtraction.customerName}
                      </div>
                    </div>
                  )}

                  {aiExtraction.serviceType && (
                    <div>
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                        Service Type
                      </div>
                      <Badge variant="info">{aiExtraction.serviceType}</Badge>
                    </div>
                  )}

                  {aiExtraction.urgency && (
                    <div>
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                        Urgency
                      </div>
                      <Badge
                        variant={
                          aiExtraction.urgency === 'high'
                            ? 'error'
                            : aiExtraction.urgency === 'medium'
                              ? 'warning'
                              : 'success'
                        }
                      >
                        {aiExtraction.urgency}
                      </Badge>
                    </div>
                  )}

                  {aiExtraction.keyPoints && aiExtraction.keyPoints.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                        Key Points
                      </div>
                      <ul className="space-y-1">
                        {aiExtraction.keyPoints.map((point, i) => (
                          <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                            <span className="text-primary-500 mt-1">•</span>
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Call Details Card */}
            <Card>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Call Details</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    From
                  </dt>
                  <dd className="text-slate-900 font-medium">{formatPhone(call.from_phone)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    To
                  </dt>
                  <dd className="text-slate-900 font-medium">{formatPhone(call.to_phone)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Started
                  </dt>
                  <dd className="text-slate-700">{formatDateTime(call.started_at)}</dd>
                </div>
                {call.answered_at && (
                  <div>
                    <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Answered
                    </dt>
                    <dd className="text-slate-700">{formatDateTime(call.answered_at)}</dd>
                  </div>
                )}
                {call.ended_at && (
                  <div>
                    <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Ended
                    </dt>
                    <dd className="text-slate-700">{formatDateTime(call.ended_at)}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    External ID
                  </dt>
                  <dd className="text-slate-500 text-sm font-mono truncate">
                    {call.external_call_id}
                  </dd>
                </div>
              </dl>
            </Card>

            {/* Quick Actions Card */}
            <Card>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Button variant="primary" className="w-full justify-center">
                  <Briefcase className="w-4 h-4 mr-2" />
                  Create Job
                </Button>
                <Button variant="outline" className="w-full justify-center">
                  <User className="w-4 h-4 mr-2" />
                  View Customer
                </Button>
                {call.recording_url && (
                  <a
                    href={call.recording_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <Button variant="outline" className="w-full justify-center">
                      <Play className="w-4 h-4 mr-2" />
                      Play Recording
                    </Button>
                  </a>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
