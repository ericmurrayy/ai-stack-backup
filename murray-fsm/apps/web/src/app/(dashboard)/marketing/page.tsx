// Murray's FSM - Marketing Automation
// ====================================
// Campaigns, sequences, and referral program - GoHighLevel style

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCents, formatRelativeTime } from '@/lib/utils';
import {
  Mail,
  MessageSquare,
  Send,
  Users,
  TrendingUp,
  Gift,
  Plus,
  Play,
  Pause,
  MoreVertical,
  Eye,
  MousePointer,
  CheckCircle,
  Calendar,
  Zap,
  Target,
} from 'lucide-react';

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

interface Referral {
  id: string;
  referrer_name: string;
  referred_name: string;
  status: 'pending' | 'contacted' | 'converted' | 'expired';
  referrer_reward_cents: number;
  created_at: string;
}

async function getMarketingData() {
  const supabase = createClient();

  const { data: campaignRows } = await supabase
    .from('marketing_campaigns')
    .select('id, name, status, campaign_type, total_recipients, total_sent, total_opened, total_clicked, total_converted, scheduled_at, created_at')
    .eq('deleted', false)
    .order('created_at', { ascending: false })
    .limit(20);

  const campaigns: Campaign[] = (campaignRows || []).map(c => ({
    ...c,
    status: c.status as Campaign['status'],
    campaign_type: c.campaign_type as Campaign['campaign_type'],
  }));

  const { data: referralRows } = await supabase
    .from('referrals')
    .select('id, referrer:referrer_customer_id(name), referred_name, status, referrer_reward_cents, created_at')
    .eq('deleted', false)
    .order('created_at', { ascending: false })
    .limit(20);

  const referrals: Referral[] = (referralRows || []).map(r => ({
    id: r.id,
    referrer_name: (r.referrer as any)?.name || 'Unknown',
    referred_name: r.referred_name || 'Unknown',
    status: r.status as Referral['status'],
    referrer_reward_cents: r.referrer_reward_cents || 0,
    created_at: r.created_at,
  }));

  return { campaigns, referrals };
}

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-800',
  scheduled: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-purple-100 text-purple-800',
};

const referralStatusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  contacted: 'bg-blue-100 text-blue-800',
  converted: 'bg-green-100 text-green-800',
  expired: 'bg-red-100 text-red-800',
};

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const openRate = campaign.total_sent > 0
    ? Math.round((campaign.total_opened / campaign.total_sent) * 100)
    : 0;
  const clickRate = campaign.total_opened > 0
    ? Math.round((campaign.total_clicked / campaign.total_opened) * 100)
    : 0;
  const conversionRate = campaign.total_clicked > 0
    ? Math.round((campaign.total_converted / campaign.total_clicked) * 100)
    : 0;

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
            <button className="p-2 hover:bg-slate-100 rounded-lg" title="Pause">
              <Pause className="w-4 h-4 text-slate-500" />
            </button>
          )}
          {campaign.status === 'paused' && (
            <button className="p-2 hover:bg-slate-100 rounded-lg" title="Resume">
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

export default async function MarketingPage() {
  const { campaigns, referrals } = await getMarketingData();

  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const totalSent = campaigns.reduce((sum, c) => sum + c.total_sent, 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + c.total_converted, 0);
  const pendingReferrals = referrals.filter(r => r.status === 'pending').length;

  return (
    <div>
      <Header title="Marketing & Automation" />

      <div className="p-6 space-y-6">
        {/* Marketing Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Send className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{activeCampaigns}</div>
                <div className="text-sm text-slate-500">Active Campaigns</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{totalSent}</div>
                <div className="text-sm text-slate-500">Messages Sent</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{totalConversions}</div>
                <div className="text-sm text-slate-500">Conversions</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-50">
                <Gift className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{pendingReferrals}</div>
                <div className="text-sm text-slate-500">Pending Referrals</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Campaigns Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Campaigns</h2>
            <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New Campaign
            </button>
          </div>
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        </div>

        {/* Automation Templates */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Automation Templates</h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { name: 'Welcome Sequence', desc: '3-email welcome series for new customers', icon: Mail },
              { name: 'Review Request', desc: 'Auto-send review request after job completion', icon: Target },
              { name: 'Appointment Reminder', desc: 'SMS reminder 24h before appointment', icon: Calendar },
              { name: 'Re-engagement', desc: 'Win back customers inactive for 90+ days', icon: Users },
              { name: 'Referral Follow-up', desc: 'Nurture new referral leads', icon: Gift },
              { name: 'Post-Service Survey', desc: 'Collect feedback after service', icon: CheckCircle },
            ].map((template) => (
              <Card
                key={template.name}
                className="p-4 hover:border-blue-300 cursor-pointer transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <template.icon className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-900">{template.name}</h3>
                    <p className="text-sm text-slate-500 mt-1">{template.desc}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Referral Program */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Referral Program</h2>
            <button className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
              Program Settings
            </button>
          </div>
          <Card padding="none">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                    Referrer
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                    Referred
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                    Status
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                    Reward
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {referrals.map((referral) => (
                  <tr key={referral.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {referral.referrer_name}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {referral.referred_name}
                    </td>
                    <td className="px-6 py-4">
                      <Badge className={referralStatusColors[referral.status]}>
                        {referral.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-slate-900">
                      {formatCents(referral.referrer_reward_cents)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {formatRelativeTime(referral.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </div>
  );
}
