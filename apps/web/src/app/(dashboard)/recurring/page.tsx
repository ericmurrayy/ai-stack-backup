'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/textarea';
import {
  RefreshCw,
  Plus,
  Calendar,
  Clock,
  MapPin,
  User,
  Wrench,
  Pause,
  Play,
  Trash2,
  Edit,
  X,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface RecurringTemplate {
  id: string;
  customer_id: string;
  customer_name?: string;
  service_category: string;
  description: string;
  address?: string;
  city?: string;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'semiannual' | 'annual';
  day_of_week?: number;
  day_of_month?: number;
  preferred_time?: string;
  quoted_amount?: number;
  is_active: boolean;
  next_scheduled_date: string;
  last_generated_date?: string;
}

interface Stats {
  totalActive: number;
  dueThisWeek: number;
  dueThisMonth: number;
  generatedThisMonth: number;
}

const frequencyLabels: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 Weeks',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semiannual: 'Every 6 Months',
  annual: 'Annually',
};

const dayOfWeekLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function RecurringJobsPage() {
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RecurringTemplate | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    customer_id: '',
    customer_name: '',
    service_category: 'maintenance',
    description: '',
    address: '',
    city: '',
    frequency: 'monthly' as 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'semiannual' | 'annual',
    day_of_week: undefined as number | undefined,
    day_of_month: 1,
    preferred_time: '09:00',
    quoted_amount: '',
    next_scheduled_date: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch('/api/recurring-jobs');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch recurring jobs:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    try {
      const url = '/api/recurring-jobs';
      const method = editingTemplate ? 'PATCH' : 'POST';
      const body = editingTemplate
        ? { templateId: editingTemplate.id, ...formData }
        : formData;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          quoted_amount: formData.quoted_amount ? parseFloat(formData.quoted_amount) : undefined,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        setEditingTemplate(null);
        resetForm();
        fetchData();
      }
    } catch (error) {
      console.error('Failed to save template:', error);
    }
  }

  async function toggleActive(template: RecurringTemplate) {
    try {
      await fetch('/api/recurring-jobs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: template.id,
          is_active: !template.is_active,
        }),
      });
      fetchData();
    } catch (error) {
      console.error('Failed to toggle template:', error);
    }
  }

  async function deleteTemplate(templateId: string) {
    if (!confirm('Are you sure you want to delete this recurring job?')) return;

    try {
      await fetch(`/api/recurring-jobs?templateId=${templateId}`, {
        method: 'DELETE',
      });
      fetchData();
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  }

  function resetForm() {
    setFormData({
      customer_id: '',
      customer_name: '',
      service_category: 'maintenance',
      description: '',
      address: '',
      city: '',
      frequency: 'monthly',
      day_of_week: undefined,
      day_of_month: 1,
      preferred_time: '09:00',
      quoted_amount: '',
      next_scheduled_date: '',
    });
  }

  function openEditModal(template: RecurringTemplate) {
    setEditingTemplate(template);
    setFormData({
      customer_id: template.customer_id,
      customer_name: template.customer_name || '',
      service_category: template.service_category,
      description: template.description,
      address: template.address || '',
      city: template.city || '',
      frequency: template.frequency,
      day_of_week: template.day_of_week,
      day_of_month: template.day_of_month || 1,
      preferred_time: template.preferred_time || '09:00',
      quoted_amount: template.quoted_amount?.toString() || '',
      next_scheduled_date: template.next_scheduled_date,
    });
    setShowModal(true);
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div>
        <Header title="Recurring Jobs" />
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="p-6 animate-pulse">
                <div className="h-16 bg-gray-200 rounded" />
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Recurring Jobs" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-blue-100">
                  <RefreshCw className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stats.totalActive}</p>
                  <p className="text-sm text-slate-500">Active Schedules</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-yellow-100">
                  <AlertCircle className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stats.dueThisWeek}</p>
                  <p className="text-sm text-slate-500">Due This Week</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-green-100">
                  <Calendar className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stats.dueThisMonth}</p>
                  <p className="text-sm text-slate-500">Due This Month</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-purple-100">
                  <CheckCircle className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stats.generatedThisMonth}</p>
                  <p className="text-sm text-slate-500">Generated This Month</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Recurring Schedules</h2>
            <p className="text-sm text-slate-500">Automatically generate jobs on a schedule</p>
          </div>
          <Button onClick={() => { resetForm(); setShowModal(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            New Recurring Job
          </Button>
        </div>

        {/* Templates List */}
        <div className="space-y-4">
          {templates.length === 0 ? (
            <Card className="p-12 text-center">
              <RefreshCw className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No Recurring Jobs</h3>
              <p className="text-slate-500 mb-4">
                Set up recurring maintenance schedules for your customers
              </p>
              <Button onClick={() => setShowModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create First Schedule
              </Button>
            </Card>
          ) : (
            templates.map((template) => (
              <Card key={template.id} className={`p-6 ${!template.is_active ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${template.is_active ? 'bg-blue-100' : 'bg-slate-100'}`}>
                      <RefreshCw className={`w-6 h-6 ${template.is_active ? 'text-blue-600' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-900">
                          {template.customer_name || 'Unknown Customer'}
                        </h3>
                        <Badge variant={template.is_active ? 'success' : 'default'}>
                          {template.is_active ? 'Active' : 'Paused'}
                        </Badge>
                        <Badge>{frequencyLabels[template.frequency]}</Badge>
                      </div>
                      <p className="text-sm text-slate-600 mb-2">
                        {template.service_category.replace(/_/g, ' ')}
                        {template.description && ` - ${template.description}`}
                      </p>
                      <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Next: {formatDate(template.next_scheduled_date)}
                        </span>
                        {template.preferred_time && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {template.preferred_time}
                          </span>
                        )}
                        {template.address && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {template.city || template.address}
                          </span>
                        )}
                        {template.quoted_amount && (
                          <span className="flex items-center gap-1 text-green-600">
                            ${template.quoted_amount.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleActive(template)}
                      className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                      title={template.is_active ? 'Pause' : 'Resume'}
                    >
                      {template.is_active ? (
                        <Pause className="w-5 h-5" />
                      ) : (
                        <Play className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={() => openEditModal(template)}
                      className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                      title="Edit"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => deleteTemplate(template.id)}
                      className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingTemplate ? 'Edit Recurring Job' : 'New Recurring Job'}
              </h2>
              <button
                onClick={() => { setShowModal(false); setEditingTemplate(null); }}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Customer Name *
                </label>
                <Input
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  placeholder="John Smith"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Service Type *
                </label>
                <select
                  value={formData.service_category}
                  onChange={(e) => setFormData({ ...formData, service_category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="maintenance">Maintenance</option>
                  <option value="hvac_maintenance">HVAC Maintenance</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="electrical">Electrical</option>
                  <option value="inspection">Inspection</option>
                  <option value="cleaning">Cleaning</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Quarterly HVAC filter replacement..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Address
                  </label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="123 Main St"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    City
                  </label>
                  <Input
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Austin"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Frequency *
                  </label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Every 2 Weeks</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="semiannual">Every 6 Months</option>
                    <option value="annual">Annually</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Preferred Time
                  </label>
                  <Input
                    type="time"
                    value={formData.preferred_time}
                    onChange={(e) => setFormData({ ...formData, preferred_time: e.target.value })}
                  />
                </div>
              </div>

              {(formData.frequency === 'weekly' || formData.frequency === 'biweekly') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Day of Week
                  </label>
                  <select
                    value={formData.day_of_week || 1}
                    onChange={(e) => setFormData({ ...formData, day_of_week: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {dayOfWeekLabels.map((day, i) => (
                      <option key={i} value={i}>{day}</option>
                    ))}
                  </select>
                </div>
              )}

              {(formData.frequency === 'monthly' || formData.frequency === 'quarterly' || formData.frequency === 'semiannual') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Day of Month
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.day_of_month}
                    onChange={(e) => setFormData({ ...formData, day_of_month: parseInt(e.target.value) || 1 })}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    First Scheduled Date
                  </label>
                  <Input
                    type="date"
                    value={formData.next_scheduled_date}
                    onChange={(e) => setFormData({ ...formData, next_scheduled_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Quoted Amount ($)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.quoted_amount}
                    onChange={(e) => setFormData({ ...formData, quoted_amount: e.target.value })}
                    placeholder="150.00"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => { setShowModal(false); setEditingTemplate(null); }}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit}>
                {editingTemplate ? 'Save Changes' : 'Create Schedule'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
