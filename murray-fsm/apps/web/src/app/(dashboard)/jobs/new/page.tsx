// Murray's FSM - New Job Page
// ============================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const SERVICE_CATEGORIES = [
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'general', label: 'General' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'painting', label: 'Painting' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'other', label: 'Other' },
];

const URGENCY_LEVELS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'emergency', label: 'Emergency' },
];

interface FormData {
  customer_name: string;
  phone_number: string;
  email: string;
  address: string;
  city: string;
  zip_code: string;
  service_category: string;
  urgency: string;
  issue_description: string;
  preferred_time: string;
}

const initialForm: FormData = {
  customer_name: '',
  phone_number: '',
  email: '',
  address: '',
  city: '',
  zip_code: '',
  service_category: 'general',
  urgency: 'medium',
  issue_description: '',
  preferred_time: '',
};

export default function NewJobPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function formatE164(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
    return `+${digits}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.customer_name.trim()) {
      setError('Customer name is required.');
      return;
    }
    if (!form.phone_number.trim()) {
      setError('Phone number is required.');
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const phone_e164 = formatE164(form.phone_number);

      const { data, error: insertError } = await supabase
        .from('jobs')
        .insert({
          customer_name: form.customer_name.trim(),
          phone_number: form.phone_number.trim(),
          phone_e164,
          email: form.email.trim() || null,
          address: form.address.trim() || null,
          city: form.city.trim() || null,
          zip_code: form.zip_code.trim() || null,
          service_category: form.service_category,
          urgency: form.urgency,
          issue_description: form.issue_description.trim() || null,
          preferred_time: form.preferred_time.trim() || null,
          status: 'new',
          is_spam: false,
        })
        .select('id')
        .single();

      if (insertError) {
        setError(insertError.message);
        return;
      }

      router.push(`/jobs/${data.id}`);
    } catch (err) {
      setError('Failed to create job. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

  return (
    <div>
      <Header title="New Job" />

      <div className="p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/jobs" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </Link>
          <h1 className="text-xl font-bold text-slate-900">Create New Job</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Customer Info */}
          <Card padding="none" className="p-5">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
              Customer Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="customer_name" className={labelClass}>
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="customer_name"
                  name="customer_name"
                  type="text"
                  value={form.customer_name}
                  onChange={handleChange}
                  placeholder="John Smith"
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label htmlFor="phone_number" className={labelClass}>
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  id="phone_number"
                  name="phone_number"
                  type="tel"
                  value={form.phone_number}
                  onChange={handleChange}
                  placeholder="(555) 123-4567"
                  className={inputClass}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="email" className={labelClass}>
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="john@example.com"
                  className={inputClass}
                />
              </div>
            </div>
          </Card>

          {/* Location */}
          <Card padding="none" className="p-5">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
              Service Location
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="address" className={labelClass}>
                  Address
                </label>
                <input
                  id="address"
                  name="address"
                  type="text"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="123 Main St"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="city" className={labelClass}>
                  City
                </label>
                <input
                  id="city"
                  name="city"
                  type="text"
                  value={form.city}
                  onChange={handleChange}
                  placeholder="Anytown"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="zip_code" className={labelClass}>
                  ZIP Code
                </label>
                <input
                  id="zip_code"
                  name="zip_code"
                  type="text"
                  value={form.zip_code}
                  onChange={handleChange}
                  placeholder="12345"
                  className={inputClass}
                />
              </div>
            </div>
          </Card>

          {/* Job Details */}
          <Card padding="none" className="p-5">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
              Job Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="service_category" className={labelClass}>
                  Service Category
                </label>
                <select
                  id="service_category"
                  name="service_category"
                  value={form.service_category}
                  onChange={handleChange}
                  className={inputClass}
                >
                  {SERVICE_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="urgency" className={labelClass}>
                  Urgency
                </label>
                <select
                  id="urgency"
                  name="urgency"
                  value={form.urgency}
                  onChange={handleChange}
                  className={inputClass}
                >
                  {URGENCY_LEVELS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="issue_description" className={labelClass}>
                  Description
                </label>
                <textarea
                  id="issue_description"
                  name="issue_description"
                  rows={4}
                  value={form.issue_description}
                  onChange={handleChange}
                  placeholder="Describe the issue or work needed..."
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="preferred_time" className={labelClass}>
                  Preferred Time
                </label>
                <input
                  id="preferred_time"
                  name="preferred_time"
                  type="text"
                  value={form.preferred_time}
                  onChange={handleChange}
                  placeholder="e.g. Weekday mornings, ASAP, etc."
                  className={inputClass}
                />
              </div>
            </div>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Link href="/jobs">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" loading={saving} disabled={saving}>
              Create Job
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
