// Murray's FSM - Notification Settings
// =======================================
// Configure email, SMS, and push notification preferences

'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  ArrowLeft,
  Save,
  CheckCircle,
} from 'lucide-react';
import Link from 'next/link';

interface NotificationSetting {
  key: string;
  label: string;
  description: string;
  email: boolean;
  sms: boolean;
  push: boolean;
}

const defaultSettings: NotificationSetting[] = [
  {
    key: 'new_job',
    label: 'New Job Created',
    description: 'When a new job comes in from booking, call, or manual entry',
    email: true,
    sms: true,
    push: true,
  },
  {
    key: 'job_assigned',
    label: 'Job Assigned',
    description: 'When a job is assigned to a technician',
    email: true,
    sms: false,
    push: true,
  },
  {
    key: 'job_completed',
    label: 'Job Completed',
    description: 'When a technician marks a job as completed',
    email: true,
    sms: false,
    push: true,
  },
  {
    key: 'estimate_approved',
    label: 'Estimate Approved',
    description: 'When a customer approves an estimate',
    email: true,
    sms: true,
    push: true,
  },
  {
    key: 'estimate_rejected',
    label: 'Estimate Rejected',
    description: 'When a customer declines an estimate',
    email: true,
    sms: false,
    push: true,
  },
  {
    key: 'payment_received',
    label: 'Payment Received',
    description: 'When a payment is successfully processed',
    email: true,
    sms: false,
    push: true,
  },
  {
    key: 'new_review',
    label: 'New Review',
    description: 'When a customer leaves a review',
    email: true,
    sms: false,
    push: true,
  },
  {
    key: 'low_inventory',
    label: 'Low Inventory Alert',
    description: 'When inventory falls below minimum threshold',
    email: true,
    sms: false,
    push: false,
  },
  {
    key: 'upcoming_agreement',
    label: 'Agreement Renewal',
    description: 'Reminder for upcoming service agreement renewals',
    email: true,
    sms: false,
    push: false,
  },
  {
    key: 'daily_summary',
    label: 'Daily Summary',
    description: 'End-of-day summary of jobs, revenue, and activity',
    email: true,
    sms: false,
    push: false,
  },
];

export default function NotificationsSettingsPage() {
  const [settings, setSettings] = useState<NotificationSetting[]>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggleChannel = (key: string, channel: 'email' | 'sms' | 'push') => {
    setSettings((prev) =>
      prev.map((s) =>
        s.key === key ? { ...s, [channel]: !s[channel] } : s
      )
    );
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    // Would save to Supabase business_settings
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    setSaved(true);
  };

  return (
    <div>
      <Header title="Notification Preferences" />

      <div className="p-6 space-y-6 max-w-4xl">
        {/* Back */}
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </Link>

        {/* Channel Overview */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 text-center">
            <Mail className="w-6 h-6 text-blue-600 mx-auto mb-2" />
            <div className="font-medium text-slate-900">Email</div>
            <div className="text-sm text-slate-500">
              {settings.filter((s) => s.email).length} active
            </div>
          </Card>
          <Card className="p-4 text-center">
            <MessageSquare className="w-6 h-6 text-green-600 mx-auto mb-2" />
            <div className="font-medium text-slate-900">SMS</div>
            <div className="text-sm text-slate-500">
              {settings.filter((s) => s.sms).length} active
            </div>
          </Card>
          <Card className="p-4 text-center">
            <Smartphone className="w-6 h-6 text-purple-600 mx-auto mb-2" />
            <div className="font-medium text-slate-900">Push</div>
            <div className="text-sm text-slate-500">
              {settings.filter((s) => s.push).length} active
            </div>
          </Card>
        </div>

        {/* Notification Table */}
        <Card padding="none">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Notifications</h2>
              <p className="text-sm text-slate-500">Choose how you want to be notified</p>
            </div>
            <Button onClick={handleSave} loading={saving} size="sm">
              {saved ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-1" />
                  Save Changes
                </>
              )}
            </Button>
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Event
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider w-20">
                  <Mail className="w-4 h-4 mx-auto" aria-label="Email" />
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider w-20">
                  <MessageSquare className="w-4 h-4 mx-auto" aria-label="SMS" />
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider w-20">
                  <Smartphone className="w-4 h-4 mx-auto" aria-label="Push" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {settings.map((setting) => (
                <tr key={setting.key} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{setting.label}</div>
                    <div className="text-sm text-slate-500">{setting.description}</div>
                  </td>
                  <td className="text-center px-4 py-4">
                    <button
                      onClick={() => toggleChannel(setting.key, 'email')}
                      aria-label={`Toggle email for ${setting.label}`}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                        setting.email
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-100 text-slate-300'
                      }`}
                    >
                      <Bell className="w-3.5 h-3.5" />
                    </button>
                  </td>
                  <td className="text-center px-4 py-4">
                    <button
                      onClick={() => toggleChannel(setting.key, 'sms')}
                      aria-label={`Toggle SMS for ${setting.label}`}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                        setting.sms
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-300'
                      }`}
                    >
                      <Bell className="w-3.5 h-3.5" />
                    </button>
                  </td>
                  <td className="text-center px-4 py-4">
                    <button
                      onClick={() => toggleChannel(setting.key, 'push')}
                      aria-label={`Toggle push for ${setting.label}`}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                        setting.push
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-slate-100 text-slate-300'
                      }`}
                    >
                      <Bell className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
