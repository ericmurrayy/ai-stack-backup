// Murray's FSM - Visual Dispatch Board
// ======================================
// Technician-lane dispatch view with drag-drop scheduling
// This is the enterprise dispatch board that competes with ServiceTitan
//
// Architecture: Server component fetches initial data, then hands off to
// DispatchRealtime client component for live Supabase Realtime updates.

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { DispatchRealtime } from './DispatchRealtime';

// ---------- Types ----------

interface DispatchTechnician {
  id: string;
  name: string;
  color: string;
  skills: string[];
  is_active: boolean;
  phone: string | null;
}

interface DispatchJob {
  id: string;
  title: string;
  status: string;
  service_category: string | null;
  urgency: string;
  scheduled_at: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  assigned_technician_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  address: string | null;
  description: string | null;
  created_at: string;
}

// ---------- Time Helpers (kept for future timeline view) ----------

function getHourSlots(): string[] {
  const slots: string[] = [];
  for (let h = 7; h <= 19; h++) {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    slots.push(`${hour12}:00 ${ampm}`);
  }
  return slots;
}

function getJobTimePosition(job: DispatchJob): { top: number; height: number } | null {
  const timeStr = job.scheduled_start || job.scheduled_at;
  if (!timeStr) return null;

  const date = new Date(timeStr);
  const hour = date.getHours();
  const minute = date.getMinutes();

  // Calculate position: 7 AM = 0, each hour = 80px
  const startHour = 7;
  if (hour < startHour || hour > 19) return null;

  const top = (hour - startHour) * 80 + (minute / 60) * 80;

  // Duration: use scheduled_end if available, otherwise default 1 hour
  let height = 80; // default 1 hour
  if (job.scheduled_end) {
    const endDate = new Date(job.scheduled_end);
    const durationMs = endDate.getTime() - date.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    height = Math.max(durationHours * 80, 40); // minimum 30min height
  }

  return { top, height };
}

// ---------- Data Fetcher ----------

async function getDispatchData(dateStr?: string) {
  const supabase = await createClient();

  // Target date (default: today)
  const targetDate = dateStr ? new Date(dateStr) : new Date();
  const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  // Fetch technicians
  const { data: techData } = await supabase
    .from('technicians')
    .select('id, name, color, skills, is_active, phone')
    .eq('deleted', false)
    .eq('is_active', true)
    .order('name');

  const technicians: DispatchTechnician[] = techData || [];

  // Fetch jobs for the target date (scheduled or created)
  const { data: jobData } = await supabase
    .from('jobs')
    .select(`
      id, title, status, service_category, urgency,
      scheduled_at, scheduled_start, scheduled_end,
      assigned_technician_id, description, created_at,
      customer:customers(name, phone),
      location:locations(address_line1, city)
    `)
    .eq('is_spam', false)
    .or(`scheduled_at.gte.${dayStart.toISOString()},scheduled_start.gte.${dayStart.toISOString()},and(scheduled_at.is.null,created_at.gte.${dayStart.toISOString()})`)
    .or(`scheduled_at.lt.${dayEnd.toISOString()},scheduled_start.lt.${dayEnd.toISOString()},and(scheduled_at.is.null,created_at.lt.${dayEnd.toISOString()})`)
    .not('status', 'eq', 'cancelled')
    .order('scheduled_start', { ascending: true, nullsFirst: false });

  const jobs: DispatchJob[] = (jobData || []).map((j: any) => ({
    id: j.id,
    title: j.title,
    status: j.status,
    service_category: j.service_category,
    urgency: j.urgency ?? 'medium',
    scheduled_at: j.scheduled_at,
    scheduled_start: j.scheduled_start,
    scheduled_end: j.scheduled_end,
    assigned_technician_id: j.assigned_technician_id,
    customer_name: j.customer?.name ?? null,
    customer_phone: j.customer?.phone ?? null,
    address: j.location ? `${j.location.address_line1 || ''}${j.location.city ? ', ' + j.location.city : ''}` : null,
    description: j.description,
    created_at: j.created_at,
  }));

  return {
    technicians,
    jobs,
    targetDate: dayStart.toISOString().split('T')[0],
  };
}

// ---------- Main Page (Server Component) ----------

export default async function DispatchPage() {
  const { technicians, jobs, targetDate } = await getDispatchData();

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const isToday = targetDate === todayStr;

  const formattedDate = formatDate(targetDate, 'EEEE, MMMM d, yyyy');

  return (
    <div>
      <Header title="Dispatch Board" />

      <div className="p-6 space-y-6">
        {/* Date Navigation (server-rendered, static) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarDays className="w-5 h-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-900">{formattedDate}</h2>
            {isToday && (
              <Badge className="bg-blue-100 text-blue-800">Today</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/dispatch?date=${new Date(new Date(targetDate).getTime() - 86400000).toISOString().split('T')[0]}`}
              className="px-3 py-1.5 text-sm text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </Link>
            {!isToday && (
              <Link
                href="/dispatch"
                className="px-3 py-1.5 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
              >
                Today
              </Link>
            )}
            <Link
              href={`/dispatch?date=${new Date(new Date(targetDate).getTime() + 86400000).toISOString().split('T')[0]}`}
              className="px-3 py-1.5 text-sm text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-1"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Real-time interactive section (client component) */}
        <DispatchRealtime
          initialJobs={jobs}
          initialTechnicians={technicians}
          targetDate={targetDate}
        />
      </div>
    </div>
  );
}
