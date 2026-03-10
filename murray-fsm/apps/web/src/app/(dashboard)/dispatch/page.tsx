// Murray's FSM - Visual Dispatch Board
// ======================================
// Technician-lane dispatch view with drag-drop scheduling
// This is the enterprise dispatch board that competes with ServiceTitan

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCents, formatDate } from '@/lib/utils';
import {
  MapPin,
  Clock,
  User,
  Phone,
  AlertTriangle,
  CalendarDays,
  Zap,
  ChevronLeft,
  ChevronRight,
  Users,
  Briefcase,
  CheckCircle,
  CircleDot,
} from 'lucide-react';
import Link from 'next/link';

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

// ---------- Config ----------

const urgencyConfig: Record<string, { color: string; label: string; dotColor: string }> = {
  low: { color: 'bg-slate-100 text-slate-700', label: 'Low', dotColor: 'bg-slate-400' },
  medium: { color: 'bg-blue-100 text-blue-700', label: 'Medium', dotColor: 'bg-blue-500' },
  high: { color: 'bg-orange-100 text-orange-700', label: 'High', dotColor: 'bg-orange-500' },
  emergency: { color: 'bg-red-100 text-red-700', label: 'Emergency', dotColor: 'bg-red-600' },
};

const statusConfig: Record<string, { color: string; label: string }> = {
  new: { color: 'bg-purple-100 text-purple-800', label: 'New' },
  contacted: { color: 'bg-indigo-100 text-indigo-800', label: 'Contacted' },
  scheduled: { color: 'bg-blue-100 text-blue-800', label: 'Scheduled' },
  in_progress: { color: 'bg-yellow-100 text-yellow-800', label: 'In Progress' },
  completed: { color: 'bg-green-100 text-green-800', label: 'Completed' },
  cancelled: { color: 'bg-red-100 text-red-800', label: 'Cancelled' },
};

// ---------- Time Helpers ----------

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

