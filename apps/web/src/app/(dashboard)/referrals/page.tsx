'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Users,
  Gift,
  DollarSign,
  TrendingUp,
  Send,
  Clock,
  CheckCircle,
  AlertTriangle,
  Search,
  Filter,
  Plus,
  Eye,
  X,
  Mail,
  Phone,
  Link,
  Copy,
  UserPlus,
  Award,
} from 'lucide-react';

interface Referral {
  id: string;
  referral_code: string;
  referrer_id: string;
  referrer_name?: string;
  referrer_email?: string;
  referee_name: string;
  referee_email?: string;
  referee_phone?: string;
  status: 'pending' | 'contacted' | 'booked' | 'completed' | 'rewarded' | 'expired';
  source?: string;
  first_job_id?: string;
  first_job_value?: number;
  jobs_count?: number;
  total_revenue?: number;
  referrer_reward_type?: string;
  referrer_reward_amount?: number;
  referrer_reward_issued?: boolean;
  referee_reward_type?: string;
  referee_reward_amount?: number;
  referee_reward_used?: boolean;
  created_at: string;
  contacted_at?: string;
  booked_at?: string;
  completed_at?: string;
  expires_at?: string;
}

interface Stats {
  totalReferrals: number;
  pending: number;
  converted: number;
  conversionRate: number;
  totalRewardsIssued: number;
  totalRevenueGenerated: number;
}

interface Program {
  name: string;
  description: string;
  referrer_reward_amount: number;
  referee_reward_amount: number;
  referral_expiry_days: number;
}

