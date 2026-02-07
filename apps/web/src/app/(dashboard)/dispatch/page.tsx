'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  MapPin,
  Clock,
  User,
  Phone,
  Navigation,
  CheckCircle,
  AlertTriangle,
  Truck,
  ArrowRight,
  Zap,
  RefreshCw,
  Calendar,
  Filter,
} from 'lucide-react';

interface Job {
  id: string;
  job_number: string;
  customer_name: string;
  phone_number?: string;
  address: string;
  city?: string;
  service_category: string;
  status: string;
  urgency: string;
  scheduled_at?: string;
  assigned_technician_id?: string;
  assigned_technician_name?: string;
  estimated_duration?: number;
}

interface Technician {
  id: string;
  full_name: string;
  color: string;
  status: 'available' | 'busy' | 'offline' | 'on_break';
  current_job_id?: string;
  current_job_address?: string;
  location?: { lat: number; lng: number };
  jobs_today: number;
  next_available?: string;
}

const statusConfig = {
  available: { label: 'Available', color: 'success', bgColor: 'bg-green-100' },
  busy: { label: 'Busy', color: 'warning', bgColor: 'bg-yellow-100' },
  offline: { label: 'Offline', color: 'default', bgColor: 'bg-slate-100' },
  on_break: { label: 'On Break', color: 'info', bgColor: 'bg-blue-100' },
} as const;

const urgencyColors = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  emergency: 'bg-red-100 text-red-600',
};

