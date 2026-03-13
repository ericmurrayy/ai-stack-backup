// Murray's FSM - Online Booking Settings
// ========================================
// Configure public booking page, services, and availability

'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Globe,
  ArrowLeft,
  Save,
  CheckCircle,
  Copy,
  ExternalLink,
  Clock,
  Wrench,
  Calendar,
  Eye,
} from 'lucide-react';
import Link from 'next/link';

interface ServiceOption {
  id: string;
  name: string;
  enabled: boolean;
  duration: number;
  price_range: string;
}

const defaultServices: ServiceOption[] = [
  { id: '1', name: 'Garage Door Repair', enabled: true, duration: 120, price_range: '$150-$400' },
  { id: '2', name: 'Spring Replacement', enabled: true, duration: 90, price_range: '$200-$350' },
  { id: '3', name: 'Opener Installation', enabled: true, duration: 180, price_range: '$300-$600' },
  { id: '4', name: 'New Door Installation', enabled: true, duration: 240, price_range: '$800-$2000' },
  { id: '5', name: 'Panel Replacement', enabled: true, duration: 120, price_range: '$250-$500' },
  { id: '6', name: 'Maintenance & Tune-up', enabled: true, duration: 60, price_range: '$99-$149' },
  { id: '7', name: 'Emergency Service', enabled: true, duration: 120, price_range: '$200-$500' },
  { id: '8', name: 'Track & Roller Repair', enabled: false, duration: 90, price_range: '$150-$300' },
];

export default function BookingSettingsPage() {
  const [services, setServices] = useState(defaultServices);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [bookingEnabled, setBookingEnabled] = useState(true);
  const [requireApproval, setRequireApproval] = useState(true);
  const [leadTime, setLeadTime] = useState(24);
  const [maxDaysOut, setMaxDaysOut] = useState(30);

  const bookingUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/book/murray-garage`
    : '/book/murray-garage';

  const toggleService = (id: string) => {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
    setSaved(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    setSaved(true);
  };

  return (
    <div>
      <Header title="Online Booking" />

      <div className="p-6 space-y-6 max-w-4xl">
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </Link>

        {/* Booking Link */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 rounded-xl">
                <Globe className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">Your Booking Page</h2>
                <p className="text-sm text-slate-500">Share this link with your customers</p>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm text-slate-600">
                {bookingEnabled ? 'Active' : 'Disabled'}
              </span>
              <button
                onClick={() => setBookingEnabled(!bookingEnabled)}
                aria-label="Toggle booking page"
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  bookingEnabled ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    bookingEnabled ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </label>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={bookingUrl}
              readOnly
              aria-label="Booking page URL"
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 font-mono"
            />
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Link href={bookingUrl} target="_blank">
              <Button variant="outline" size="sm">
                <ExternalLink className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </Card>

        {/* Booking Rules */}
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-600" />
            Booking Rules
          </h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label htmlFor="leadTime" className="block text-sm font-medium text-slate-700 mb-1">
                Minimum Lead Time (hours)
              </label>
              <input
                id="leadTime"
                type="number"
                value={leadTime}
                onChange={(e) => setLeadTime(parseInt(e.target.value) || 0)}
                min={0}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">
                How far in advance customers must book
              </p>
            </div>
            <div>
              <label htmlFor="maxDaysOut" className="block text-sm font-medium text-slate-700 mb-1">
                Max Days in Advance
              </label>
              <input
                id="maxDaysOut"
                type="number"
                value={maxDaysOut}
                onChange={(e) => setMaxDaysOut(parseInt(e.target.value) || 7)}
                min={1}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">
                How far out customers can book
              </p>
            </div>
            <div className="col-span-2 flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <div className="font-medium text-slate-900 text-sm">Require Admin Approval</div>
                <div className="text-xs text-slate-500">
                  Bookings need approval before being confirmed
                </div>
              </div>
              <button
                onClick={() => setRequireApproval(!requireApproval)}
                aria-label="Toggle require approval"
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  requireApproval ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    requireApproval ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
          </div>
        </Card>

        {/* Available Services */}
        <Card padding="none">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Available Services</h2>
              <p className="text-sm text-slate-500">
                {services.filter((s) => s.enabled).length} of {services.length} services enabled
              </p>
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
                  Save
                </>
              )}
            </Button>
          </div>

          <div className="divide-y divide-slate-200">
            {services.map((service) => (
              <div
                key={service.id}
                className="px-6 py-4 flex items-center justify-between hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${service.enabled ? 'bg-blue-50' : 'bg-slate-50'}`}>
                    <Wrench className={`w-4 h-4 ${service.enabled ? 'text-blue-600' : 'text-slate-400'}`} />
                  </div>
                  <div>
                    <div className={`font-medium ${service.enabled ? 'text-slate-900' : 'text-slate-400'}`}>
                      {service.name}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {service.duration} min
                      </span>
                      <span>{service.price_range}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => toggleService(service.id)}
                  aria-label={`Toggle ${service.name}`}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    service.enabled ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      service.enabled ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
