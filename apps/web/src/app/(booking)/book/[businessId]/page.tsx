// Murray's FSM - Online Booking Widget
// =====================================
// Embeddable booking page for customer self-scheduling.
// Server component loads business data, client component handles the form.

import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { BookingForm } from './BookingForm';

async function getBusinessData(businessId: string) {
  const supabase = createClient();

  const { data: settings } = await supabase
    .from('business_settings')
    .select('*')
    .eq('owner_id', businessId)
    .single();

  if (!settings) return null;

  const features = (settings.features as Record<string, boolean>) || {};
  if (!features.online_booking) return null;

  return {
    id: businessId,
    name: settings.business_name || 'Service Provider',
    phone: settings.business_phone || '',
    email: settings.business_email || '',
    logo_url: settings.business_logo_url as string | undefined,
    primary_color: (settings.primary_color as string) || '#1e40af',
    default_job_duration_minutes: (settings.default_job_duration_minutes as number) || 120,
  };
}

export default async function BookingPage({
  params,
}: {
  params: { businessId: string };
}) {
  const business = await getBusinessData(params.businessId);

  if (!business) {
    notFound();
  }

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

      <div className="max-w-2xl mx-auto px-6 py-6">
        <BookingForm business={business} />
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
