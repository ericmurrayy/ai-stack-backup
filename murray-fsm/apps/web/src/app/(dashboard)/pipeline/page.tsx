// Murray's FSM - Pipeline/Kanban View
// ====================================
// Visual lead management - GoHighLevel-style pipeline

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCents, formatRelativeTime } from '@/lib/utils';
import {
  Plus,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  User,
  MoreVertical,
  ArrowRight,
  TrendingUp,
  Clock,
} from 'lucide-react';

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_won: boolean;
  is_lost: boolean;
}

interface Lead {
  id: string;
  title: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  estimated_value_cents: number;
  probability: number;
  score: number;
  source?: string;
  next_follow_up_at?: string;
  last_contact_at?: string;
  created_at: string;
  tags: string[];
}

interface StageWithLeads extends PipelineStage {
  leads: Lead[];
  total_value: number;
  lead_count: number;
}

async function getPipelineData(): Promise<StageWithLeads[]> {
  const supabase = createClient();

  // Get pipeline stages
  const { data: stages } = await supabase
    .from('pipeline_stages')
    .select('*')
    .eq('deleted', false)
    .order('sort_order');

  // Get leads with customer info
  const { data: leads } = await supabase
    .from('leads')
    .select(`
      *,
      customer:customers(name, phone, email)
    `)
    .eq('deleted', false)
    .order('score', { ascending: false });

  // If no stages exist, return defaults
  const defaultStages: PipelineStage[] = stages?.length ? stages : [
    { id: '1', name: 'New Lead', color: '#6366f1', sort_order: 0, is_won: false, is_lost: false },
    { id: '2', name: 'Contacted', color: '#8b5cf6', sort_order: 1, is_won: false, is_lost: false },
    { id: '3', name: 'Quote Sent', color: '#3b82f6', sort_order: 2, is_won: false, is_lost: false },
    { id: '4', name: 'Negotiating', color: '#f59e0b', sort_order: 3, is_won: false, is_lost: false },
    { id: '5', name: 'Won', color: '#22c55e', sort_order: 4, is_won: true, is_lost: false },
    { id: '6', name: 'Lost', color: '#ef4444', sort_order: 5, is_won: false, is_lost: true },
  ];

  // Group leads by stage
  return defaultStages.map((stage) => {
    const stageLeads = (leads || [])
      .filter((l) => l.stage_id === stage.id)
      .map((l) => ({
        id: l.id,
        title: l.title,
        customer_name: l.customer?.name,
        customer_phone: l.customer?.phone,
        customer_email: l.customer?.email,
        estimated_value_cents: l.estimated_value_cents || 0,
        probability: l.probability || 50,
        score: l.score || 0,
        source: l.source,
        next_follow_up_at: l.next_follow_up_at,
        last_contact_at: l.last_contact_at,
        created_at: l.created_at,
        tags: l.tags || [],
      }));

    return {
      ...stage,
      leads: stageLeads,
      total_value: stageLeads.reduce((sum, l) => sum + l.estimated_value_cents, 0),
      lead_count: stageLeads.length,
    };
  });
}

function LeadCard({ lead }: { lead: Lead }) {
  const scoreColor =
    lead.score >= 80 ? 'text-green-600 bg-green-50' :
    lead.score >= 50 ? 'text-yellow-600 bg-yellow-50' :
    'text-gray-600 bg-gray-50';

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-slate-900 text-sm truncate flex-1">
          {lead.title}
        </h4>
        <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-100 rounded">
          <MoreVertical className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {lead.customer_name && (
        <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-2">
          <User className="w-3.5 h-3.5" />
          <span className="truncate">{lead.customer_name}</span>
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-900">
          {formatCents(lead.estimated_value_cents)}
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${scoreColor}`}>
          Score: {lead.score}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500">
        {lead.next_follow_up_at && (
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{formatRelativeTime(lead.next_follow_up_at)}</span>
          </div>
        )}
        {lead.probability && (
          <div className="flex items-center gap-1 ml-auto">
            <TrendingUp className="w-3 h-3" />
            <span>{lead.probability}%</span>
          </div>
        )}
      </div>

      {lead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {lead.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded"
            >
              {tag}
            </span>
          ))}
          {lead.tags.length > 2 && (
            <span className="text-xs text-slate-400">+{lead.tags.length - 2}</span>
          )}
        </div>
      )}

      <div className="flex items-center gap-1 mt-3 pt-2 border-t border-slate-100">
        <button className="p-1.5 hover:bg-slate-100 rounded transition-colors" title="Call">
          <Phone className="w-3.5 h-3.5 text-slate-500" />
        </button>
        <button className="p-1.5 hover:bg-slate-100 rounded transition-colors" title="Email">
          <Mail className="w-3.5 h-3.5 text-slate-500" />
        </button>
        <button className="p-1.5 hover:bg-slate-100 rounded transition-colors" title="Schedule">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
        </button>
        <button className="ml-auto p-1.5 hover:bg-blue-50 rounded transition-colors text-blue-600" title="Move to next stage">
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function PipelineColumn({ stage }: { stage: StageWithLeads }) {
  return (
    <div className="flex-shrink-0 w-72">
      <div
        className="rounded-t-lg px-3 py-2 flex items-center justify-between"
        style={{ backgroundColor: `${stage.color}15` }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="font-semibold text-slate-900 text-sm">{stage.name}</h3>
          <span className="text-xs bg-white text-slate-600 px-2 py-0.5 rounded-full font-medium">
            {stage.lead_count}
          </span>
        </div>
        <button className="p-1 hover:bg-white rounded transition-colors">
          <Plus className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      <div className="text-xs text-slate-600 px-3 py-1.5 bg-slate-50 border-b border-slate-200">
        <DollarSign className="w-3 h-3 inline mr-1" />
        {formatCents(stage.total_value)} total
      </div>

      <div className="bg-slate-100 rounded-b-lg p-2 min-h-[500px] space-y-2">
        {stage.leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}

        {stage.leads.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-sm">
            No leads in this stage
          </div>
        )}

        <button className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-white rounded-lg transition-colors flex items-center justify-center gap-1">
          <Plus className="w-4 h-4" />
          Add Lead
        </button>
      </div>
    </div>
  );
}

export default async function PipelinePage() {
  const stages = await getPipelineData();

  const totalLeads = stages.reduce((sum, s) => sum + s.lead_count, 0);
  const totalValue = stages.reduce((sum, s) => sum + s.total_value, 0);
  const wonValue = stages
    .filter((s) => s.is_won)
    .reduce((sum, s) => sum + s.total_value, 0);

  return (
    <div className="h-full flex flex-col">
      <Header title="Sales Pipeline" />

      {/* Pipeline Stats */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-8">
          <div>
            <div className="text-2xl font-bold text-slate-900">{totalLeads}</div>
            <div className="text-sm text-slate-500">Active Leads</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{formatCents(totalValue)}</div>
            <div className="text-sm text-slate-500">Pipeline Value</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{formatCents(wonValue)}</div>
            <div className="text-sm text-slate-500">Won This Month</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
              Filter
            </button>
            <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New Lead
            </button>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 h-full">
          {stages.map((stage) => (
            <PipelineColumn key={stage.id} stage={stage} />
          ))}
        </div>
      </div>
    </div>
  );
}
