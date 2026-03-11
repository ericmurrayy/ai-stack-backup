'use client';

import { useMemo } from 'react';
import {
  useDispatchRealtime,
  type DispatchJob,
  type DispatchTechnician,
} from '@/hooks/useDispatchRealtime';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  MapPin,
  Clock,
  User,
  Phone,
  AlertTriangle,
  Zap,
  Users,
  Briefcase,
  CheckCircle,
  CircleDot,
} from 'lucide-react';
import Link from 'next/link';

// ---------- Config (mirrors page.tsx) ----------

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

// ---------- Time Helper ----------

function formatTimeShort(dateStr: string): string {
  const d = new Date(dateStr);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

// ---------- Job Card (Client) ----------

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
      <div
        className={`bg-white rounded-xl shadow-sm border border-slate-200 p-3 hover:shadow-md transition-all cursor-pointer group border-l-4 ${
          job.urgency === 'emergency'
            ? 'border-l-red-600'
            : job.urgency === 'high'
              ? 'border-l-orange-500'
              : 'border-l-blue-500'
        }`}
      >
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
                <span className="text-slate-300">&#183;</span>
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

// ---------- Technician Lane (Client) ----------

function TechnicianLane({
  technician,
  jobs,
}: {
  technician: DispatchTechnician;
  jobs: DispatchJob[];
}) {
  const jobCount = jobs.length;
  const inProgress = jobs.filter((j) => j.status === 'in_progress').length;
  const completed = jobs.filter((j) => j.status === 'completed').length;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      {/* Technician Header */}
      <div className="px-3 py-2.5 border-b border-slate-100 flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
          style={{ backgroundColor: technician.color }}
        >
          {technician.name
            .split(' ')
            .map((n) => n[0])
            .join('')}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900 truncate">{technician.name}</div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>
              {jobCount} job{jobCount !== 1 ? 's' : ''}
            </span>
            {inProgress > 0 && (
              <span className="text-yellow-600 font-medium">{inProgress} active</span>
            )}
            {completed > 0 && <span className="text-green-600">{completed} done</span>}
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
          jobs.map((job) => <DispatchJobCard key={job.id} job={job} compact />)
        ) : (
          <div className="flex items-center justify-center h-[100px] text-sm text-slate-400">
            No jobs assigned
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Live Indicator ----------

function LiveIndicator({ isConnected }: { isConnected: boolean }) {
  return (
    <div className="flex items-center gap-1.5" title={isConnected ? 'Live updates active' : 'Connecting...'}>
      <span
        className={`relative flex h-2 w-2 ${isConnected ? '' : 'opacity-50'}`}
      >
        {isConnected && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            isConnected ? 'bg-green-500' : 'bg-slate-400'
          }`}
        />
      </span>
      <span className={`text-xs font-medium ${isConnected ? 'text-green-600' : 'text-slate-400'}`}>
        {isConnected ? 'Live' : 'Connecting'}
      </span>
    </div>
  );
}

// ---------- Main Realtime Component ----------

interface DispatchRealtimeProps {
  initialJobs: DispatchJob[];
  initialTechnicians: DispatchTechnician[];
  targetDate: string;
}

export function DispatchRealtime({
  initialJobs,
  initialTechnicians,
  targetDate,
}: DispatchRealtimeProps) {
  const { jobs, technicians, isConnected } = useDispatchRealtime({
    initialJobs,
    initialTechnicians,
    targetDate,
  });

  // Derived data
  const unassignedJobs = useMemo(() => jobs.filter((j) => !j.assigned_technician_id), [jobs]);

  const stats = useMemo(
    () => ({
      totalJobs: jobs.length,
      assigned: jobs.filter((j) => j.assigned_technician_id).length,
      unassigned: jobs.filter((j) => !j.assigned_technician_id).length,
      inProgress: jobs.filter((j) => j.status === 'in_progress').length,
      completed: jobs.filter((j) => j.status === 'completed').length,
      emergencies: jobs.filter((j) => j.urgency === 'emergency').length,
    }),
    [jobs],
  );

  return (
    <div className="space-y-6">
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
              <AlertTriangle
                className={`w-4 h-4 ${stats.unassigned > 0 ? 'text-red-600' : 'text-green-600'}`}
              />
            </div>
            <div>
              <div
                className={`text-xl font-bold ${stats.unassigned > 0 ? 'text-red-600' : 'text-green-600'}`}
              >
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
              <Zap
                className={`w-4 h-4 ${stats.emergencies > 0 ? 'text-red-600' : 'text-slate-400'}`}
              />
            </div>
            <div>
              <div
                className={`text-xl font-bold ${stats.emergencies > 0 ? 'text-red-600' : 'text-slate-400'}`}
              >
                {stats.emergencies}
              </div>
              <div className="text-xs text-slate-500">Emergencies</div>
            </div>
          </div>
        </Card>
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
                {unassignedJobs.map((job) => (
                  <DispatchJobCard key={job.id} job={job} />
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Technician Lanes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-900">
              Technician Schedule ({technicians.length} active)
            </h2>
          </div>
          <LiveIndicator isConnected={isConnected} />
        </div>

        {technicians.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {technicians.map((tech) => (
              <TechnicianLane
                key={tech.id}
                technician={tech}
                jobs={jobs.filter((j) => j.assigned_technician_id === tech.id)}
              />
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No technicians set up</h3>
            <p className="text-slate-500 mb-4">Add team members to start dispatching jobs</p>
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
          <h2 className="text-lg font-semibold text-slate-900 mb-4">All Jobs ({jobs.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.map((job) => (
              <DispatchJobCard key={job.id} job={job} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
