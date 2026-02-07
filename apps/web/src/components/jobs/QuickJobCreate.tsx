'use client';

import { useState } from 'react';
import { Plus, Sparkles, Loader2 } from 'lucide-react';

interface QuickJobCreateProps {
  onCreated?: () => void;
}

export function QuickJobCreate({ onCreated }: QuickJobCreateProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const [naturalInput, setNaturalInput] = useState('');
  const [form, setForm] = useState({
    customer_name: '',
    phone_number: '',
    address: '',
    city: '',
    service_category: 'repair',
    issue_description: '',
    urgency: 'medium',
  });

  async function handleAIParse() {
    if (!naturalInput.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Extract job details from this: "${naturalInput}". Return JSON with: customer_name, phone_number, address, city, service_category (repair/installation/maintenance/inspection), issue_description, urgency (low/medium/high/emergency). Only return valid JSON.`
        }),
      });
      const data = await res.json();
      try {
        const parsed = JSON.parse(data.response);
        setForm(prev => ({ ...prev, ...parsed }));
        setUseAI(false);
      } catch {
        // AI didn't return valid JSON
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setForm({
        customer_name: '',
        phone_number: '',
        address: '',
        city: '',
        service_category: 'repair',
        issue_description: '',
        urgency: 'medium',
      });
      setIsOpen(false);
      onCreated?.();
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
      >
        <Plus className="w-4 h-4" />
        New Job
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create New Job</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setUseAI(!useAI)}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm ${
                useAI ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              AI
            </button>
          </div>
        </div>

        {useAI ? (
          <div className="p-4 space-y-4">
            <textarea
              value={naturalInput}
              onChange={(e) => setNaturalInput(e.target.value)}
              placeholder="Describe the job naturally, e.g.: 'John Smith called about a broken spring at 123 Main St Chelmsford, phone 978-555-1234, urgent'"
              className="w-full p-3 border rounded-lg h-32 resize-none"
            />
            <button
              onClick={handleAIParse}
              disabled={isLoading}
              className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Parse with AI
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Customer Name *"
                value={form.customer_name}
                onChange={(e) => setForm(prev => ({ ...prev, customer_name: e.target.value }))}
                required
                className="px-3 py-2 border rounded-lg"
              />
              <input
                type="tel"
                placeholder="Phone *"
                value={form.phone_number}
                onChange={(e) => setForm(prev => ({ ...prev, phone_number: e.target.value }))}
                required
                className="px-3 py-2 border rounded-lg"
              />
            </div>
            <input
              type="text"
              placeholder="Address"
              value={form.address}
              onChange={(e) => setForm(prev => ({ ...prev, address: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="City"
                value={form.city}
                onChange={(e) => setForm(prev => ({ ...prev, city: e.target.value }))}
                className="px-3 py-2 border rounded-lg"
              />
              <select
                value={form.service_category}
                onChange={(e) => setForm(prev => ({ ...prev, service_category: e.target.value }))}
                className="px-3 py-2 border rounded-lg"
              >
                <option value="repair">Repair</option>
                <option value="installation">Installation</option>
                <option value="maintenance">Maintenance</option>
                <option value="inspection">Inspection</option>
              </select>
            </div>
            <textarea
              placeholder="Issue Description"
              value={form.issue_description}
              onChange={(e) => setForm(prev => ({ ...prev, issue_description: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg h-20 resize-none"
            />
            <select
              value={form.urgency}
              onChange={(e) => setForm(prev => ({ ...prev, urgency: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
              <option value="emergency">Emergency</option>
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex-1 py-2 border rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Job'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
