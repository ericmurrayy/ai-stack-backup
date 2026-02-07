// Murray's FSM - Marketing Automation
// ====================================
// Campaigns, sequences, and referral program - GoHighLevel style

import { createAdminClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCents, formatRelativeTime } from '@/lib/utils';
import {
  Send,
  Users,
  TrendingUp,
  Gift,
} from 'lucide-react';
import {
  NewCampaignButton,
  ProgramSettingsButton,
  InteractiveCampaignCard,
  AutomationTemplatesGrid,
} from './MarketingActions';

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
  const supabase = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { campaigns: [], referrals: [] };
  }

  let campaigns: Campaign[] = [];
  let referrals: Referral[] = [];

  // Try to fetch campaigns
  try {
    const { data } = await supabase
      .from('marketing_campaigns')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });
    if (data) campaigns = data;
  } catch (e) {
    // Table may not exist
  }

  // Try to fetch referrals
  try {
    const { data } = await supabase
      .from('referrals')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });
    if (data) referrals = data;
  } catch (e) {
    // Table may not exist
  }

  return { campaigns, referrals };
}

const referralStatusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  contacted: 'bg-blue-100 text-blue-800',
  converted: 'bg-green-100 text-green-800',
  expired: 'bg-red-100 text-red-800',
};

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
            <NewCampaignButton />
          </div>
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <InteractiveCampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        </div>

        {/* Automation Templates */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Automation Templates</h2>
          <AutomationTemplatesGrid />
        </div>

        {/* Referral Program */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Referral Program</h2>
            <ProgramSettingsButton />
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
