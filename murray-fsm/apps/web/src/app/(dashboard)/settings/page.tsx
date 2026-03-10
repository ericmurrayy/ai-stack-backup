// Murray's FSM - Settings Page
// ==============================

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  Settings,
  Building2,
  Bell,
  Palette,
  CreditCard,
  Globe,
  Shield,
  Plug,
  Users,
  Mail,
  Phone,
  MapPin,
  Clock,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

interface SettingSection {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  badge?: string;
}

export default async function SettingsPage() {
  const settingSections: SettingSection[] = [
    {
      title: 'Company Profile',
      description: 'Business name, logo, address, phone, and operating hours',
      icon: <Building2 className="w-5 h-5 text-blue-600" />,
      href: '/settings/company',
    },
    {
      title: 'Integrations',
      description: 'Connect Google Calendar, QuickBooks, Stripe, and more',
      icon: <Plug className="w-5 h-5 text-purple-600" />,
      href: '/settings/integrations',
      badge: 'Active',
    },
    {
      title: 'Notifications',
      description: 'Email, SMS, and push notification preferences',
      icon: <Bell className="w-5 h-5 text-yellow-600" />,
      href: '/settings/notifications',
    },
    {
      title: 'Branding & Appearance',
      description: 'Customer portal colors, logo, and email templates',
      icon: <Palette className="w-5 h-5 text-pink-600" />,
      href: '/settings/branding',
    },
    {
      title: 'Billing & Subscription',
      description: 'Your plan, payment method, and billing history',
      icon: <CreditCard className="w-5 h-5 text-green-600" />,
      href: '/settings/billing',
    },
    {
      title: 'Online Booking',
      description: 'Configure your public booking page and available services',
      icon: <Globe className="w-5 h-5 text-blue-600" />,
      href: '/settings/booking',
    },
    {
      title: 'Team Permissions',
      description: 'Manage roles, permissions, and access levels',
      icon: <Users className="w-5 h-5 text-indigo-600" />,
      href: '/settings/permissions',
    },
    {
      title: 'Security',
      description: 'Two-factor authentication, API keys, and sessions',
      icon: <Shield className="w-5 h-5 text-red-600" />,
      href: '/settings/security',
    },
  ];

  return (
    <div>
      <Header title="Settings" />

      <div className="p-6 space-y-6 max-w-4xl">
        {/* Settings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {settingSections.map((section) => (
            <Link key={section.title} href={section.href}>
              <Card className="p-5 hover:shadow-md transition-all cursor-pointer group h-full">
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-slate-50 group-hover:bg-blue-50 transition-colors">
                    {section.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {section.title}
                      </h3>
                      {section.badge && (
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          {section.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-1">{section.description}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors mt-1 flex-shrink-0" />
                </div>
              </Card>
            </Link>
          ))}
        </div>

        {/* Danger Zone */}
        <Card padding="none" className="border-red-200">
          <div className="px-6 py-4 border-b border-red-100 bg-red-50">
            <h3 className="text-lg font-semibold text-red-900">Danger Zone</h3>
            <p className="text-sm text-red-600 mt-1">
              These actions are permanent and cannot be undone
            </p>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-900">Export All Data</div>
                <div className="text-sm text-slate-500">Download a CSV export of all your data</div>
              </div>
              <button className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
                Export
              </button>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-red-100">
              <div>
                <div className="font-medium text-red-900">Delete Account</div>
                <div className="text-sm text-red-500">Permanently delete your account and all data</div>
              </div>
              <button className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">
                Delete Account
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