export default function DispatchPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedJob, setDraggedJob] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unassigned' | 'scheduled'>('all');

  const fetchData = useCallback(async () => {
    try {
      const [jobsRes, techRes] = await Promise.all([
        fetch('/api/jobs?status=pending,scheduled,in_progress&limit=50'),
        fetch('/api/team'),
      ]);

      if (jobsRes.ok) {
        const data = await jobsRes.json();
        setJobs(data.jobs || []);
      } else {
        // Demo data
        setJobs([
          {
            id: '1',
            job_number: 'J-001',
            customer_name: 'John Smith',
            phone_number: '+15551234567',
            address: '123 Main St',
            city: 'Austin',
            service_category: 'hvac_repair',
            status: 'scheduled',
            urgency: 'high',
            scheduled_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            assigned_technician_id: '1',
            assigned_technician_name: 'Mike Johnson',
          },
          {
            id: '2',
            job_number: 'J-002',
            customer_name: 'Sarah Connor',
            address: '456 Oak Ave',
            city: 'Austin',
            service_category: 'plumbing',
            status: 'pending',
            urgency: 'medium',
          },
          {
            id: '3',
            job_number: 'J-003',
            customer_name: 'Bob Wilson',
            phone_number: '+15559876543',
            address: '789 Pine Rd',
            city: 'Round Rock',
            service_category: 'electrical',
            status: 'in_progress',
            urgency: 'emergency',
            assigned_technician_id: '2',
            assigned_technician_name: 'Sarah Williams',
          },
        ]);
      }

      if (techRes.ok) {
        const data = await techRes.json();
        // Map team members to technician format
        const techs = (data.members || []).map((m: any) => ({
          id: m.id,
          full_name: m.full_name,
          color: m.color || '#3b82f6',
          status: m.is_active ? 'available' : 'offline',
          jobs_today: 0,
        }));
        setTechnicians(techs.length > 0 ? techs : [
          { id: '1', full_name: 'Mike Johnson', color: '#3b82f6', status: 'busy', current_job_address: '123 Main St', jobs_today: 3 },
          { id: '2', full_name: 'Sarah Williams', color: '#22c55e', status: 'busy', current_job_address: '789 Pine Rd', jobs_today: 2 },
          { id: '3', full_name: 'Tom Davis', color: '#f59e0b', status: 'available', jobs_today: 1 },
        ]);
      }
    } catch (error) {
      console.error('Failed to fetch dispatch data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  async function assignJob(jobId: string, technicianId: string) {
    try {
      await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_technician_id: technicianId }),
      });
      fetchData();
    } catch (error) {
      console.error('Failed to assign job:', error);
    }
  }

  function handleDragStart(jobId: string) {
    setDraggedJob(jobId);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(technicianId: string) {
    if (draggedJob) {
      assignJob(draggedJob, technicianId);
      setDraggedJob(null);
    }
  }

  const unassignedJobs = jobs.filter(j => !j.assigned_technician_id);
  const filteredJobs = filter === 'unassigned'
    ? unassignedJobs
    : filter === 'scheduled'
    ? jobs.filter(j => j.assigned_technician_id)
    : jobs;

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div>
        <Header title="Dispatch Board" />
        <div className="p-6">
          <div className="grid grid-cols-4 gap-4 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="h-96 bg-gray-200">
                <div />
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Dispatch Board" />

      <div className="p-6 space-y-6">
        {/* Status Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Card className="px-4 py-2 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium">Live Updates</span>
            </Card>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">
                {unassignedJobs.length} unassigned
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-sm text-slate-500">
                {technicians.filter(t => t.status === 'available').length} techs available
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="all">All Jobs</option>
              <option value="unassigned">Unassigned Only</option>
              <option value="scheduled">Assigned Only</option>
            </select>
            <button
              onClick={fetchData}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Job Queue */}
          <div className="lg:col-span-1">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                Job Queue
                <Badge>{filteredJobs.length}</Badge>
              </h2>
              <p className="text-sm text-slate-500">Drag to assign to technician</p>
            </div>

            <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto">
              {filteredJobs.map((job) => (
                <div
                  key={job.id}
                  draggable
                  onDragStart={() => handleDragStart(job.id)}
                  className="cursor-move"
                >
                <Card
                  className={`p-4 hover:shadow-md transition-shadow ${
                    draggedJob === job.id ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">#{job.job_number}</span>
                        <Badge className={urgencyColors[job.urgency as keyof typeof urgencyColors] || urgencyColors.medium}>
                          {job.urgency}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600">{job.customer_name}</p>
                    </div>
                    {job.scheduled_at && (
                      <span className="text-xs text-slate-500">
                        {formatTime(job.scheduled_at)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 space-y-1">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {job.address}, {job.city}
                    </div>
                    <div className="flex items-center gap-1">
                      <Truck className="w-3 h-3" />
                      {job.service_category.replace(/_/g, ' ')}
                    </div>
                  </div>
                  {job.assigned_technician_name && (
                    <div className="mt-2 pt-2 border-t flex items-center gap-2 text-xs">
                      <User className="w-3 h-3 text-blue-500" />
                      <span className="text-blue-600">{job.assigned_technician_name}</span>
                    </div>
                  )}
                </Card>
                </div>
              ))}

              {filteredJobs.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <Calendar className="w-8 h-8 mx-auto mb-2" />
                  <p>No jobs in queue</p>
                </div>
              )}
            </div>
          </div>

          {/* Technician Columns */}
          <div className="lg:col-span-3">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Technicians</h2>
              <p className="text-sm text-slate-500">Drop jobs to assign</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {technicians.map((tech) => {
                const techJobs = jobs.filter(j => j.assigned_technician_id === tech.id);
                const techStatus = statusConfig[tech.status];

                return (
                  <div
                    key={tech.id}
                    className={`rounded-lg border-2 transition-all ${
                      draggedJob ? 'border-dashed border-blue-400 bg-blue-50/50' : 'border-transparent'
                    }`}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(tech.id)}
                  >
                    <Card className="p-4 h-full">
                      {/* Tech Header */}
                      <div className="flex items-center gap-3 mb-4">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: tech.color }}
                        >
                          {tech.full_name.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900">{tech.full_name}</h3>
                          <div className="flex items-center gap-2">
                            <Badge variant={techStatus.color as any}>
                              {techStatus.label}
                            </Badge>
                            <span className="text-xs text-slate-500">
                              {techJobs.length} job{techJobs.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Current Location */}
                      {tech.current_job_address && (
                        <div className="mb-3 p-2 bg-blue-50 rounded-lg text-xs">
                          <div className="flex items-center gap-1 text-blue-600">
                            <Navigation className="w-3 h-3" />
                            <span>Currently at: {tech.current_job_address}</span>
                          </div>
                        </div>
                      )}

                      {/* Assigned Jobs */}
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {techJobs.map((job) => (
                          <div
                            key={job.id}
                            className="p-2 bg-slate-50 rounded-lg text-sm"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">#{job.job_number}</span>
                              <Badge className={`text-xs ${urgencyColors[job.urgency as keyof typeof urgencyColors] || ''}`}>
                                {job.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">{job.customer_name}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                              <MapPin className="w-3 h-3" />
                              {job.address}
                            </div>
                            {job.scheduled_at && (
                              <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                                <Clock className="w-3 h-3" />
                                {formatTime(job.scheduled_at)}
                              </div>
                            )}
                          </div>
                        ))}

                        {techJobs.length === 0 && (
                          <div className="text-center py-6 text-slate-400 text-sm">
                            {draggedJob ? (
                              <>
                                <ArrowRight className="w-6 h-6 mx-auto mb-1" />
                                Drop here to assign
                              </>
                            ) : (
                              'No jobs assigned'
                            )}
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="font-semibold text-slate-900">Quick Actions</h3>
              <button className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Auto-Assign All
              </button>
              <button className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">
                Optimize Routes
              </button>
            </div>
            <div className="text-sm text-slate-500">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
