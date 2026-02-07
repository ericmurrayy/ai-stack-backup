// Murray's FSM - Texts Page
// ===========================

import { createAdminClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatPhone, formatRelativeTime } from '@/lib/utils';
import { MessageSquare, ArrowDownLeft, ArrowUpRight, Image as ImageIcon } from 'lucide-react';
import type { MessageLog } from '@/types/database';

async function getMessages(): Promise<MessageLog[]> {
  const supabase = createAdminClient();

  // Note: message_logs table may not exist in the current database schema
  const { data, error } = await supabase
    .from('message_logs')
    .select('*')
    .eq('deleted', false)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    // Silently return empty if table doesn't exist
    if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
      return [];
    }
    console.error('Error fetching messages:', error);
    return [];
  }

  return data || [];
}

export default async function TextsPage() {
  const messages = await getMessages();

  const stats = {
    total: messages.length,
    inbound: messages.filter((m) => m.direction === 'inbound').length,
    outbound: messages.filter((m) => m.direction === 'outbound').length,
  };

  // Group messages by thread/contact
  const threads = messages.reduce(
    (acc, msg) => {
      const contactPhone = msg.direction === 'inbound' ? msg.from_phone : msg.to_phone;
      if (!acc[contactPhone]) {
        acc[contactPhone] = [];
      }
      acc[contactPhone].push(msg);
      return acc;
    },
    {} as Record<string, MessageLog[]>
  );

  return (
    <div>
      <Header title="Texts" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-sm text-slate-500">Total Messages</div>
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">Received</div>
            <div className="text-2xl font-bold text-green-600">{stats.inbound}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">Sent</div>
            <div className="text-2xl font-bold text-blue-600">{stats.outbound}</div>
          </Card>
        </div>

        {/* Messages by Thread */}
        <Card padding="none">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Conversations</h2>
            <p className="text-sm text-slate-500">
              SMS/MMS messages from your Quo/OpenPhone inbox
            </p>
          </div>

          <div className="divide-y divide-slate-200">
            {Object.entries(threads).map(([phone, threadMessages]) => {
              const latestMessage = threadMessages[0];
              const hasMedia =
                threadMessages.some((m) => (m.media as unknown[])?.length > 0);

              return (
                <div key={phone} className="p-4 hover:bg-slate-50 cursor-pointer">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-5 h-5 text-primary-700" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-slate-900">
                          {formatPhone(phone)}
                        </span>
                        <Badge variant="default" className="text-xs">
                          {threadMessages.length} messages
                        </Badge>
                        {hasMedia && (
                          <ImageIcon className="w-4 h-4 text-slate-400" />
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        {latestMessage.direction === 'inbound' ? (
                          <ArrowDownLeft className="w-3 h-3 text-green-500" />
                        ) : (
                          <ArrowUpRight className="w-3 h-3 text-blue-500" />
                        )}
                        <span className="line-clamp-1">
                          {latestMessage.body || '[Media message]'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-400 mt-1">
                        {formatRelativeTime(latestMessage.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {Object.keys(threads).length === 0 && (
              <div className="p-12 text-center">
                <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <div className="text-slate-500">No messages yet</div>
                <div className="text-sm text-slate-400">
                  SMS/MMS from your Quo/OpenPhone inbox will appear here
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Recent Messages (Flat List) */}
        <Card padding="none">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Recent Messages</h2>
          </div>

          <div className="divide-y divide-slate-200 max-h-96 overflow-y-auto">
            {messages.slice(0, 20).map((msg) => (
              <div key={msg.id} className="px-6 py-3 flex items-center gap-3">
                {msg.direction === 'inbound' ? (
                  <ArrowDownLeft className="w-4 h-4 text-green-500" />
                ) : (
                  <ArrowUpRight className="w-4 h-4 text-blue-500" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700">
                    {formatPhone(
                      msg.direction === 'inbound' ? msg.from_phone : msg.to_phone
                    )}
                  </div>
                  <div className="text-sm text-slate-500 truncate">
                    {msg.body || '[Media]'}
                  </div>
                </div>

                <div className="text-xs text-slate-400">
                  {formatRelativeTime(msg.created_at)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
