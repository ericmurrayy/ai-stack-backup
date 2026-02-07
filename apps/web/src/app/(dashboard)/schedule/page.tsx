// Murray's FSM - Schedule Page
// ==============================
// Main calendar view for scheduling jobs

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { ScheduleCalendar } from '@/components/schedule/ScheduleCalendar';
import { JobModal } from '@/components/schedule/JobModal';
import { Button } from '@/components/ui/Button';
import { Plus, RefreshCw } from 'lucide-react';

export interface Job {
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

export default function SchedulePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/jobs');
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedJob(null);
    setModalOpen(true);
  };

  const handleJobClick = (job: Job) => {
    setSelectedJob(job);
    setSelectedDate(null);
    setModalOpen(true);
  };

  const handleNewJob = () => {
    setSelectedJob(null);
    setSelectedDate(new Date());
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedJob(null);
    setSelectedDate(null);
  };

  const handleJobSaved = () => {
    handleModalClose();
    fetchJobs();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Schedule" />

      <div className="p-6">
        {/* Actions Bar */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Job Calendar</h2>
            <p className="text-sm text-slate-500">Click a date to schedule, click a job to view details</p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={fetchJobs}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={handleNewJob}>
              <Plus className="w-4 h-4" />
              New Job
            </Button>
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <ScheduleCalendar
            jobs={jobs}
            onDateClick={handleDateClick}
            onJobClick={handleJobClick}
            loading={loading}
          />
        </div>
      </div>

      {/* Job Modal */}
      <JobModal
        open={modalOpen}
        onClose={handleModalClose}
        onSaved={handleJobSaved}
        job={selectedJob}
        initialDate={selectedDate}
      />
    </div>
  );
}
