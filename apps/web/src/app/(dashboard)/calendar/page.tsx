// Murray's FSM - Calendar Page
// ==============================

import { createAdminClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import { Calendar, ExternalLink, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import type { CalendarEvent, Job } from '@/types/database';

interface CalendarEventWithJob extends CalendarEvent {
  job: Job | null;
}

async function getCalendarEvents(): Promise<CalendarEventWithJob[]> {
  const supabase = createAdminClient();

  // Note: calendar_events table may not exist in the current database schema
  const { data, error } = await supabase
    .from('calendar_events')
    .select(`
      *,
      job:jobs(*)
    `)
    .eq('deleted', false)
    .order('last_synced_at', { ascending: false })
    .limit(50);

  if (error) {
    // Silently return empty if table doesn't exist
    if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
      return [];
    }
    console.error('Error fetching calendar events:', error);
    return [];
  }

  return data || [];
}

const providerConfig = {
  google: { label: 'Google Calendar', color: 'bg-blue-100 text-blue-800' },
  outlook: { label: 'Outlook', color: 'bg-purple-100 text-purple-800' },
  icloud: { label: 'Apple iCloud', color: 'bg-slate-100 text-slate-800' },
};

export default async function CalendarPage() {
  const events = await getCalendarEvents();

  const stats = {
    total: events.length,
    google: events.filter((e) => e.provider === 'google').length,
    outlook: events.filter((e) => e.provider === 'outlook').length,
    icloud: events.filter((e) => e.provider === 'icloud').length,
  };

  return (
    <div>
      <Header title="Calendar Events" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-sm text-slate-500">Total Events</div>
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">Google</div>
            <div className="text-2xl font-bold text-blue-600">{stats.google}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">Outlook</div>
            <div className="text-2xl font-bold text-purple-600">{stats.outlook}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">iCloud</div>
            <div className="text-2xl font-bold text-slate-600">{stats.icloud}</div>
          </Card>
        </div>

        {/* Info Card */}
        <Card className="bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <div className="font-medium text-blue-900">Calendar Integration</div>
              <div className="text-sm text-blue-700 mt-1">
                Calendar events are automatically synced when jobs are scheduled or rescheduled.
                Events are created via n8n workflows after approval.
              </div>
            </div>
          </div>
        </Card>

        {/* Calendar Events Table */}
        <Card padding="none">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Synced Events</h2>
            <p className="text-sm text-slate-500">
              Calendar events linked to jobs
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Job
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Provider
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Last Synced
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    External ID
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {events.map((event) => {
                  const provider = providerConfig[event.provider] || {
                    label: event.provider,
                    color: 'bg-slate-100 text-slate-800',
                  };

                  return (
                    <tr key={event.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        {event.job ? (
                          <div>
                            <div className="font-medium text-slate-900">
                              {event.job.title}
                            </div>
                            {event.job.scheduled_start && (
                              <div className="text-sm text-slate-500">
                                {formatDate(event.job.scheduled_start, 'MMM d, yyyy h:mm a')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">Job not found</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={provider.color}>{provider.label}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          {event.status === 'created' || event.status === 'updated' ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-yellow-500" />
                          )}
                          <span className="text-sm text-slate-600 capitalize">
                            {event.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        <div className="flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" />
                          {formatRelativeTime(event.last_synced_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {event.external_event_id ? (
                          <div className="flex items-center gap-1">
                            <code className="text-xs bg-slate-100 px-2 py-1 rounded">
                              {event.external_event_id.slice(0, 20)}...
                            </code>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {events.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <div className="text-slate-500">No calendar events yet</div>
                      <div className="text-sm text-slate-400">
                        Events will be created when jobs are scheduled
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
