// Murray's FSM - Automations Page
// =================================
// Configure and monitor automated workflows powered by n8n

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatRelativeTime } from '@/lib/utils';
import {
  Bot,
  Zap,
  Play,
  Pause,
  Clock,
  CheckCircle,
  AlertTriangle,
  Settings,
  ArrowRight,
  Mail,
  MessageSquare,
  Star,
  Calendar,
  Bell,
  FileText,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

// ---------- Types ----------

interface Automation {
  id: string;
  name: string;
  description: string;
  trigger: string;
  actions: string[];
  isActive: boolean;
  category: string;
  icon: typeof Mail;
  lastRun: string | null;
  runCount: number;
}

// ---------- Built-in Automations Config ----------

const AUTOMATIONS: Automation[] = [
  {
    id: 'auto-review-request',
    name: 'Auto Review Request',
    description: 'Send a review request via SMS 2 hours after a job is completed',
    trigger: 'Job status → Completed',
    actions: ['Wait 2 hours', 'Send SMS with Google review link'],
    isActive: true,
    category: 'reputation',
    icon: Star,
    lastRun: new Date(Date.now() - 3600000 * 3).toISOString(),
    runCount: 47,
  },
  {
    id: 'auto-estimate-followup',
    name: 'Estimate Follow-Up',
    description: 'Automatically follow up on sent estimates after 48 hours',
    trigger: 'Estimate sent + 48h no response',
    actions: ['Send follow-up email', 'Create follow-up task'],
    isActive: true,
    category: 'sales',
    icon: FileText,
    lastRun: new Date(Date.now() - 3600000 * 12).toISOString(),
    runCount: 23,
  },
  {
    id: 'auto-appointment-reminder',
    name: 'Appointment Reminder',
    description: 'Send reminder SMS 24 hours and 1 hour before scheduled appointment',
    trigger: 'Job scheduled_start - 24h, - 1h',
    actions: ['Send SMS reminder at 24h', 'Send SMS reminder at 1h'],
    isActive: true,
    category: 'scheduling',
    icon: Calendar,
    lastRun: new Date(Date.now() - 3600000 * 1).toISOString(),
    runCount: 156,
  },
  {
    id: 'auto-new-lead-alert',
    name: 'New Lead Alert',
    description: 'Notify the team instantly when a new lead comes in from any source',
    trigger: 'New job or lead created',
    actions: ['Push notification', 'SMS to owner', 'Slack alert'],
    isActive: true,
    category: 'notifications',
    icon: Bell,
    lastRun: new Date(Date.now() - 3600000 * 0.5).toISOString(),
    runCount: 89,
  },
  {
    id: 'auto-overdue-invoice',
    name: 'Overdue Invoice Reminder',
    description: 'Send payment reminder when an invoice is past due',
    trigger: 'Estimate valid_until < today + status = sent',
    actions: ['Send email reminder', 'Create follow-up notification'],
    isActive: false,
    category: 'billing',
    icon: Clock,
    lastRun: null,
    runCount: 0,
  },
  {
    id: 'auto-maintenance-reminder',
    name: 'Maintenance Reminder',
    description: 'Remind customers about upcoming recurring service appointments',
    trigger: 'Recurring job next_occurrence_at - 7 days',
    actions: ['Send email reminder', 'Send SMS reminder'],
    isActive: false,
    category: 'retention',
    icon: RefreshCw,
    lastRun: null,
    runCount: 0,
  },
  {
    id: 'auto-welcome-email',
    name: 'New Customer Welcome',
    description: 'Send a welcome email to new customers with company info and booking link',
    trigger: 'New customer created',
    actions: ['Send welcome email', 'Add to email list'],
    isActive: true,
    category: 'onboarding',
    icon: Mail,
    lastRun: new Date(Date.now() - 3600000 * 24).toISOString(),
    runCount: 34,
  },
  {
    id: 'auto-emergency-dispatch',
    name: 'Emergency Auto-Dispatch',
    description: 'Immediately alert all available technicians when an emergency job is created',
    trigger: 'Job created with urgency = emergency',
    actions: ['SMS all active technicians', 'Push notification', 'Create dispatch alert'],
    isActive: true,
    category: 'dispatch',
    icon: Zap,
    lastRun: new Date(Date.now() - 3600000 * 48).toISOString(),
    runCount: 5,
  },
];

const categoryColors: Record<string, string> = {
  reputation: 'bg-yellow-100 text-yellow-800',
  sales: 'bg-blue-100 text-blue-800',
  scheduling: 'bg-purple-100 text-purple-800',
  notifications: 'bg-red-100 text-red-800',
  billing: 'bg-green-100 text-green-800',
  retention: 'bg-indigo-100 text-indigo-800',
  onboarding: 'bg-pink-100 text-pink-800',
  dispatch: 'bg-orange-100 text-orange-800',
};

// ---------- Data Fetcher ----------

async function getAutomationStats() {
  const supabase = createClient();

  // Check action_queue for recent automation activity
  const { data: recentActions, count } = await supabase
    .from('action_queue')
    .select('id, action_type, status, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(10);

  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const { count: todayCount } = await supabase
    .from('action_queue')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', dayStart.toISOString());

  return {
    totalActions: count || 0,
    todayActions: todayCount || 0,
    recentActions: recentActions || [],
    activeAutomations: AUTOMATIONS.filter(a => a.isActive).length,
    totalAutomations: AUTOMATIONS.length,
  };
}

// ---------- Page ----------

export default async function AutomationsPage() {
  const stats = await getAutomationStats();

  return (
    <div>
      <Header title="Automations" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Bot className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">
                  {stats.activeAutomations}/{stats.totalAutomations}
                </div>
                <div className="text-sm text-slate-500">Active Automations</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <Zap className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{stats.todayActions}</div>
                <div className="text-sm text-slate-500">Actions Today</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50">
                <CheckCircle className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{stats.totalActions}</div>
                <div className="text-sm text-slate-500">Total Actions Run</div>
              </div>
            </div>
          </Card>
          <Card className="p-4 border-blue-200 bg-blue-50/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Settings className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-sm font-semibold text-blue-900">Powered by n8n</div>
                <div className="text-xs text-blue-700">Workflow automation engine</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Automations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {AUTOMATIONS.map((automation) => {
            const IconComponent = automation.icon;
            return (
              <Card key={automation.id} padding="none" className={`overflow-hidden ${!automation.isActive ? 'opacity-60' : ''}`}>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${automation.isActive ? 'bg-blue-50' : 'bg-slate-100'}`}>
                        <IconComponent className={`w-5 h-5 ${automation.isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{automation.name}</h3>
                        <Badge className={`${categoryColors[automation.category]} text-xs mt-1`}>
                          {automation.category}
                        </Badge>
                      </div>
                    </div>
                    <button className="flex items-center gap-1" title={automation.isActive ? 'Active' : 'Inactive'}>
                      {automation.isActive ? (
                        <ToggleRight className="w-8 h-8 text-green-500" />
                      ) : (
                        <ToggleLeft className="w-8 h-8 text-slate-300" />
                      )}
                    </button>
                  </div>

                  <p className="text-sm text-slate-600 mb-3">{automation.description}</p>

                  {/* Trigger & Actions */}
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-md font-medium">TRIGGER</span>
                      <span className="text-slate-600">{automation.trigger}</span>
                    </div>
                    {automation.actions.map((action, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md font-medium">ACTION</span>
                        <span className="text-slate-600">{action}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Stats */}
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {automation.lastRun ? `Last run ${formatRelativeTime(automation.lastRun)}` : 'Never run'}
                  </span>
                  <span className="font-medium">{automation.runCount} executions</span>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
