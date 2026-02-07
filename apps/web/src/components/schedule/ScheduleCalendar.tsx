// Murray's FSM - Schedule Calendar Component
// ===========================================
// Custom calendar view for job scheduling

'use client';

import { useState, useMemo } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  addDays, 
  addMonths, 
  subMonths, 
  isSameMonth, 
  isSameDay, 
  isToday,
  parseISO
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Job {
  id: string;
  job_number: number;
  customer_name: string | null;
  phone_number: string | null;
  address: string | null;
  city: string | null;
  service_category: string;
  issue_description: string | null;
  status: string;
  urgency: string;
  scheduled_at: string | null;
  created_at: string;
}

interface ScheduleCalendarProps {
  jobs: Job[];
  onDateClick: (date: Date) => void;
  onJobClick: (job: Job) => void;
  loading?: boolean;
}

const statusColors: Record<string, string> = {
  new: 'bg-purple-500',
  scheduled: 'bg-blue-500',
  in_progress: 'bg-yellow-500',
  completed: 'bg-green-500',
  canceled: 'bg-slate-400',
};

const urgencyBorders: Record<string, string> = {
  low: 'border-l-slate-400',
  medium: 'border-l-blue-500',
  high: 'border-l-orange-500',
  emergency: 'border-l-red-500',
};

export function ScheduleCalendar({ jobs, onDateClick, onJobClick, loading }: ScheduleCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week'>('month');

  const jobsByDate = useMemo(() => {
    const map = new Map<string, Job[]>();
    jobs.forEach((job) => {
      if (job.scheduled_at) {
        const dateKey = format(parseISO(job.scheduled_at), 'yyyy-MM-dd');
        const existing = map.get(dateKey) || [];
        map.set(dateKey, [...existing, job]);
      }
    });
    return map;
  }, [jobs]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const renderJobCard = (job: Job) => (
    <button
      key={job.id}
      onClick={(e) => {
        e.stopPropagation();
        onJobClick(job);
      }}
      className={cn(
        'w-full text-left px-2 py-1 rounded text-xs truncate border-l-2 transition-colors',
        'bg-white hover:bg-slate-50 shadow-sm',
        urgencyBorders[job.urgency] || urgencyBorders.medium
      )}
    >
      <div className="flex items-center gap-1">
        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', statusColors[job.status] || statusColors.new)} />
        <span className="font-medium truncate">
          #{job.job_number} {job.customer_name || 'Unknown'}
        </span>
      </div>
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-slate-900">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setView('month')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              view === 'month' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'
            )}
          >
            Month
          </button>
          <button
            onClick={() => setView('week')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              view === 'week' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'
            )}
          >
            Week
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-purple-500" /> New
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500" /> Scheduled
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-500" /> In Progress
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" /> Completed
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-4 text-slate-500">
          <Calendar className="w-6 h-6 mx-auto animate-pulse mb-2" />
          Loading jobs...
        </div>
      )}

      {/* Calendar Grid */}
      {!loading && (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="px-2 py-3 text-center text-xs font-semibold text-slate-600">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Body */}
          <div className="bg-white">
            {weeks.map((week, weekIdx) => (
              <div key={weekIdx} className="grid grid-cols-7 border-b border-slate-100 last:border-b-0">
                {week.map((dayDate) => {
                  const dateKey = format(dayDate, 'yyyy-MM-dd');
                  const dayJobs = jobsByDate.get(dateKey) || [];
                  const isCurrentMonth = isSameMonth(dayDate, currentDate);
                  const isCurrentDay = isToday(dayDate);

                  return (
                    <div
                      key={dateKey}
                      onClick={() => onDateClick(dayDate)}
                      className={cn(
                        'min-h-[120px] p-2 border-r border-slate-100 last:border-r-0 text-left transition-colors hover:bg-blue-50 cursor-pointer',
                        !isCurrentMonth && 'bg-slate-50'
                      )}
                    >
                      {/* Date Number */}
                      <div className={cn(
                        'w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mb-1',
                        isCurrentDay && 'bg-blue-600 text-white',
                        !isCurrentDay && isCurrentMonth && 'text-slate-900',
                        !isCurrentDay && !isCurrentMonth && 'text-slate-400'
                      )}>
                        {format(dayDate, 'd')}
                      </div>

                      {/* Jobs */}
                      <div className="space-y-1">
                        {dayJobs.slice(0, 3).map(renderJobCard)}
                        {dayJobs.length > 3 && (
                          <div className="text-xs text-slate-500 pl-2">
                            +{dayJobs.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
