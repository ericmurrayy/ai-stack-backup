// Murray's FSM - Lead Detail Page
// =================================
// Full lead view with activity, notes, and conversion actions

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatCents, formatRelativeTime, formatDate } from '@/lib/utils';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  DollarSign,
  Calendar,
  MessageSquare,
  FileText,
  Briefcase,
  Tag,
  Edit,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  MapPin,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

// ---------- Data Fetcher ----------

async function getLeadDetail(leadId: string) {
  const supabase = await createClient();

  const { data: lead, error } = await supabase
    .from('leads')
    .select(`
      id, name, email, phone, source, notes,
      estimated_value_cents, probability,
      created_at, updated_at,
      stage:pipeline_stages(id, name, color, is_won, is_lost),
      customer:customers(id, name, phone, email)
    `)
    .eq('id', leadId)
    .eq('deleted', false)
    .single();

  if (error || !lead) return null;

  // Get all pipeline stages for the progress bar
  const { data: stages } = await supabase
    .from('pipeline_stages')
    .select('id, name, color, sort_order, is_won, is_lost')
    .eq('deleted', false)
    .order('sort_order');

  // Get interactions for this lead's customer
  const customerId = Array.isArray(lead.customer) ? lead.customer[0]?.id : (lead.customer as any)?.id;
  let communications: any[] = [];
  if (customerId) {
    const { data: msgs } = await supabase
      .from('message_logs')
      .select('id, direction, body, channel, created_at')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: calls } = await supabase
      .from('call_logs')
      .select('id, direction, duration_seconds, notes, created_at')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(5);

    communications = [
      ...(msgs || []).map((m: any) => ({ ...m, type: 'message' })),
      ...(calls || []).map((c: any) => ({ ...c, type: 'call' })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  // Normalize
  const normalized = {
    ...lead,
    stage: Array.isArray(lead.stage) ? lead.stage[0] : lead.stage,
    customer: Array.isArray(lead.customer) ? lead.customer[0] : lead.customer,
  };

  return {
    lead: normalized,
    stages: stages || [],
    communications,
  };
}

// ---------- Page ----------

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const data = await getLeadDetail((await params).id);

  if (!data) {
    notFound();
  }

  const { lead, stages, communications } = data;
  const currentStageIndex = stages.findIndex((s: any) => s.id === lead.stage?.id);
  const weightedValue = Math.round(((lead.estimated_value_cents || 0) * (lead.probability || 0)) / 100);

  return (
    <div>
      <Header title={`Lead: ${lead.name}`} />

      <div className="p-6 space-y-6 max-w-5xl">
        {/* Back + Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/pipeline" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-500" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-slate-900">{lead.name}</h1>
                {lead.stage && (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-white text-xs font-medium"
                    style={{ backgroundColor: lead.stage.color }}
                  >
                    {lead.stage.name}
                  </span>
                )}
                {lead.source && (
                  <Badge className="bg-slate-100 text-slate-700 text-xs capitalize">{lead.source}</Badge>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Created {formatRelativeTime(lead.created_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Edit className="w-4 h-4" />
              Edit
            </Button>
            <Link href="/estimates/new">
              <Button size="sm">
                <FileText className="w-4 h-4" />
                Create Estimate
              </Button>
            </Link>
          </div>
        </div>

        {/* Pipeline Progress */}
        <Card padding="none" className="p-5">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Pipeline Progress</h3>
          <div className="flex items-center gap-2">
            {stages.map((stage: any, i: number) => {
              const isPast = i < currentStageIndex;
              const isCurrent = i === currentStageIndex;
              const isFuture = i > currentStageIndex;
              return (
                <div key={stage.id} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-full h-2 rounded-full ${
                        isPast || isCurrent ? '' : 'bg-slate-200'
                      }`}
                      style={isPast || isCurrent ? { backgroundColor: stage.color } : {}}
                    />
                    <span className={`text-xs mt-2 ${isCurrent ? 'font-semibold text-slate-900' : 'text-slate-400'}`}>
                      {stage.name}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main */}
          <div className="lg:col-span-2 space-y-6">
            {/* Value & Probability */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="p-4">
                <div className="text-sm text-slate-500">Estimated Value</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">
                  {formatCents(lead.estimated_value_cents || 0)}
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-sm text-slate-500">Probability</div>
                <div className="text-2xl font-bold text-blue-600 mt-1">{lead.probability || 0}%</div>
                <div className="w-full bg-slate-100 rounded-full h-2 mt-2">
                  <div
                    className="h-2 rounded-full bg-blue-500"
                    style={{ width: `${lead.probability || 0}%` }}
                  />
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-sm text-slate-500">Weighted Value</div>
                <div className="text-2xl font-bold text-green-600 mt-1">
                  {formatCents(weightedValue)}
                </div>
              </Card>
            </div>

            {/* Notes */}
            {lead.notes && (
              <Card padding="none" className="p-5">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Notes</h3>
                <p className="text-slate-700 whitespace-pre-wrap">{lead.notes}</p>
              </Card>
            )}

            {/* Communication History */}
            {communications.length > 0 && (
              <Card padding="none" className="p-5">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Activity</h3>
                <div className="space-y-3">
                  {communications.map((comm: any) => (
                    <div key={comm.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                      <div className={`p-1.5 rounded-lg ${comm.type === 'call' ? 'bg-green-100' : 'bg-blue-100'}`}>
                        {comm.type === 'call' ? (
                          <Phone className="w-4 h-4 text-green-600" />
                        ) : (
                          <MessageSquare className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-slate-900 capitalize">{comm.direction}</span>
                          <span className="text-slate-400">{comm.type}</span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-400">{formatRelativeTime(comm.created_at)}</span>
                        </div>
                        {comm.body && (
                          <p className="text-sm text-slate-600 mt-1 line-clamp-2">{comm.body}</p>
                        )}
                        {comm.notes && (
                          <p className="text-sm text-slate-600 mt-1">{comm.notes}</p>
                        )}
                        {comm.duration_seconds != null && (
                          <span className="text-xs text-slate-400">
                            {Math.floor(comm.duration_seconds / 60)}m {comm.duration_seconds % 60}s
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Info */}
            <Card padding="none" className="p-5">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Contact</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="font-medium text-slate-900">{lead.name}</div>
                </div>
                {lead.phone && (
                  <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-sm text-slate-700 hover:text-blue-600">
                    <Phone className="w-4 h-4 text-slate-400" />
                    {lead.phone}
                  </a>
                )}
                {lead.email && (
                  <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-sm text-slate-700 hover:text-blue-600">
                    <Mail className="w-4 h-4 text-slate-400" />
                    {lead.email}
                  </a>
                )}
                {lead.customer && (
                  <Link href={`/customers/${lead.customer.id}`} className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                    <ExternalLink className="w-4 h-4" />
                    View Customer Profile
                  </Link>
                )}
              </div>
            </Card>

            {/* Quick Actions */}
            <Card padding="none" className="p-5">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Actions</h3>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Phone className="w-4 h-4" />
                  Log Call
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <MessageSquare className="w-4 h-4" />
                  Send Message
                </Button>
                <Link href="/estimates/new" className="block">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <FileText className="w-4 h-4" />
                    Create Estimate
                  </Button>
                </Link>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Briefcase className="w-4 h-4" />
                  Convert to Job
                </Button>
                <hr className="border-slate-200" />
                <Button variant="outline" size="sm" className="w-full justify-start text-green-600 border-green-200 hover:bg-green-50">
                  <CheckCircle className="w-4 h-4" />
                  Mark as Won
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50">
                  <AlertTriangle className="w-4 h-4" />
                  Mark as Lost
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