function formatTimeShort(dateStr: string): string {
  const d = new Date(dateStr);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

// ---------- Data Fetcher ----------

async function getDispatchData(dateStr?: string) {
  const supabase = createClient();

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

  // Unassigned jobs
  const unassignedJobs = jobs.filter(j => !j.assigned_technician_id);

  // Stats
  const stats = {
    totalJobs: jobs.length,
    assigned: jobs.filter(j => j.assigned_technician_id).length,
    unassigned: unassignedJobs.length,
    inProgress: jobs.filter(j => j.status === 'in_progress').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    emergencies: jobs.filter(j => j.urgency === 'emergency').length,
  };

  return {
    technicians,
    jobs,
    unassignedJobs,
    stats,
    targetDate: dayStart.toISOString().split('T')[0],
  };
}

// ---------- Job Card Component ----------

function DispatchJobCard({ job, compact = false }: { job: DispatchJob; compact?: boolean }) {
  const urgency = urgencyConfig[job.urgency] || urgencyConfig.medium;
  const status = statusConfig[job.status] || statusConfig.new;

  if (compact) {
    return (
      <Link href={`/jobs#${job.id}`}>
        <div className="bg-white border border-slate-200 rounded-lg p-2.5 hover:shadow-md transition-all cursor-pointer group">
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${urgency.dotColor}`} />
            <span className="text-sm font-medium text-slate-900 truncate group-hover:text-blue-600">
              {job.title}
            </span>
          </div>
          {job.customer_name && (
            <div className="text-xs text-slate-500 truncate ml-4">{job.customer_name}</div>
          )}
          {(job.scheduled_start || job.scheduled_at) && (
            <div className="text-xs text-slate-400 ml-4 mt-0.5">
              {formatTimeShort(job.scheduled_start || job.scheduled_at!)}
            </div>
          )}
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/jobs#${job.id}`}>
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-3 hover:shadow-md transition-all cursor-pointer group border-l-4 ${
        job.urgency === 'emergency' ? 'border-l-red-600' : job.urgency === 'high' ? 'border-l-orange-500' : 'border-l-blue-500'
      }`}>
        <div className="flex items-start justify-between mb-1.5">
          <span className="text-sm font-medium text-slate-900 group-hover:text-blue-600 truncate">
            {job.title}
          </span>
          <Badge className={`${status.color} text-xs flex-shrink-0 ml-2`}>{status.label}</Badge>
        </div>

        {job.customer_name && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-1">
            <User className="w-3 h-3 text-slate-400" />
            <span className="truncate">{job.customer_name}</span>
            {job.customer_phone && (
              <>
                <span className="text-slate-300">·</span>
                <Phone className="w-3 h-3 text-slate-400" />
                <span>{job.customer_phone}</span>
              </>
            )}
          </div>
        )}

        {job.address && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
            <MapPin className="w-3 h-3 text-slate-400" />
            <span className="truncate">{job.address}</span>
          </div>
        )}

        <div className="flex items-center gap-2 mt-2">
          {(job.scheduled_start || job.scheduled_at) && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Clock className="w-3 h-3" />
              {formatTimeShort(job.scheduled_start || job.scheduled_at!)}
              {job.scheduled_end && ` - ${formatTimeShort(job.scheduled_end)}`}
            </span>
          )}
          <Badge className={`${urgency.color} text-xs`}>{urgency.label}</Badge>
          {job.service_category && (
            <span className="text-xs text-slate-400 capitalize">{job.service_category}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ---------- Technician Lane Component ----------

function TechnicianLane({
  technician,
  jobs,
}: {
  technician: DispatchTechnician;
  jobs: DispatchJob[];
}) {
  const jobCount = jobs.length;
  const inProgress = jobs.filter(j => j.status === 'in_progress').length;
  const completed = jobs.filter(j => j.status === 'completed').length;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      {/* Technician Header */}
      <div className="px-3 py-2.5 border-b border-slate-100 flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
          style={{ backgroundColor: technician.color }}
        >
          {technician.name.split(' ').map(n => n[0]).join('')}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900 truncate">{technician.name}</div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{jobCount} job{jobCount !== 1 ? 's' : ''}</span>
            {inProgress > 0 && (
              <span className="text-yellow-600 font-medium">{inProgress} active</span>
            )}
            {completed > 0 && (
              <span className="text-green-600">{completed} done</span>
            )}
          </div>
        </div>
        {technician.phone && (
          <a
            href={`tel:${technician.phone}`}
            className="p-1.5 hover:bg-slate-100 rounded-md transition-colors"
            title={`Call ${technician.name}`}
          >
            <Phone className="w-3.5 h-3.5 text-slate-400" />
          </a>
        )}
      </div>

      {/* Jobs List */}
      <div className="p-2 space-y-2 min-h-[120px] max-h-[600px] overflow-y-auto">
        {jobs.length > 0 ? (
          jobs.map(job => (
            <DispatchJobCard key={job.id} job={job} compact />
          ))
        ) : (
          <div className="flex items-center justify-center h-[100px] text-sm text-slate-400">
            No jobs assigned
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Main Page ----------

export default async function DispatchPage() {
  const { technicians, jobs, unassignedJobs, stats, targetDate } = await getDispatchData();

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const isToday = targetDate === todayStr;

  const formattedDate = formatDate(targetDate, 'EEEE, MMMM d, yyyy');

  return (
    <div>
      <Header title="Dispatch Board" />

      <div className="p-6 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-6 gap-4">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-50">
                <Briefcase className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <div className="text-xl font-bold text-slate-900">{stats.totalJobs}</div>
                <div className="text-xs text-slate-500">Total Jobs</div>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-green-50">
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <div className="text-xl font-bold text-green-600">{stats.assigned}</div>
                <div className="text-xs text-slate-500">Assigned</div>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${stats.unassigned > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                <AlertTriangle className={`w-4 h-4 ${stats.unassigned > 0 ? 'text-red-600' : 'text-green-600'}`} />
              </div>
              <div>
                <div className={`text-xl font-bold ${stats.unassigned > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {stats.unassigned}
                </div>
                <div className="text-xs text-slate-500">Unassigned</div>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-yellow-50">
                <CircleDot className="w-4 h-4 text-yellow-600" />
              </div>
              <div>
                <div className="text-xl font-bold text-yellow-600">{stats.inProgress}</div>
                <div className="text-xs text-slate-500">In Progress</div>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-green-50">
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <div className="text-xl font-bold text-green-600">{stats.completed}</div>
                <div className="text-xs text-slate-500">Completed</div>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${stats.emergencies > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
                <Zap className={`w-4 h-4 ${stats.emergencies > 0 ? 'text-red-600' : 'text-slate-400'}`} />
              </div>
              <div>
                <div className={`text-xl font-bold ${stats.emergencies > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                  {stats.emergencies}
                </div>
                <div className="text-xs text-slate-500">Emergencies</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Date Navigation */}
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

        {/* Unassigned Jobs Alert */}
        {unassignedJobs.length > 0 && (
          <Card className="p-4 bg-amber-50 border-amber-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-medium text-amber-900 mb-2">
                  {unassignedJobs.length} Unassigned Job{unassignedJobs.length > 1 ? 's' : ''}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {unassignedJobs.map(job => (
                    <DispatchJobCard key={job.id} job={job} />
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Technician Lanes */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-900">
              Technician Schedule ({technicians.length} active)
            </h2>
          </div>

          {technicians.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {technicians.map(tech => (
                <TechnicianLane
                  key={tech.id}
                  technician={tech}
                  jobs={jobs.filter(j => j.assigned_technician_id === tech.id)}
                />
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No technicians set up</h3>
              <p className="text-slate-500 mb-4">
                Add team members to start dispatching jobs
              </p>
              <Link
                href="/team"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
              >
                <User className="w-4 h-4" />
                Go to Team Management
              </Link>
            </Card>
          )}
        </div>

        {/* All Jobs for the Day */}
        {jobs.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              All Jobs ({jobs.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {jobs.map(job => (
                <DispatchJobCard key={job.id} job={job} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
