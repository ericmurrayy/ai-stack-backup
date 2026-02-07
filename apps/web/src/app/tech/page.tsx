'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  MapPin,
  Phone,
  Clock,
  CheckCircle,
  Play,
  Navigation,
  User,
  Calendar,
  DollarSign,
  MessageSquare,
  ChevronRight,
  RefreshCw,
  Camera,
  FileText,
  AlertCircle
} from 'lucide-react';

interface TechJob {
  id: string;
  title: string;
  customer_name: string;
  customer_phone?: string;
  address: string;
  scheduled_time?: string;
  status: string;
  quoted_amount?: number;
  notes?: string;
  priority?: 'normal' | 'urgent' | 'emergency';
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const priorityColors: Record<string, string> = {
  normal: 'bg-gray-100 text-gray-600',
  urgent: 'bg-orange-100 text-orange-700',
  emergency: 'bg-red-100 text-red-700',
};

export default function TechnicianMobilePage() {
  const [jobs, setJobs] = useState<TechJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<TechJob | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    fetchTodaysJobs();
  }, []);

  const fetchTodaysJobs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/tech/jobs');
      const data = await response.json();
      setJobs(data.jobs || []);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
      // Mock data for demo
      setJobs([
        {
          id: '1',
          title: 'AC Repair',
          customer_name: 'John Smith',
          customer_phone: '(555) 123-4567',
          address: '123 Main St, Austin, TX 78701',
          scheduled_time: '9:00 AM',
          status: 'scheduled',
          quoted_amount: 450,
          notes: 'AC not cooling. Unit is about 10 years old.',
          priority: 'urgent',
        },
        {
          id: '2',
          title: 'Furnace Tune-Up',
          customer_name: 'Sarah Johnson',
          customer_phone: '(555) 234-5678',
          address: '456 Oak Ave, Austin, TX 78702',
          scheduled_time: '11:00 AM',
          status: 'scheduled',
          quoted_amount: 129,
          notes: 'Annual maintenance check.',
          priority: 'normal',
        },
        {
          id: '3',
          title: 'Water Heater Repair',
          customer_name: 'Mike Davis',
          customer_phone: '(555) 345-6789',
          address: '789 Elm Blvd, Austin, TX 78703',
          scheduled_time: '2:00 PM',
          status: 'scheduled',
          quoted_amount: 250,
          notes: 'No hot water. Pilot light may be out.',
          priority: 'normal',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const updateJobStatus = async (jobId: string, newStatus: string) => {
    setUpdatingStatus(true);
    try {
      await fetch('/api/tech/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, status: newStatus }),
      });

      // Update local state
      setJobs(jobs.map(j =>
        j.id === jobId ? { ...j, status: newStatus } : j
      ));

      if (selectedJob?.id === jobId) {
        setSelectedJob({ ...selectedJob, status: newStatus });
      }
    } catch (error) {
      console.error('Failed to update job:', error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const openNavigation = (address: string) => {
    const encodedAddress = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`, '_blank');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Job Detail View
  if (selectedJob) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 sticky top-0 z-10">
          <button
            onClick={() => setSelectedJob(null)}
            className="text-sm mb-2 opacity-90 hover:opacity-100"
          >
            ← Back to Jobs
          </button>
          <h1 className="text-xl font-bold">{selectedJob.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={statusColors[selectedJob.status]}>
              {selectedJob.status.replace('_', ' ')}
            </Badge>
            {selectedJob.priority && selectedJob.priority !== 'normal' && (
              <Badge className={priorityColors[selectedJob.priority]}>
                {selectedJob.priority}
              </Badge>
            )}
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Customer Info */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <div className="font-semibold text-lg">{selectedJob.customer_name}</div>
                  {selectedJob.customer_phone && (
                    <a
                      href={`tel:${selectedJob.customer_phone}`}
                      className="text-blue-600 flex items-center gap-1"
                    >
                      <Phone className="h-4 w-4" />
                      {selectedJob.customer_phone}
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <div className="font-medium">Address</div>
                    <div className="text-gray-600">{selectedJob.address}</div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openNavigation(selectedJob.address)}
                >
                  <Navigation className="h-4 w-4 mr-1" />
                  Navigate
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Time & Value */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Clock className="h-6 w-6 mx-auto text-gray-400 mb-2" />
                <div className="font-semibold">{selectedJob.scheduled_time || 'Flexible'}</div>
                <div className="text-sm text-gray-500">Scheduled Time</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <DollarSign className="h-6 w-6 mx-auto text-green-500 mb-2" />
                <div className="font-semibold">
                  {selectedJob.quoted_amount ? formatCurrency(selectedJob.quoted_amount) : 'TBD'}
                </div>
                <div className="text-sm text-gray-500">Quoted Amount</div>
              </CardContent>
            </Card>
          </div>

          {/* Notes */}
          {selectedJob.notes && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Job Notes</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-gray-700">{selectedJob.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="space-y-3 pt-4">
            {selectedJob.status === 'scheduled' && (
              <Button
                className="w-full h-14 text-lg bg-green-600 hover:bg-green-700"
                onClick={() => updateJobStatus(selectedJob.id, 'in_progress')}
                disabled={updatingStatus}
              >
                <Play className="h-5 w-5 mr-2" />
                Start Job
              </Button>
            )}

            {selectedJob.status === 'in_progress' && (
              <>
                <Button
                  className="w-full h-14 text-lg"
                  onClick={() => updateJobStatus(selectedJob.id, 'completed')}
                  disabled={updatingStatus}
                >
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Complete Job
                </Button>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" className="h-12">
                    <Camera className="h-5 w-5 mr-2" />
                    Add Photo
                  </Button>
                  <Button variant="outline" className="h-12">
                    <FileText className="h-5 w-5 mr-2" />
                    Add Note
                  </Button>
                </div>
              </>
            )}

            {selectedJob.status === 'completed' && (
              <div className="p-4 bg-green-50 rounded-lg text-center">
                <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" />
                <div className="font-semibold text-green-700">Job Completed!</div>
                <p className="text-sm text-green-600 mt-1">
                  Invoice and review request will be sent automatically
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <a
                href={`tel:${selectedJob.customer_phone}`}
                className="h-10 px-4 py-2 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Phone className="h-4 w-4 mr-2" />
                Call
              </a>
              <a
                href={`sms:${selectedJob.customer_phone}`}
                className="h-10 px-4 py-2 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Text
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Job List View
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 sticky top-0 z-10">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">Today&apos;s Jobs</h1>
            <p className="text-blue-100 text-sm">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-blue-700"
            onClick={fetchTodaysJobs}
          >
            <RefreshCw className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {jobs.filter(j => j.status === 'scheduled').length}
          </div>
          <div className="text-xs text-gray-500">Scheduled</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-yellow-600">
            {jobs.filter(j => j.status === 'in_progress').length}
          </div>
          <div className="text-xs text-gray-500">In Progress</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-green-600">
            {jobs.filter(j => j.status === 'completed').length}
          </div>
          <div className="text-xs text-gray-500">Completed</div>
        </Card>
      </div>

      {/* Job List */}
      <div className="p-4 space-y-3">
        {jobs.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <h3 className="font-semibold text-gray-600">No jobs scheduled</h3>
            <p className="text-gray-400 text-sm">Pull to refresh for updates</p>
          </div>
        ) : (
          jobs.map((job) => (
            <div
              key={job.id}
              onClick={() => setSelectedJob(job)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setSelectedJob(job)}
            >
              <Card
                className={`cursor-pointer hover:shadow-md transition-shadow ${
                  job.priority === 'emergency' ? 'border-l-4 border-red-500' :
                  job.priority === 'urgent' ? 'border-l-4 border-orange-500' : ''
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={statusColors[job.status]} >
                          {job.status.replace('_', ' ')}
                        </Badge>
                        {job.priority && job.priority !== 'normal' && (
                          <Badge className={priorityColors[job.priority]} >
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {job.priority}
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-900">{job.title}</h3>
                      <p className="text-gray-600 text-sm">{job.customer_name}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {job.scheduled_time || 'Flexible'}
                        </span>
                        {job.quoted_amount && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            {formatCurrency(job.quoted_amount)}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                </CardContent>
              </Card>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
