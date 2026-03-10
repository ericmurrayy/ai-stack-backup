'use client';

// Murray's FSM - Company Settings Page
// ======================================
// Business profile, operating hours, and service configuration

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  Clock,
  Globe,
  Image,
  Save,
  CheckCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface BusinessHour {
  day: number;
  open: boolean;
  start: string;
  end: string;
}

const DEFAULT_HOURS: BusinessHour[] = DAYS.map((_, i) => ({
  day: i,
  open: i >= 1 && i <= 5, // Mon-Fri
  start: '08:00',
  end: '17:00',
}));

export default function CompanySettingsPage() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    business_name: '',
    business_phone: '',
    business_email: '',
    business_address: '',
    business_city: '',
    business_state: '',
    business_zip: '',
    business_website: '',
    business_logo_url: '',
    primary_color: '#1e40af',
    secondary_color: '#3b82f6',
    default_job_duration_minutes: 120,
    business_hours: DEFAULT_HOURS,
    sms_enabled: true,
    email_notifications: true,
    review_link_google: '',
    review_link_yelp: '',
    tax_rate: 0,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('business_settings')
      .select('*')
      .eq('owner_id', user.id)
      .single();

    if (data) {
      setSettings(prev => ({
        ...prev,
        ...data,
        business_hours: data.business_hours || DEFAULT_HOURS,
      }));
    }
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('business_settings')
      .upsert({
        owner_id: user.id,
        ...settings,
      }, { onConflict: 'owner_id' });

    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  function updateField(field: string, value: any) {
    setSettings(prev => ({ ...prev, [field]: value }));
  }

  function updateHour(dayIndex: number, field: keyof BusinessHour, value: any) {
    setSettings(prev => ({
      ...prev,
      business_hours: prev.business_hours.map((h, i) =>
        i === dayIndex ? { ...h, [field]: value } : h
      ),
    }));
  }

  const inputClass = 'w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm';

  return (
    <div>
      <Header title="Company Settings" />

      <div className="p-6 space-y-6 max-w-3xl">
        {/* Save button sticky */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Configure your business profile and operating settings.</p>
          <Button onClick={handleSave} disabled={saving}>
            {saved ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </>
            )}
          </Button>
        </div>

        {/* Business Info */}
        <Card padding="none" className="p-6">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            Business Information
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Business Name</label>
              <input
                type="text"
                value={settings.business_name}
                onChange={e => updateField('business_name', e.target.value)}
                placeholder="Murray's Field Service Management"
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={settings.business_phone}
                  onChange={e => updateField('business_phone', e.target.value)}
                  placeholder="(555) 100-0000"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={settings.business_email}
                  onChange={e => updateField('business_email', e.target.value)}
                  placeholder="hello@murraysfsm.com"
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Website</label>
              <input
                type="url"
                value={settings.business_website}
                onChange={e => updateField('business_website', e.target.value)}
                placeholder="https://murraysfsm.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
              <input
                type="text"
                value={settings.business_address}
                onChange={e => updateField('business_address', e.target.value)}
                placeholder="123 Main Street"
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  value={settings.business_city}
                  onChange={e => updateField('business_city', e.target.value)}
                  placeholder="Austin"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                <input
                  type="text"
                  value={settings.business_state}
                  onChange={e => updateField('business_state', e.target.value)}
                  placeholder="TX"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ZIP</label>
                <input
                  type="text"
                  value={settings.business_zip}
                  onChange={e => updateField('business_zip', e.target.value)}
                  placeholder="78701"
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Branding */}
        <Card padding="none" className="p-6">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Image className="w-5 h-5 text-purple-600" />
            Branding
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Logo URL</label>
              <input
                type="url"
                value={settings.business_logo_url}
                onChange={e => updateField('business_logo_url', e.target.value)}
                placeholder="https://example.com/logo.png"
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Primary Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={settings.primary_color}
                    onChange={e => updateField('primary_color', e.target.value)}
                    className="w-10 h-10 rounded border border-slate-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.primary_color}
                    onChange={e => updateField('primary_color', e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Secondary Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={settings.secondary_color}
                    onChange={e => updateField('secondary_color', e.target.value)}
                    className="w-10 h-10 rounded border border-slate-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.secondary_color}
                    onChange={e => updateField('secondary_color', e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Business Hours */}
        <Card padding="none" className="p-6">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-green-600" />
            Business Hours
          </h3>
          <div className="space-y-3">
            {settings.business_hours.map((hour, i) => (
              <div key={i} className="flex items-center gap-4">
                <label className="w-28 text-sm font-medium text-slate-700">{DAYS[i]}</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hour.open}
                    onChange={e => updateHour(i, 'open', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-600">{hour.open ? 'Open' : 'Closed'}</span>
                </label>
                {hour.open && (
                  <>
                    <input
                      type="time"
                      value={hour.start}
                      onChange={e => updateHour(i, 'start', e.target.value)}
                      className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                    />
                    <span className="text-slate-400">to</span>
                    <input
                      type="time"
                      value={hour.end}
                      onChange={e => updateHour(i, 'end', e.target.value)}
                      className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Service Settings */}
        <Card padding="none" className="p-6">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" />
            Service Settings
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Default Job Duration (minutes)</label>
                <input
                  type="number"
                  value={settings.default_job_duration_minutes}
                  onChange={e => updateField('default_job_duration_minutes', parseInt(e.target.value) || 120)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tax Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.tax_rate}
                  onChange={e => updateField('tax_rate', parseFloat(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Google Review Link</label>
              <input
                type="url"
                value={settings.review_link_google}
                onChange={e => updateField('review_link_google', e.target.value)}
                placeholder="https://g.page/your-business/review"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Yelp Review Link</label>
              <input
                type="url"
                value={settings.review_link_yelp}
                onChange={e => updateField('review_link_yelp', e.target.value)}
                placeholder="https://yelp.com/biz/your-business"
                className={inputClass}
              />
            </div>
          </div>
        </Card>

        {/* Notification Preferences */}
        <Card padding="none" className="p-6">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5 text-red-600" />
            Notification Preferences
          </h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between cursor-pointer p-3 bg-slate-50 rounded-lg">
              <div>
                <span className="font-medium text-sm text-slate-900">SMS Notifications</span>
                <p className="text-xs text-slate-500">Send appointment reminders and updates via SMS</p>
              </div>
              <input
                type="checkbox"
                checked={settings.sms_enabled}
                onChange={e => updateField('sms_enabled', e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded border-slate-300"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer p-3 bg-slate-50 rounded-lg">
              <div>
                <span className="font-medium text-sm text-slate-900">Email Notifications</span>
                <p className="text-xs text-slate-500">Send estimate, invoice, and booking confirmations via email</p>
              </div>
              <input
                type="checkbox"
                checked={settings.email_notifications}
                onChange={e => updateField('email_notifications', e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded border-slate-300"
              />
            </label>
          </div>
        </Card>

        {/* Bottom Save */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saved ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
