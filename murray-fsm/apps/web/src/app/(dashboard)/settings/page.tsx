// Murray's FSM - Business Settings Page
// ======================================
// Configure business info, hours, payment, notifications, and feature flags.

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  Building2, Clock, CreditCard, Bell, Globe, Shield, Palette, Link as LinkIcon,
} from 'lucide-react';
import Link from 'next/link';
import { SettingsForm } from './SettingsForm';

async function getSettings() {
  const supabase = createClient();

  const { data: settings } = await supabase
    .from('business_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  return settings;
}

export default async function SettingsPage() {
  const settings = await getSettings();

  const sections = [
    {
      icon: Building2,
      title: 'Business Information',
      description: 'Name, phone, email, address, license number',
      fields: [
        { key: 'business_name', label: 'Business Name', type: 'text' },
        { key: 'business_phone', label: 'Phone', type: 'tel' },
        { key: 'business_email', label: 'Email', type: 'email' },
        { key: 'business_address', label: 'Address', type: 'text' },
        { key: 'license_number', label: 'License Number', type: 'text' },
      ],
    },
    {
      icon: Clock,
      title: 'Scheduling',
      description: 'Business hours, job duration, buffer time',
      fields: [
        { key: 'default_job_duration_minutes', label: 'Default Job Duration (min)', type: 'number' },
        { key: 'buffer_between_jobs_minutes', label: 'Buffer Between Jobs (min)', type: 'number' },
        { key: 'max_jobs_per_day', label: 'Max Jobs Per Day', type: 'number' },
      ],
    },
    {
      icon: CreditCard,
      title: 'Payments',
      description: 'Stripe configuration, rates, tax',
      fields: [
        { key: 'stripe_account_id', label: 'Stripe Account ID', type: 'text' },
        { key: 'hourly_rate_cents', label: 'Hourly Rate (cents)', type: 'number' },
        { key: 'service_call_fee_cents', label: 'Service Call Fee (cents)', type: 'number' },
        { key: 'tax_rate', label: 'Tax Rate (%)', type: 'number' },
      ],
    },
    {
      icon: Palette,
      title: 'Branding',
      description: 'Colors, logo, portal appearance',
      fields: [
        { key: 'primary_color', label: 'Primary Color', type: 'color' },
        { key: 'secondary_color', label: 'Secondary Color', type: 'color' },
        { key: 'business_logo_url', label: 'Logo URL', type: 'url' },
      ],
    },
  ];

  const features = (settings?.features as Record<string, boolean>) || {};

  return (
    <div>
      <Header title="Settings" />

      <div className="p-6 space-y-6">
        {/* Quick Links */}
        <div className="flex items-center gap-3">
          <Link href="/settings/integrations"
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-2">
            <LinkIcon className="w-4 h-4" />
            Integrations & API Keys
          </Link>
        </div>

        {/* Feature Flags */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { key: 'online_booking', label: 'Online Booking Widget' },
                { key: 'customer_portal', label: 'Customer Portal' },
                { key: 'auto_reminders', label: 'Auto Reminders' },
                { key: 'review_requests', label: 'Review Requests' },
                { key: 'route_optimization', label: 'Route Optimization' },
                { key: 'inventory_tracking', label: 'Inventory Tracking' },
              ].map((feature) => (
                <div key={feature.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium text-slate-700">{feature.label}</span>
                  <Badge variant={features[feature.key] ? 'success' : 'default'}>
                    {features[feature.key] ? 'On' : 'Off'}
                  </Badge>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Feature toggles are saved in business_settings. Update via API or database.
            </p>
          </CardContent>
        </Card>

        {/* Settings Sections */}
        <SettingsForm settings={settings} sections={sections} />

        {/* Booking Widget Embed Code */}
        {features.online_booking && settings?.owner_id && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Booking Widget
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-3">
                Share this link or embed it on your website to let customers book online:
              </p>
              <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                {process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'}/book/{settings.owner_id}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Or embed as an iframe on your website.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Portal Link */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 space-y-2">
            <p>All data is protected by Row-Level Security (RLS) in Supabase.</p>
            <p>API keys are scoped with specific permissions.</p>
            <p>Webhook signatures are verified before processing.</p>
            <p>Customer portal tokens expire after 30 days.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
