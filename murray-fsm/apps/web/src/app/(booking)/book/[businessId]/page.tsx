// Murray's FSM - Online Booking Widget
// =====================================
// Embeddable booking page for customer self-scheduling

import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/Card';
import { serviceCategoryConfig } from '@/lib/utils';
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Mail,
  User,
  ChevronRight,
  CheckCircle,
  Wrench,
  Droplets,
  Zap,
  Wind,
  Settings,
  Trees,
  Sparkles,
  Paintbrush,
  Home,
  HelpCircle,
} from 'lucide-react';
import { notFound } from 'next/navigation';

interface BusinessData {
  id: string;
  name: string;
  phone: string;
  email: string;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
  business_hours: Array<{
    day: number;
    open: boolean;
    start?: string;
    end?: string;
  }>;
  default_job_duration_minutes: number;
  service_types: string[];
  service_areas: string[];
}

interface TimeSlot {
  start: string;
  end: string;
  available: boolean;
}

async function getBusinessData(businessId: string): Promise<BusinessData | null> {
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from('business_settings')
    .select('*')
    .eq('owner_id', businessId)
    .single();

  if (!settings) return null;

  // Check if online booking is enabled
  const features = settings.features as Record<string, boolean> || {};
  if (!features.online_booking) return null;

  return {
    id: businessId,
    name: settings.business_name || 'Service Provider',
    phone: settings.business_phone || '',
    email: settings.business_email || '',
    logo_url: settings.business_logo_url,
    primary_color: settings.primary_color || '#1e40af',
    secondary_color: settings.secondary_color || '#3b82f6',
    business_hours: settings.business_hours || [],
    default_job_duration_minutes: settings.default_job_duration_minutes || 120,
    service_types: ['plumbing', 'electrical', 'hvac', 'general', 'landscaping', 'cleaning', 'painting', 'roofing', 'other'],
    service_areas: [],
  };
}