const statusConfig = {
  pending: { label: 'Pending', color: 'default', icon: Clock },
  contacted: { label: 'Contacted', color: 'info', icon: Phone },
  booked: { label: 'Booked', color: 'warning', icon: CheckCircle },
  completed: { label: 'Completed', color: 'success', icon: CheckCircle },
  rewarded: { label: 'Rewarded', color: 'success', icon: Award },
  expired: { label: 'Expired', color: 'error', icon: AlertTriangle },
} as const;

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [referralsRes, statsRes, programRes] = await Promise.all([
        fetch('/api/referrals'),
        fetch('/api/referrals?stats=true'),
        fetch('/api/referrals?program=true'),
      ]);

      if (referralsRes.ok) {
        const data = await referralsRes.json();
        setReferrals(data.referrals || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
      }

      if (programRes.ok) {
        const data = await programRes.json();
        setProgram(data.program);
      }
    } catch (error) {
      console.error('Failed to fetch referrals:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredReferrals = referrals.filter(referral => {
    const matchesFilter = filter === 'all' || referral.status === filter;
    const matchesSearch = !searchQuery ||
      referral.referrer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      referral.referee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      referral.referral_code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  async function handleStatusChange(referralId: string, newStatus: string) {
    try {
      await fetch('/api/referrals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: referralId, status: newStatus }),
      });
      fetchData();
    } catch (error) {
      console.error('Failed to update referral:', error);
    }
  }

  async function copyReferralCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  if (loading) {
    return (
      <div>
        <Header title="Referral Program" />
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="h-16 bg-gray-200 rounded" />
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Referral Program" />

      <div className="p-6 space-y-6">
        {/* Program Banner */}
        {program && (
          <Card className="p-6 bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold mb-1">{program.name}</h2>
                <p className="text-purple-100">{program.description}</p>
                <div className="flex items-center gap-6 mt-3">
                  <div className="flex items-center gap-2">
                    <Gift className="w-5 h-5" />
                    <span>Referrer gets {formatCurrency(program.referrer_reward_amount)} credit</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    <span>Friend gets {formatCurrency(program.referee_reward_amount)} off</span>
                  </div>
                </div>
              </div>
              <Button
                onClick={() => setShowNewModal(true)}
                className="bg-white text-purple-600 hover:bg-purple-50"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Referral
              </Button>
            </div>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Referrals</p>
                <p className="text-2xl font-bold text-slate-900">{stats?.totalReferrals || 0}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Conversion Rate</p>
                <p className="text-2xl font-bold text-green-600">{stats?.conversionRate || 0}%</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Gift className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Rewards Issued</p>
                <p className="text-2xl font-bold text-purple-600">
                  {formatCurrency(stats?.totalRewardsIssued || 0)}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Revenue Generated</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {formatCurrency(stats?.totalRevenueGenerated || 0)}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search referrals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="contacted">Contacted</option>
              <option value="booked">Booked</option>
              <option value="rewarded">Rewarded</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>

        {/* Referrals List */}
        <div className="space-y-4">
          {filteredReferrals.map((referral) => {
            const statusInfo = statusConfig[referral.status];

            return (
              <Card key={referral.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Referral Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-slate-900">
                        {referral.referee_name}
                      </h3>
                      <Badge variant={statusInfo.color as any}>
                        {statusInfo.label}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <UserPlus className="w-4 h-4" />
                        Referred by {referral.referrer_name || 'Unknown'}
                      </span>
                      <button
                        onClick={() => copyReferralCode(referral.referral_code)}
                        className="flex items-center gap-1 hover:text-blue-600"
                      >
                        <Link className="w-4 h-4" />
                        {referral.referral_code}
                        {copiedCode === referral.referral_code ? (
                          <CheckCircle className="w-3 h-3 text-green-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                      {referral.referee_email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          {referral.referee_email}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Revenue and Actions */}
                  <div className="flex items-center gap-4">
                    {referral.total_revenue ? (
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-900">
                          {formatCurrency(referral.total_revenue)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {referral.jobs_count} job{referral.jobs_count !== 1 ? 's' : ''}
                        </p>
                      </div>
                    ) : (
                      <div className="text-right">
                        <p className="text-sm text-slate-400">No revenue yet</p>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      {referral.status === 'pending' && (
                        <Button
                          variant="secondary"
                          onClick={() => handleStatusChange(referral.id, 'contacted')}
                        >
                          <Phone className="w-4 h-4 mr-1" />
                          Mark Contacted
                        </Button>
                      )}
                      {referral.status === 'completed' && !referral.referrer_reward_issued && (
                        <Button
                          onClick={() => handleStatusChange(referral.id, 'rewarded')}
                        >
                          <Gift className="w-4 h-4 mr-1" />
                          Issue Reward
                        </Button>
                      )}
                      <button
                        onClick={() => {
                          setSelectedReferral(referral);
                          setShowDetailModal(true);
                        }}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-6 text-xs text-slate-500">
                  <span>Created: {formatDate(referral.created_at)}</span>
                  {referral.contacted_at && <span>Contacted: {formatDate(referral.contacted_at)}</span>}
                  {referral.booked_at && <span>Booked: {formatDate(referral.booked_at)}</span>}
                  {referral.expires_at && referral.status === 'pending' && (
                    <span className="text-orange-500">
                      Expires: {formatDate(referral.expires_at)}
                    </span>
                  )}
                </div>
              </Card>
            );
          })}

          {filteredReferrals.length === 0 && (
            <Card className="p-8 text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Referrals Found</h3>
              <p className="text-slate-500 mb-4">
                {searchQuery || filter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Start growing your business through referrals'}
              </p>
              {!searchQuery && filter === 'all' && (
                <Button onClick={() => setShowNewModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Referral
                </Button>
              )}
            </Card>
          )}
        </div>

        {/* New Referral Modal */}
        {showNewModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-slate-900">Add New Referral</h2>
                  <button
                    onClick={() => setShowNewModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target as HTMLFormElement);

                    try {
                      const response = await fetch('/api/referrals', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          referrer_id: formData.get('referrer_id'),
                          referrer_name: formData.get('referrer_name'),
                          referrer_email: formData.get('referrer_email'),
                          referee_name: formData.get('referee_name'),
                          referee_email: formData.get('referee_email'),
                          referee_phone: formData.get('referee_phone'),
                          source: formData.get('source'),
                        }),
                      });

                      if (response.ok) {
                        setShowNewModal(false);
                        fetchData();
                      }
                    } catch (error) {
                      console.error('Failed to create referral:', error);
                    }
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Referrer Name *
                    </label>
                    <input
                      type="text"
                      name="referrer_name"
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      placeholder="Existing customer name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Referrer Email
                    </label>
                    <input
                      type="email"
                      name="referrer_email"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      placeholder="customer@example.com"
                    />
                  </div>

                  <input type="hidden" name="referrer_id" value={`cust-${Date.now()}`} />

                  <hr className="my-4" />

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Referee Name *
                    </label>
                    <input
                      type="text"
                      name="referee_name"
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      placeholder="New customer name"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Referee Email
                      </label>
                      <input
                        type="email"
                        name="referee_email"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        placeholder="new@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Referee Phone
                      </label>
                      <input
                        type="tel"
                        name="referee_phone"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        placeholder="+1 555 123 4567"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Source
                    </label>
                    <select
                      name="source"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    >
                      <option value="manual">Manual Entry</option>
                      <option value="email">Email</option>
                      <option value="sms">SMS</option>
                      <option value="in-person">In Person</option>
                      <option value="social">Social Media</option>
                    </select>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="secondary" onClick={() => setShowNewModal(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      Create Referral
                    </Button>
                  </div>
                </form>
              </div>
            </Card>
          </div>
        )}

        {/* Detail Modal */}
        {showDetailModal && selectedReferral && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{selectedReferral.referee_name}</h2>
                    <p className="text-sm text-slate-500">{selectedReferral.referral_code}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      setSelectedReferral(null);
                    }}
                    className="p-2 hover:bg-slate-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 uppercase">Status</p>
                      <Badge variant={statusConfig[selectedReferral.status].color as any}>
                        {statusConfig[selectedReferral.status].label}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase">Source</p>
                      <p className="font-medium capitalize">{selectedReferral.source || 'Manual'}</p>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-xs text-slate-500 uppercase mb-2">Referrer</p>
                    <p className="font-medium">{selectedReferral.referrer_name}</p>
                    {selectedReferral.referrer_email && (
                      <p className="text-sm text-slate-500">{selectedReferral.referrer_email}</p>
                    )}
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-xs text-slate-500 uppercase mb-2">Referee</p>
                    <p className="font-medium">{selectedReferral.referee_name}</p>
                    {selectedReferral.referee_email && (
                      <p className="text-sm text-slate-500">{selectedReferral.referee_email}</p>
                    )}
                    {selectedReferral.referee_phone && (
                      <p className="text-sm text-slate-500">{selectedReferral.referee_phone}</p>
                    )}
                  </div>

                  {(selectedReferral.total_revenue || selectedReferral.first_job_value) && (
                    <div className="border-t pt-4">
                      <p className="text-xs text-slate-500 uppercase mb-2">Revenue</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-2xl font-bold">
                            {formatCurrency(selectedReferral.total_revenue || 0)}
                          </p>
                          <p className="text-xs text-slate-500">Total Revenue</p>
                        </div>
                        <div>
                          <p className="text-xl font-medium">{selectedReferral.jobs_count || 0}</p>
                          <p className="text-xs text-slate-500">Jobs Completed</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="border-t pt-4">
                    <p className="text-xs text-slate-500 uppercase mb-2">Rewards</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className={`p-3 rounded-lg ${
                        selectedReferral.referrer_reward_issued ? 'bg-green-50' : 'bg-slate-50'
                      }`}>
                        <p className="text-sm font-medium">Referrer Reward</p>
                        <p className="text-lg font-bold">
                          {formatCurrency(selectedReferral.referrer_reward_amount || 0)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {selectedReferral.referrer_reward_issued ? 'Issued ✓' : 'Pending'}
                        </p>
                      </div>
                      <div className={`p-3 rounded-lg ${
                        selectedReferral.referee_reward_used ? 'bg-green-50' : 'bg-slate-50'
                      }`}>
                        <p className="text-sm font-medium">Referee Discount</p>
                        <p className="text-lg font-bold">
                          {formatCurrency(selectedReferral.referee_reward_amount || 0)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {selectedReferral.referee_reward_used ? 'Used ✓' : 'Available'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowDetailModal(false);
                      setSelectedReferral(null);
                    }}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
