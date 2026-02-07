'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Plus,
  Phone,
  Calendar,
  ArrowRight,
  MoreVertical,
  User,
  MapPin,
  Clock,
  X,
  ArrowLeft,
} from 'lucide-react';
import { formatPhone, formatRelativeTime } from '@/lib/utils';

interface JobCard {
  id: string;
  job_number: number;
  customer_name: string | null;
  phone_number: string;
  city: string | null;
  service_category: string;
  urgency: string;
  issue_description: string | null;
  scheduled_at: string | null;
  created_at: string;
}

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  bgColor: string;
  jobs: JobCard[];
  job_count: number;
}

// Status flow for moving jobs forward/backward
const statusFlow = ['new', 'contacted', 'scheduled', 'in_progress', 'completed'];

// New Job Button - links to job creation page
export function NewJobButton() {
  return (
    <Link
      href="/jobs/new"
      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
    >
      <Plus className="w-4 h-4" />
      New Job
    </Link>
  );
}

// Add Job Button for columns
export function AddJobButton() {
  return (
    <Link
      href="/jobs/new"
      className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-white rounded-lg transition-colors flex items-center justify-center gap-1"
    >
      <Plus className="w-4 h-4" />
      Add Job
    </Link>
  );
}

// Column header add button
export function ColumnAddButton() {
  return (
    <Link href="/jobs/new" className="p-1 hover:bg-white rounded transition-colors">
      <Plus className="w-4 h-4 text-slate-500" />
    </Link>
  );
}

// Filter button with dropdown
export function FilterButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState({
    urgency: '',
    service: '',
  });

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
      >
        Filter
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-200 z-20">
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Urgency
                </label>
                <select
                  value={filters.urgency}
                  onChange={(e) => setFilters({ ...filters, urgency: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">All</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Service Type
                </label>
                <select
                  value={filters.service}
                  onChange={(e) => setFilters({ ...filters, service: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">All</option>
                  <option value="repair">Repair</option>
                  <option value="spring_repair">Spring Repair</option>
                  <option value="opener_repair">Opener Repair</option>
                  <option value="installation">Installation</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setFilters({ urgency: '', service: '' });
                    setIsOpen(false);
                  }}
                  className="flex-1 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Clear
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex-1 px-3 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Interactive Job Card with actions
export function InteractiveJobCard({ job, currentStatus }: { job: JobCard; currentStatus: string }) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const urgencyColors: Record<string, string> = {
    low: 'text-gray-600 bg-gray-100',
    medium: 'text-blue-600 bg-blue-100',
    high: 'text-orange-600 bg-orange-100',
    emergency: 'text-red-600 bg-red-100',
  };

  const currentIndex = statusFlow.indexOf(currentStatus);
  const canMoveForward = currentIndex < statusFlow.length - 1;
  const canMoveBack = currentIndex > 0;

  const moveJob = async (direction: 'forward' | 'back') => {
    const newIndex = direction === 'forward' ? currentIndex + 1 : currentIndex - 1;
    if (newIndex < 0 || newIndex >= statusFlow.length) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusFlow[newIndex] }),
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to update job status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCall = () => {
    if (job.phone_number) {
      window.location.href = `tel:${job.phone_number}`;
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between mb-2">
        <Link href={`/jobs/${job.id}`} className="font-medium text-slate-900 text-sm hover:text-blue-600">
          Job #{job.job_number}
        </Link>
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-100 rounded"
          >
            <MoreVertical className="w-4 h-4 text-slate-400" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-slate-200 z-20 py-1">
                <Link
                  href={`/jobs/${job.id}`}
                  className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  View Details
                </Link>
                <Link
                  href={`/jobs/${job.id}?edit=true`}
                  className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Edit Job
                </Link>
                {canMoveBack && (
                  <button
                    onClick={() => moveJob('back')}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    Move Back
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {job.customer_name && (
        <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-2">
          <User className="w-3.5 h-3.5" />
          <span className="truncate">{job.customer_name}</span>
        </div>
      )}

      {job.phone_number && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
          <Phone className="w-3.5 h-3.5" />
          <span>{formatPhone(job.phone_number)}</span>
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs capitalize text-slate-700">
          {job.service_category?.replace(/_/g, ' ') || 'General'}
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${urgencyColors[job.urgency] || urgencyColors.medium}`}>
          {job.urgency}
        </span>
      </div>

      {job.issue_description && (
        <p className="text-xs text-slate-500 line-clamp-2 mb-2">
          {job.issue_description}
        </p>
      )}

      <div className="flex items-center gap-2 text-xs text-slate-500">
        {job.scheduled_at ? (
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>{formatRelativeTime(job.scheduled_at)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{formatRelativeTime(job.created_at)}</span>
          </div>
        )}
        {job.city && (
          <div className="flex items-center gap-1 ml-auto">
            <MapPin className="w-3 h-3" />
            <span>{job.city}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 mt-3 pt-2 border-t border-slate-100">
        <button
          onClick={handleCall}
          disabled={!job.phone_number}
          className="p-1.5 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"
          title="Call"
        >
          <Phone className="w-3.5 h-3.5 text-slate-500" />
        </button>
        <Link
          href={`/jobs/${job.id}?schedule=true`}
          className="p-1.5 hover:bg-slate-100 rounded transition-colors"
          title="Schedule"
        >
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
        </Link>
        {canMoveBack && (
          <button
            onClick={() => moveJob('back')}
            disabled={isUpdating}
            className="p-1.5 hover:bg-orange-50 rounded transition-colors text-orange-600 disabled:opacity-50"
            title="Move to previous stage"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        )}
        {canMoveForward && (
          <button
            onClick={() => moveJob('forward')}
            disabled={isUpdating}
            className="ml-auto p-1.5 hover:bg-blue-50 rounded transition-colors text-blue-600 disabled:opacity-50"
            title="Move to next stage"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// Interactive Pipeline Column
export function InteractivePipelineColumn({ stage }: { stage: PipelineStage }) {
  return (
    <div className="flex-shrink-0 w-72">
      <div
        className={`rounded-t-lg px-3 py-2 flex items-center justify-between ${stage.bgColor}`}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="font-semibold text-slate-900 text-sm">{stage.name}</h3>
          <span className="text-xs bg-white text-slate-600 px-2 py-0.5 rounded-full font-medium">
            {stage.job_count}
          </span>
        </div>
        <ColumnAddButton />
      </div>

      <div className="bg-slate-100 rounded-b-lg p-2 min-h-[500px] space-y-2">
        {stage.jobs.map((job) => (
          <InteractiveJobCard key={job.id} job={job} currentStatus={stage.id} />
        ))}

        {stage.jobs.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-sm">
            No jobs in this stage
          </div>
        )}

        <AddJobButton />
      </div>
    </div>
  );
}