const SERVICE_TYPE_LABELS: Record<string, { label: string; description: string; icon: typeof Wrench }> = {
  plumbing: {
    label: 'Plumbing',
    description: 'Pipe repairs, drain cleaning, water heater service, and more',
    icon: Droplets,
  },
  electrical: {
    label: 'Electrical',
    description: 'Wiring, outlets, panel upgrades, lighting, and electrical repairs',
    icon: Zap,
  },
  hvac: {
    label: 'HVAC',
    description: 'Heating, ventilation, air conditioning installation and repair',
    icon: Wind,
  },
  general: {
    label: 'General',
    description: 'General maintenance, handyman services, and miscellaneous repairs',
    icon: Settings,
  },
  landscaping: {
    label: 'Landscaping',
    description: 'Lawn care, garden design, tree trimming, and outdoor maintenance',
    icon: Trees,
  },
  cleaning: {
    label: 'Cleaning',
    description: 'Deep cleaning, regular maintenance cleaning, and specialty services',
    icon: Sparkles,
  },
  painting: {
    label: 'Painting',
    description: 'Interior and exterior painting, staining, and wall treatments',
    icon: Paintbrush,
  },
  roofing: {
    label: 'Roofing',
    description: 'Roof repair, replacement, inspection, and gutter services',
    icon: Home,
  },
  other: {
    label: 'Other',
    description: 'Other services not listed above',
    icon: HelpCircle,
  },
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { businessId } = await params;
  const { step: stepParam } = await searchParams;
  const business = await getBusinessData(businessId);

  if (!business) {
    notFound();
  }

  const step = parseInt(stepParam || '1');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header
        className="bg-white shadow-sm"
        style={{ borderTopColor: business.primary_color, borderTopWidth: '4px' }}
      >
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            {business.logo_url ? (
              <img src={business.logo_url} alt={business.name} className="h-12" />
            ) : (
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl"
                style={{ backgroundColor: business.primary_color }}
              >
                {business.name.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-xl font-semibold text-slate-900">{business.name}</h1>
              <p className="text-sm text-slate-500">Book Your Appointment</p>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="max-w-2xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-8">
          {[
            { num: 1, label: 'Service' },
            { num: 2, label: 'Date & Time' },
            { num: 3, label: 'Your Info' },
            { num: 4, label: 'Confirm' },
          ].map((s, i) => (
            <div key={s.num} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= s.num
                    ? 'text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
                style={step >= s.num ? { backgroundColor: business.primary_color } : {}}
              >
                {step > s.num ? <CheckCircle className="w-5 h-5" /> : s.num}
              </div>
              <span className={`ml-2 text-sm ${step >= s.num ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>
                {s.label}
              </span>
              {i < 3 && (
                <ChevronRight className="w-4 h-4 text-slate-300 mx-4" />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Select Service */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">What service do you need?</h2>
            <div className="space-y-3">
              {business.service_types.map((type) => {
                const info = SERVICE_TYPE_LABELS[type] || { label: type, description: '', icon: Wrench };
                const IconComponent = info.icon;
                return (
                  <Card
                    key={type}
                    className="p-4 hover:border-blue-300 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="p-3 rounded-lg"
                        style={{ backgroundColor: `${business.primary_color}15` }}
                      >
                        <IconComponent className="w-6 h-6" style={{ color: business.primary_color }} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-slate-900">{info.label}</h3>
                        <p className="text-sm text-slate-500">{info.description}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Select Date & Time */}
        {step === 2 && (
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Select a Date & Time</h2>

            {/* Calendar would go here - simplified version */}
            <Card className="p-4 mb-4">
              <div className="grid grid-cols-7 gap-2 text-center mb-4">
                {DAYS.map((day) => (
                  <div key={day} className="text-xs font-medium text-slate-500">
                    {day.slice(0, 3)}
                  </div>
                ))}
                {/* Generate next 7 days */}
                {Array.from({ length: 7 }).map((_, i) => {
                  const date = new Date();
                  date.setDate(date.getDate() + i);
                  const dayOfWeek = date.getDay();
                  const hours = business.business_hours[dayOfWeek];
                  const isOpen = hours?.open !== false;

                  return (
                    <button
                      key={i}
                      disabled={!isOpen}
                      className={`p-2 rounded-lg text-sm ${
                        isOpen
                          ? 'hover:bg-blue-50 text-slate-900'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Time Slots */}
            <h3 className="text-sm font-medium text-slate-700 mb-2">Available Times</h3>
            <div className="grid grid-cols-4 gap-2">
              {['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'].map(
                (time) => (
                  <button
                    key={time}
                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50"
                  >
                    {time}
                  </button>
                )
              )}
            </div>
          </div>
        )}

        {/* Step 3: Customer Info */}
        {step === 3 && (
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Your Information</h2>
            <Card className="p-4">
              <form className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="booking-first-name" className="block text-sm font-medium text-slate-700 mb-1">
                      First Name *
                    </label>
                    <input
                      id="booking-first-name"
                      type="text"
                      required
                      placeholder="First name"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="booking-last-name" className="block text-sm font-medium text-slate-700 mb-1">
                      Last Name *
                    </label>
                    <input
                      id="booking-last-name"
                      type="text"
                      required
                      placeholder="Last name"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="(555) 123-4567"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Service Address *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="123 Main St"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="booking-city" className="block text-sm font-medium text-slate-700 mb-1">City *</label>
                    <input
                      id="booking-city"
                      type="text"
                      required
                      placeholder="City"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="booking-state" className="block text-sm font-medium text-slate-700 mb-1">State *</label>
                    <select id="booking-state" title="State" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>CO</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="booking-zip" className="block text-sm font-medium text-slate-700 mb-1">ZIP *</label>
                    <input
                      id="booking-zip"
                      type="text"
                      required
                      placeholder="ZIP code"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Additional Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe the issue or any special instructions..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <div className="text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: `${business.primary_color}15` }}
            >
              <CheckCircle className="w-8 h-8" style={{ color: business.primary_color }} />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Booking Confirmed!</h2>
            <p className="text-slate-500 mb-6">
              We&apos;ve sent a confirmation to your email address.
            </p>

            <Card className="p-4 text-left mb-6">
              <h3 className="font-medium text-slate-900 mb-3">Appointment Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <Wrench className="w-4 h-4" />
                  <span>Repair Service</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="w-4 h-4" />
                  <span>Monday, January 15, 2024</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Clock className="w-4 h-4" />
                  <span>9:00 AM - 11:00 AM</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <MapPin className="w-4 h-4" />
                  <span>123 Main St, Denver, CO 80202</span>
                </div>
              </div>
            </Card>

            <p className="text-sm text-slate-500">
              Questions? Call us at{' '}
              <a href={`tel:${business.phone}`} className="text-blue-600 hover:underline">
                {business.phone}
              </a>
            </p>
          </div>
        )}

        {/* Navigation Buttons */}
        {step < 4 && (
          <div className="flex justify-between mt-8">
            {step > 1 ? (
              <button className="px-6 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
                Back
              </button>
            ) : (
              <div />
            )}
            <button
              className="px-6 py-2 text-sm font-medium text-white rounded-lg"
              style={{ backgroundColor: business.primary_color }}
            >
              {step === 3 ? 'Book Appointment' : 'Continue'}
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-12 py-6 border-t border-slate-200 bg-white">
        <div className="max-w-2xl mx-auto px-6 text-center text-sm text-slate-500">
          <p className="mb-2">
            {business.name} • {business.phone} • {business.email}
          </p>
          <p>Powered by Murray&apos;s FSM</p>
        </div>
      </footer>
    </div>
  );
}
