// Murray's FSM - Booking Form Client Component
// ==============================================
// Interactive 4-step booking with real schedule API + form submission.

'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import {
  Calendar, Clock, MapPin, ChevronRight, CheckCircle, Wrench, Loader2,
} from 'lucide-react';

interface BusinessData {
  id: string;
  name: string;
  phone: string;
  email: string;
  primary_color: string;
  default_job_duration_minutes: number;
}

interface TimeSlot {
  start: string;
  end: string;
  durationMinutes: number;
}

interface BookingFormProps {
  business: BusinessData;
}

const SERVICE_TYPES = [
  { key: 'repair', label: 'Repair Service', desc: 'Fix an existing issue with your garage door' },
  { key: 'installation', label: 'New Installation', desc: 'Install a new garage door or opener' },
  { key: 'maintenance', label: 'Maintenance', desc: 'Preventive maintenance and tune-up' },
  { key: 'inspection', label: 'Safety Inspection', desc: 'Full safety inspection and report' },
];

export function BookingForm({ business }: BookingFormProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [serviceType, setServiceType] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', email: '',
    address: '', city: '', state: '', zip: '', notes: '',
  });

  // Confirmation data
  const [confirmation, setConfirmation] = useState<{
    jobId: string;
    portalUrl: string;
    scheduledStart: string;
    serviceType: string;
  } | null>(null);

  // Generate next 14 days
  const dates = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      date: d.toISOString().split('T')[0],
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: d.getDate(),
      monthName: d.toLocaleDateString('en-US', { month: 'short' }),
      isToday: i === 0,
    };
  });

  // Fetch available slots when date changes
  useEffect(() => {
    if (!selectedDate) return;
    setSlotsLoading(true);
    setSelectedSlot(null);

    const duration = serviceType === 'installation' ? 240
      : serviceType === 'maintenance' ? 45
      : serviceType === 'inspection' ? 60
      : 120;

    fetch(`/api/schedule/check?date=${selectedDate}&duration=${duration}`)
      .then(r => r.json())
      .then(data => {
        setSlots(data.slots || []);
        setSlotsLoading(false);
      })
      .catch(() => {
        setSlots([]);
        setSlotsLoading(false);
      });
  }, [selectedDate, serviceType]);

  const handleSubmit = async () => {
    if (!selectedSlot) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          serviceType,
          scheduledStart: selectedSlot.start,
          scheduledEnd: selectedSlot.end,
          ...form,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Booking failed');
        setLoading(false);
        return;
      }

      setConfirmation(result.data);
      setStep(4);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatSlotTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div>
      {/* Step 1: Select Service */}
      {step === 1 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">What service do you need?</h2>
          <div className="space-y-3">
            {SERVICE_TYPES.map((s) => (
              <Card
                key={s.key}
                className={`p-4 cursor-pointer transition-colors border-2 ${
                  serviceType === s.key ? 'border-blue-500' : 'border-transparent hover:border-slate-300'
                }`}
                onClick={() => { setServiceType(s.key); setStep(2); }}
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg" style={{ backgroundColor: `${business.primary_color}15` }}>
                    <Wrench className="w-6 h-6" style={{ color: business.primary_color }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-slate-900">{s.label}</h3>
                    <p className="text-sm text-slate-500">{s.desc}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Select Date & Time */}
      {step === 2 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Select a Date & Time</h2>

          {/* Date picker */}
          <div className="flex gap-2 overflow-x-auto pb-3 mb-4">
            {dates.map((d) => (
              <button
                key={d.date}
                onClick={() => setSelectedDate(d.date)}
                className={`flex-shrink-0 w-16 py-3 rounded-lg text-center transition-colors ${
                  selectedDate === d.date
                    ? 'text-white shadow-md'
                    : 'bg-white border border-slate-200 hover:border-slate-400 text-slate-700'
                }`}
                style={selectedDate === d.date ? { backgroundColor: business.primary_color } : {}}
              >
                <div className="text-xs font-medium">{d.dayName}</div>
                <div className="text-lg font-bold">{d.dayNum}</div>
                <div className="text-xs">{d.monthName}</div>
              </button>
            ))}
          </div>

          {/* Time slots */}
          {selectedDate && (
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-2">Available Times</h3>
              {slotsLoading ? (
                <div className="flex items-center gap-2 text-slate-500 py-8 justify-center">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Checking availability...</span>
                </div>
              ) : slots.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No available times on this date. Try another day.
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {slots.map((slot, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedSlot(slot)}
                      className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                        selectedSlot?.start === slot.start
                          ? 'text-white shadow-md'
                          : 'border border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                      style={selectedSlot?.start === slot.start ? { backgroundColor: business.primary_color } : {}}
                    >
                      {formatSlotTime(slot.start)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Customer Info */}
      {step === 3 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Your Information</h2>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}
          <Card className="p-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">First Name *</label>
                  <input type="text" required value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Last Name *</label>
                  <input type="text" required value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone *</label>
                <input type="tel" required placeholder="(555) 123-4567" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input type="email" placeholder="you@example.com" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Service Address *</label>
                <input type="text" required placeholder="123 Main St" value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">City *</label>
                  <input type="text" required value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">State *</label>
                  <input type="text" required placeholder="TX" value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ZIP *</label>
                  <input type="text" required value={form.zip}
                    onChange={(e) => setForm({ ...form, zip: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea rows={3} placeholder="Describe the issue..." value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Step 4: Confirmation */}
      {step === 4 && confirmation && (
        <div className="text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: `${business.primary_color}15` }}>
            <CheckCircle className="w-8 h-8" style={{ color: business.primary_color }} />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Booking Confirmed!</h2>
          <p className="text-slate-500 mb-6">We&apos;ve sent a confirmation to your phone.</p>

          <Card className="p-4 text-left mb-6">
            <h3 className="font-medium text-slate-900 mb-3">Appointment Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Wrench className="w-4 h-4" />
                <span>{confirmation.serviceType}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Calendar className="w-4 h-4" />
                <span>{new Date(confirmation.scheduledStart).toLocaleDateString('en-US', {
                  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
                })}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Clock className="w-4 h-4" />
                <span>{formatSlotTime(confirmation.scheduledStart)}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="w-4 h-4" />
                <span>{form.address}, {form.city}, {form.state} {form.zip}</span>
              </div>
            </div>
          </Card>

          <a href={confirmation.portalUrl}
            className="inline-block px-6 py-2 text-sm font-medium text-white rounded-lg mb-4"
            style={{ backgroundColor: business.primary_color }}>
            View in Customer Portal
          </a>
          <p className="text-sm text-slate-500">
            Questions? Call <a href={`tel:${business.phone}`} className="text-blue-600">{business.phone}</a>
          </p>
        </div>
      )}

      {/* Navigation */}
      {step < 4 && (
        <div className="flex justify-between mt-8">
          {step > 1 ? (
            <button onClick={() => setStep(step - 1)}
              className="px-6 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
              Back
            </button>
          ) : <div />}

          {step === 2 && selectedSlot && (
            <button onClick={() => setStep(3)}
              className="px-6 py-2 text-sm font-medium text-white rounded-lg"
              style={{ backgroundColor: business.primary_color }}>
              Continue
            </button>
          )}

          {step === 3 && (
            <button onClick={handleSubmit} disabled={loading || !form.firstName || !form.phone || !form.address || !form.city || !form.state || !form.zip}
              className="px-6 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
              style={{ backgroundColor: business.primary_color }}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Book Appointment
            </button>
          )}
        </div>
      )}
    </div>
  );
}
