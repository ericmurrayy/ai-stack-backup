'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mail,
  MessageSquare,
  Send,
  Plus,
  Play,
  Pause,
  MoreVertical,
  Eye,
  MousePointer,
  CheckCircle,
  X,
  Zap,
  Calendar,
  Users,
  Gift,
  Target,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed';
  campaign_type: 'email' | 'sms' | 'both';
  total_recipients: number;
  total_sent: number;
  total_opened: number;
  total_clicked: number;
  total_converted: number;
  scheduled_at?: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-800',
  scheduled: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-purple-100 text-purple-800',
};

// New Campaign Button with Modal
export function NewCampaignButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    campaign_type: 'email',
    subject: '',
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/marketing/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to create campaign');
      }

      setIsOpen(false);
      setFormData({
        name: '',
        campaign_type: 'email',
        subject: '',
        message: '',
      });
      window.location.reload();
    } catch (err) {
      console.error('Failed to create campaign:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2"
      >
        <Plus className="w-4 h-4" />
        New Campaign
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Create New Campaign</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Spring Maintenance Offer"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Campaign Type *
                </label>
                <select
                  required
                  value={formData.campaign_type}
                  onChange={(e) => setFormData({ ...formData, campaign_type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="email">Email Only</option>
                  <option value="sms">SMS Only</option>
                  <option value="both">Email + SMS</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Subject Line
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Don't miss our spring special!"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Message
                </label>
                <textarea
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Write your campaign message..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// Program Settings Button
export function ProgramSettingsButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState({
    referral_reward: '50',
    min_job_value: '100',
    expiry_days: '30',
  });

  const handleSave = async () => {
    try {
      await fetch('/api/marketing/referral-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referral_reward_cents: parseInt(settings.referral_reward) * 100,
          min_job_value_cents: parseInt(settings.min_job_value) * 100,
          expiry_days: parseInt(settings.expiry_days),
        }),
      });
      setIsOpen(false);
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
      >
        Program Settings
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Referral Program Settings</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Referral Reward Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                  <input
                    type="number"
                    value={settings.referral_reward}
                    onChange={(e) => setSettings({ ...settings, referral_reward: e.target.value })}
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Minimum Job Value for Eligibility
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                  <input
                    type="number"
                    value={settings.min_job_value}
                    onChange={(e) => setSettings({ ...settings, min_job_value: e.target.value })}
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Referral Expiry (days)
                </label>
                <input
                  type="number"
                  value={settings.expiry_days}
                  onChange={(e) => setSettings({ ...settings, expiry_days: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Interactive Campaign Card
export function InteractiveCampaignCard({ campaign }: { campaign: Campaign }) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);

  const openRate = campaign.total_sent > 0
    ? Math.round((campaign.total_opened / campaign.total_sent) * 100)
    : 0;
  const clickRate = campaign.total_opened > 0
    ? Math.round((campaign.total_clicked / campaign.total_opened) * 100)
    : 0;

  const toggleStatus = async () => {
    setIsUpdating(true);
    const newStatus = campaign.status === 'active' ? 'paused' : 'active';
    // In production, PATCH /api/marketing/campaigns/:id
    try {
      await fetch(`/api/marketing/campaigns/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      window.location.reload();
    } catch (err) {
      console.error('Failed to update campaign:', err);
    }
    setIsUpdating(false);
    router.refresh();
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            campaign.campaign_type === 'email' ? 'bg-blue-50' :
            campaign.campaign_type === 'sms' ? 'bg-green-50' :
            'bg-purple-50'
          }`}>
            {campaign.campaign_type === 'email' ? (
              <Mail className="w-5 h-5 text-blue-600" />
            ) : campaign.campaign_type === 'sms' ? (
              <MessageSquare className="w-5 h-5 text-green-600" />
            ) : (
              <Zap className="w-5 h-5 text-purple-600" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">{campaign.name}</h3>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Badge className={statusColors[campaign.status]}>{campaign.status}</Badge>
              <span>{campaign.total_recipients} recipients</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {campaign.status === 'active' && (
            <button
              onClick={toggleStatus}
              disabled={isUpdating}
              className="p-2 hover:bg-slate-100 rounded-lg disabled:opacity-50"
              title="Pause"
            >
              <Pause className="w-4 h-4 text-slate-500" />
            </button>
          )}
          {campaign.status === 'paused' && (
            <button
              onClick={toggleStatus}
              disabled={isUpdating}
              className="p-2 hover:bg-slate-100 rounded-lg disabled:opacity-50"
              title="Resume"
            >
              <Play className="w-4 h-4 text-slate-500" />
            </button>
          )}
          <button className="p-2 hover:bg-slate-100 rounded-lg">
            <MoreVertical className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Campaign Stats */}
      <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-slate-400" />
          <div>
            <div className="font-semibold text-slate-900">{campaign.total_sent}</div>
            <div className="text-xs text-slate-500">Sent</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-slate-400" />
          <div>
            <div className="font-semibold text-slate-900">{openRate}%</div>
            <div className="text-xs text-slate-500">Open Rate</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MousePointer className="w-4 h-4 text-slate-400" />
          <div>
            <div className="font-semibold text-slate-900">{clickRate}%</div>
            <div className="text-xs text-slate-500">Click Rate</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-slate-400" />
          <div>
            <div className="font-semibold text-green-600">{campaign.total_converted}</div>
            <div className="text-xs text-slate-500">Conversions</div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Automation Template Card - clickable (internal)
function AutomationTemplateCard({ template }: { template: { name: string; desc: string; iconType: string } }) {
  const [isOpen, setIsOpen] = useState(false);

  // Map icon types to actual icons
  const iconMap: Record<string, React.ElementType> = {
    mail: Mail,
    target: Target,
    calendar: Calendar,
    users: Users,
    gift: Gift,
    checkCircle: CheckCircle,
  };

  const Icon = iconMap[template.iconType] || Mail;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full text-left"
      >
        <Card
          className="p-4 hover:border-blue-300 cursor-pointer transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Icon className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h3 className="font-medium text-slate-900">{template.name}</h3>
              <p className="text-sm text-slate-500 mt-1">{template.desc}</p>
            </div>
          </div>
        </Card>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">{template.name}</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Icon className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{template.name}</h3>
                  <p className="text-sm text-slate-500">{template.desc}</p>
                </div>
              </div>

              <p className="text-slate-600 mb-6">
                This automation template will help you engage customers automatically.
                Click &ldquo;Use Template&rdquo; to create a new campaign based on this template.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // Start creating campaign from template
                    console.log('Creating campaign from template:', template.name);
                    setIsOpen(false);
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  Use Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Automation Templates Grid - all templates in one client component
export function AutomationTemplatesGrid() {
  const templates = [
    { name: 'Welcome Sequence', desc: '3-email welcome series for new customers', iconType: 'mail' },
    { name: 'Review Request', desc: 'Auto-send review request after job completion', iconType: 'target' },
    { name: 'Appointment Reminder', desc: 'SMS reminder 24h before appointment', iconType: 'calendar' },
    { name: 'Re-engagement', desc: 'Win back customers inactive for 90+ days', iconType: 'users' },
    { name: 'Referral Follow-up', desc: 'Nurture new referral leads', iconType: 'gift' },
    { name: 'Post-Service Survey', desc: 'Collect feedback after service', iconType: 'checkCircle' },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {templates.map((template) => (
        <AutomationTemplateCard key={template.name} template={template} />
      ))}
    </div>
  );
}
