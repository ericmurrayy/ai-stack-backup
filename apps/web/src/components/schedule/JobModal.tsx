// Murray's FSM - Job Modal Component
// ====================================
// Create and edit jobs from the schedule

'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { X, Calendar, User, Phone, MapPin, Wrench, AlertCircle, Save, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

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

interface JobModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  job: Job | null;
  initialDate: Date | null;
}

const SERVICE_CATEGORIES = [
  { value: 'repair', label: 'Repair' },
  { value: 'installation', label: 'Installation' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'emergency', label: 'Emergency Service' },
  { value: 'other', label: 'Other' },
];

const URGENCY_LEVELS = [
  { value: 'low', label: 'Low', color: 'bg-slate-100 text-slate-700' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700' },
  { value: 'emergency', label: 'Emergency', color: 'bg-red-100 text-red-700' },
];

const STATUS_OPTIONS = [
  { value: 'new', label: 'New', color: 'bg-purple-100 text-purple-700' },
  { value: 'scheduled', label: 'Scheduled', color: 'bg-blue-100 text-blue-700' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-700' },
  { value: 'canceled', label: 'Canceled', color: 'bg-slate-100 text-slate-700' },
];

export function JobModal({ open, onClose, onSaved, job, initialDate }: JobModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: '',
    phone_number: '',
    address: '',
    city: '',
    service_category: 'repair',
    issue_description: '',
    urgency: 'medium',
    status: 'scheduled',
    scheduled_at: '',
  });

  const isEditing = !!job;

  useEffect(() => {
    if (job) {
      setFormData({
        customer_name: job.customer_name || '',
        phone_number: job.phone_number || '',
        address: job.address || '',
        city: job.city || '',
        service_category: job.service_category || 'repair',
        issue_description: job.issue_description || '',
        urgency: job.urgency || 'medium',
        status: job.status || 'scheduled',
        scheduled_at: job.scheduled_at ? format(new Date(job.scheduled_at), "yyyy-MM-dd'T'HH:mm") : '',
      });
    } else if (initialDate) {
      // Set default time to 9 AM on the selected date
      const dateWithTime = new Date(initialDate);
      dateWithTime.setHours(9, 0, 0, 0);
      setFormData({
        customer_name: '',
        phone_number: '',
        address: '',
        city: '',
        service_category: 'repair',
        issue_description: '',
        urgency: 'medium',
        status: 'scheduled',
        scheduled_at: format(dateWithTime, "yyyy-MM-dd'T'HH:mm"),
      });
    }
  }, [job, initialDate]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = isEditing ? `/api/jobs/${job.id}` : '/api/jobs';
      const method = isEditing ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          scheduled_at: formData.scheduled_at ? new Date(formData.scheduled_at).toISOString() : null,
        }),
      });

      if (res.ok) {
        onSaved();
      } else {
        const error = await res.json();
        alert(error.message || 'Failed to save job');
      }
    } catch (error) {
      console.error('Error saving job:', error);
      alert('Failed to save job');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {isEditing ? `Edit Job #${job.job_number}` : 'New Job'}
            </h2>
            <p className="text-sm text-slate-500">
              {isEditing ? 'Update job details' : 'Schedule a new job'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Customer Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <User className="w-4 h-4" /> Customer Information
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Customer Name *
                </label>
                <Input
                  value={formData.customer_name}
                  onChange={(e) => handleChange('customer_name', e.target.value)}
                  placeholder="John Smith"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Phone Number *
                </label>
                <Input
                  value={formData.phone_number}
                  onChange={(e) => handleChange('phone_number', e.target.value)}
                  placeholder="(555) 123-4567"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Address
                </label>
                <Input
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="123 Main St"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  City
                </label>
                <Input
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  placeholder="Chelmsford"
                />
              </div>
            </div>
          </div>

          {/* Job Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Wrench className="w-4 h-4" /> Job Details
            </h3>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Service Type
              </label>
              <select
                value={formData.service_category}
                onChange={(e) => handleChange('service_category', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {SERVICE_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Issue Description
              </label>
              <textarea
                value={formData.issue_description}
                onChange={(e) => handleChange('issue_description', e.target.value)}
                placeholder="Describe the issue or service needed..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Schedule */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Schedule
            </h3>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Scheduled Date & Time
              </label>
              <Input
                type="datetime-local"
                value={formData.scheduled_at}
                onChange={(e) => handleChange('scheduled_at', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Urgency
                </label>
                <div className="flex flex-wrap gap-2">
                  {URGENCY_LEVELS.map((level) => (
                    <button
                      key={level.value}
                      type="button"
                      onClick={() => handleChange('urgency', level.value)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                        formData.urgency === level.value
                          ? level.color + ' ring-2 ring-offset-2 ring-blue-500'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      )}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>

              {isEditing && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Status
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((status) => (
                      <button
                        key={status.value}
                        type="button"
                        onClick={() => handleChange('status', status.value)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                          formData.status === status.value
                            ? status.color + ' ring-2 ring-offset-2 ring-blue-500'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        )}
                      >
                        {status.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            <Save className="w-4 h-4" />
            {loading ? 'Saving...' : isEditing ? 'Update Job' : 'Create Job'}
          </Button>
        </div>
      </div>
    </div>
  );
}
