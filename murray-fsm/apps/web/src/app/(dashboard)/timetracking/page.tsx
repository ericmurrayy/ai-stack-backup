// Murray's FSM - Time Tracking Page
// ====================================
// Track technician hours, overtime, and time-off

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatRelativeTime, formatDate } from '@/lib/utils';
import {
  Clock,
  Users,
  Calendar,
  Timer,
  Play,
  Pause,
  Check,
  AlertTriangle,
  TrendingUp,
  DollarSign,
} from 'lucide-react';

// ---------- Types ----------

interface TimeEntryRow {
  id: string;
  technician_id: string;
  job_id: string | null;
  duration_minutes: number;
  notes: string | null;
  created_at: string;
  tech_name: string;
  tech_color: string;
  job_title: string | null;
}

// ---------- Data Fetcher ----------

async function getTimeData() {
  const supabase = createClient();
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Time entries with technician and job info
  const { data: entries } = await supabase
    .from('time_entries')
    .select(`
      id, technician_id, job_id, duration_minutes, notes, created_at,
      technician:technicians(name, color),
      job:jobs(title)
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  const rows: TimeEntryRow[] = (entries || []).map((e: any) => ({
    id: e.id,
    technician_id: e.technician_id,
    job_id: e.job_id,
    duration_minutes: e.duration_minutes || 0,
    notes: e.notes,
    created_at: e.created_at,
    tech_name: Array.isArray(e.technician) ? e.technician[0]?.name : e.technician?.name || 'Unknown',
    tech_color: Array.isArray(e.technician) ? e.technician[0]?.color : e.technician?.color || '#94a3b8',
    job_title: Array.isArray(e.job) ? e.job[0]?.title : e.job?.title || null,
  }));

  // Technician summaries
  const techSummary: Record<string, { name: string; color: string; totalMinutes: number; jobCount: number }> = {};
  rows.forEach(r => {
    if (!techSummary[r.technician_id]) {
      techSummary[r.technician_id] = { name: r.tech_name, color: r.tech_color, totalMinutes: 0, jobCount: 0 };
    }
    techSummary[r.technician_id].totalMinutes += r.duration_minutes;
    if (r.job_id) techSummary[r.technician_id].jobCount++;
  });

  // Weekly hours
  const weekEntries = rows.filter(r => new Date(r.created_at) >= weekStart);
  const weeklyHours = Math.round(weekEntries.reduce((s, e) => s + e.duration_minutes, 0) / 60 * 10) / 10;

  // Monthly hours
  const monthEntries = rows.filter(r => new Date(r.created_at) >= monthStart);
  const monthlyHours = Math.round(monthEntries.reduce((s, e) => s + e.duration_minutes, 0) / 60 * 10) / 10;

  // Overtime (over 40h/week per technician)
  const weeklyByTech: Record<string, number> = {};
  weekEntries.forEach(e => {
    weeklyByTech[e.technician_id] = (weeklyByTech[e.technician_id] || 0) + e.duration_minutes;
  });
  const overtimeTechs = Object.entries(weeklyByTech)
    .filter(([, mins]) => mins > 40 * 60)
    .length;

  return {
    entries: rows,
    techSummaries: Object.values(techSummary).sort((a, b) => b.totalMinutes - a.totalMinutes),
    weeklyHours,
    monthlyHours,
    totalEntries: rows.length,
    overtimeTechs,
  };
}

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ---------- Page ----------

export default async function TimeTrackingPage() {
  const data = await getTimeData();

  return (
    <div>
      <Header title="Time Tracking" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{data.weeklyHours}h</div>
                <div className="text-sm text-slate-500">This Week</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{data.monthlyHours}h</div>
                <div className="text-sm text-slate-500">This Month</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50">
                <Timer className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{data.totalEntries}</div>
                <div className="text-sm text-slate-500">Time Entries</div>
              </div>
            </div>
          </Card>
          {data.overtimeTechs > 0 ? (
            <Card className="p-4 border-red-200 bg-red-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{data.overtimeTechs}</div>
                  <div className="text-sm text-red-700">Overtime Alert</div>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-50">
                  <Check className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <div className="text-lg font-bold text-green-600">No Overtime</div>
                  <div className="text-sm text-slate-500">All within limits</div>
                </div>
              </div>
            </Card>
          )}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Tech Summary */}
          <Card padding="none" className="p-5">
            <h3 className="font-semibold text-slate-900 mb-4">Hours by Technician</h3>
            <div className="space-y-4">
              {data.techSummaries.map(tech => {
                const hours = Math.round(tech.totalMinutes / 60 * 10) / 10;
                const maxHours = Math.max(...data.techSummaries.map(t => t.totalMinutes / 60), 1);
                const percentage = Math.round((hours / maxHours) * 100);
                return (
                  <div key={tech.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tech.color }}
                        />
                        <span className="text-sm font-medium text-slate-900">{tech.name}</span>
                      </div>
                      <span className="text-sm text-slate-600">{hours}h</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${percentage}%`, backgroundColor: tech.color }}
                      />
                    </div>
                    <div className="text-xs text-slate-400 mt-1">{tech.jobCount} jobs</div>
                  </div>
                );
              })}
              {data.techSummaries.length === 0 && (
                <p className="text-sm text-slate-400">No time entries yet</p>
              )}
            </div>
          </Card>

          {/* Time Entries Table */}
          <div className="col-span-2">
            <Card padding="none">
              <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Recent Time Entries</h3>
                <Button variant="outline" size="sm">
                  <Play className="w-4 h-4" />
                  Log Time
                </Button>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase">Technician</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase">Job</th>
                    <th className="text-center px-5 py-3 text-xs font-medium text-slate-500 uppercase">Duration</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase">Notes</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.entries.slice(0, 20).map(entry => (
                    <tr key={entry.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: entry.tech_color }}
                          >
                            {entry.tech_name.charAt(0)}
                          </div>
                          <span className="text-sm font-medium text-slate-900">{entry.tech_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-600">
                        {entry.job_title || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <Badge className="bg-blue-100 text-blue-800">{formatHours(entry.duration_minutes)}</Badge>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-500 max-w-[200px] truncate">
                        {entry.notes || '—'}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-400">
                        {formatRelativeTime(entry.created_at)}
                      </td>
                    </tr>
                  ))}
                  {data.entries.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center">
                        <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <div className="text-slate-500">No time entries recorded</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
