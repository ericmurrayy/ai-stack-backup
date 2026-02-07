// Murray's FSM - Calls Page
// ===========================

import { createAdminClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatPhone, formatRelativeTime, formatDuration, formatDateTime } from '@/lib/utils';
import { Phone, PhoneIncoming, PhoneOutgoing, Clock, FileText, Mic } from 'lucide-react';
import Link from 'next/link';
import type { CallLog } from '@/types/database';

async function getCalls(): Promise<CallLog[]> {
  const supabase = createAdminClient();

  // Note: call_logs table may not exist in the current database schema
  const { data, error } = await supabase
    .from('call_logs')
    .select('*')
    .eq('deleted', false)
    .order('started_at', { ascending: false })
    .limit(50);

  if (error) {
    // Silently return empty if table doesn't exist
    if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
      return [];
    }
    console.error('Error fetching calls:', error);
    return [];
  }

  return data || [];
}

export default async function CallsPage() {
  const calls = await getCalls();

  const stats = {
    total: calls.length,
    inbound: calls.filter((c) => c.direction === 'inbound').length,
    outbound: calls.filter((c) => c.direction === 'outbound').length,
    withTranscript: calls.filter((c) => c.transcript).length,
  };

  return (
    <div>
      <Header title="Calls" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-sm text-slate-500">Total Calls</div>
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">Inbound</div>
            <div className="text-2xl font-bold text-green-600">{stats.inbound}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">Outbound</div>
            <div className="text-2xl font-bold text-blue-600">{stats.outbound}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">With Transcripts</div>
            <div className="text-2xl font-bold text-purple-600">{stats.withTranscript}</div>
          </Card>
        </div>

        {/* Calls List */}
        <Card padding="none">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Call History</h2>
            <p className="text-sm text-slate-500">
              All calls from your Quo/OpenPhone inbox
            </p>
          </div>

          <div className="divide-y divide-slate-200">
            {calls.map((call) => (
              <div key={call.id} className="p-6 hover:bg-slate-50">
                <div className="flex items-start gap-4">
                  <div
                    className={`p-3 rounded-lg ${
                      call.direction === 'inbound'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {call.direction === 'inbound' ? (
                      <PhoneIncoming className="w-5 h-5" />
                    ) : (
                      <PhoneOutgoing className="w-5 h-5" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-slate-900">
                        {call.direction === 'inbound'
                          ? formatPhone(call.from_phone)
                          : formatPhone(call.to_phone)}
                      </span>
                      <Badge variant={call.direction === 'inbound' ? 'success' : 'info'}>
                        {call.direction}
                      </Badge>
                      {call.answered_at && (
                        <span className="text-sm text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(call.duration_seconds)}
                        </span>
                      )}
                    </div>

                    {/* Summary */}
                    {call.summary && (
                      <div className="text-sm text-slate-600 mb-2 line-clamp-2">
                        {call.summary}
                      </div>
                    )}

                    {/* Action Items */}
                    {call.action_items && (call.action_items as string[]).length > 0 && (
                      <div className="text-sm text-slate-500 mb-2">
                        <strong>Action Items:</strong>
                        <ul className="list-disc list-inside ml-2">
                          {(call.action_items as string[]).slice(0, 3).map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span>{formatDateTime(call.started_at)}</span>
                      {call.transcript && (
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          Transcript available
                        </span>
                      )}
                      {call.recording_url && (
                        <span className="flex items-center gap-1">
                          <Mic className="w-3 h-3" />
                          Recording
                        </span>
                      )}
                    </div>
                  </div>

                  <Link
                    href={`/calls/${call.id}`}
                    className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}

            {calls.length === 0 && (
              <div className="p-12 text-center">
                <Phone className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <div className="text-slate-500">No calls recorded</div>
                <div className="text-sm text-slate-400">
                  Calls from your Quo/OpenPhone inbox will appear here
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
