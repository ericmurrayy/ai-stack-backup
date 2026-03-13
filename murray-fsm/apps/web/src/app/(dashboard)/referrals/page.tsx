// Murray's FSM - Referral Program Page
// ======================================
// Track customer referrals and rewards

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCents, formatRelativeTime } from '@/lib/utils';
import {
  Gift,
  Users,
  TrendingUp,
  DollarSign,
  UserPlus,
  CheckCircle,
  Clock,
  XCircle,
  Plus,
} from 'lucide-react';
import Link from 'next/link';

// ---------- Types ----------

interface Referral {
  id: string;
  referrer_customer_id: string;
  referred_customer_id: string | null;
  referred_name: string | null;
  referred_phone: string | null;
  referred_email: string | null;
  status: string;
  referrer_reward_cents: number;
  referred_reward_cents: number;
  notes: string | null;
  converted_job_id: string | null;
  created_at: string;
  referrer: { name: string } | null;
}

// ---------- Config ----------

const statusConfig: Record<string, { color: string; label: string; icon: typeof Clock }> = {
  pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending', icon: Clock },
  contacted: { color: 'bg-blue-100 text-blue-800', label: 'Contacted', icon: Users },
  converted: { color: 'bg-green-100 text-green-800', label: 'Converted', icon: CheckCircle },
  expired: { color: 'bg-red-100 text-red-800', label: 'Expired', icon: XCircle },
};

// ---------- Data Fetcher ----------

async function getReferralData() {
  const supabase = await createClient();

  const { data } = await supabase
    .from('referrals')
    .select(`
      id, referrer_customer_id, referred_customer_id,
      referred_name, referred_phone, referred_email,
      status, referrer_reward_cents, referred_reward_cents,
      notes, converted_job_id, created_at,
      referrer:customers!referrals_referrer_customer_id_fkey(name)
    `)
    .eq('deleted', false)
    .order('created_at', { ascending: false });

  const referrals: Referral[] = (data || []).map((r: any) => ({
    ...r,
    referrer: Array.isArray(r.referrer) ? r.referrer[0] ?? null : r.referrer ?? null,
  }));

  const stats = {
    total: referrals.length,
    pending: referrals.filter(r => r.status === 'pending').length,
    converted: referrals.filter(r => r.status === 'converted').length,
    conversionRate: referrals.length > 0
      ? Math.round((referrals.filter(r => r.status === 'converted').length / referrals.length) * 100)
      : 0,
    totalRewardsOwed: referrals
      .filter(r => r.status === 'converted')
      .reduce((sum, r) => sum + (r.referrer_reward_cents ?? 0), 0),
  };

  return { referrals, stats };
}

// ---------- Page ----------

export default async function ReferralsPage() {
  const { referrals, stats } = await getReferralData();

  return (
    <div>
      <Header title="Referral Program" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Gift className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
                <div className="text-sm text-slate-500">Total Referrals</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-50">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
                <div className="text-sm text-slate-500">Pending</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{stats.converted}</div>
                <div className="text-sm text-slate-500">Converted</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">{stats.conversionRate}%</div>
                <div className="text-sm text-slate-500">Conversion Rate</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{formatCents(stats.totalRewardsOwed)}</div>
                <div className="text-sm text-slate-500">Rewards Earned</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
              All ({stats.total})
            </button>
            <button className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg">
              Pending ({stats.pending})
            </button>
            <button className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg">
              Converted ({stats.converted})
            </button>
          </div>
          <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Referral
          </button>
        </div>

        {/* Referrals Table */}
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
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                  Reward
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {referrals.map((referral) => {
                const config = statusConfig[referral.status] || statusConfig.pending;
                return (
                  <tr key={referral.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-slate-400" />
                        <span className="font-medium text-slate-900">
                          {referral.referrer?.name ?? 'Unknown'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-900">{referral.referred_name ?? 'Unknown'}</div>
                      {referral.referred_phone && (
                        <div className="text-sm text-slate-500">{referral.referred_phone}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge className={config.color}>{config.label}</Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-medium text-green-600">
                        {formatCents(referral.referrer_reward_cents ?? 0)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {formatRelativeTime(referral.created_at)}
                    </td>
                  </tr>
                );
              })}
              {referrals.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Gift className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <div className="text-slate-500 font-medium">No referrals yet</div>
                    <div className="text-sm text-slate-400 mt-1">
                      Start your referral program to grow through word-of-mouth
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
