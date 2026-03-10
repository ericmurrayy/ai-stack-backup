// Murray's FSM - Service Agreements Page
// ========================================

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatCents, formatRelativeTime, formatDate } from '@/lib/utils';
import {
  FileCheck,
  Shield,
  Wrench,
  Crown,
  Calendar,
  DollarSign,
  Plus,
  MoreVertical,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';

// ---------- Types ----------

type AgreementType = 'maintenance' | 'warranty' | 'membership';
type AgreementStatus = 'active' | 'expired' | 'cancelled';
type BillingCycle = 'monthly' | 'quarterly' | 'annual';

interface AgreementCustomer {
  name: string;
  email: string | null;
}

interface ServiceAgreement {
  id: string;
  owner_id: string;
  customer_id: string;
  location_id: string | null;
  name: string;
  description: string | null;
  type: AgreementType;
  status: AgreementStatus;
  start_date: string;
  end_date: string | null;
  recurring_job_id: string | null;
  price_cents: number;
  billing_cycle: BillingCycle;
  terms: string | null;
  created_at: string;
  updated_at: string;
  deleted: boolean;
  customer: AgreementCustomer | null;
}

// ---------- Config ----------

const statusColors: Record<AgreementStatus, string> = {
  active: 'bg-green-100 text-green-800',
  expired: 'bg-slate-100 text-slate-800',
  cancelled: 'bg-red-100 text-red-800',
};

const typeConfig: Record<AgreementType, { icon: typeof Wrench; color: string; label: string }> = {
  maintenance: { icon: Wrench, color: 'bg-blue-100 text-blue-800', label: 'Maintenance' },
  warranty: { icon: Shield, color: 'bg-purple-100 text-purple-800', label: 'Warranty' },
  membership: { icon: Crown, color: 'bg-yellow-100 text-yellow-800', label: 'Membership' },
};

const billingLabels: Record<BillingCycle, string> = {
  monthly: '/mo',
  quarterly: '/qtr',
  annual: '/yr',
};

// ---------- Helpers ----------

function getDaysUntilExpiry(endDate: string | null): number | null {
  if (!endDate) return null;
  const end = new Date(endDate);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function computeMrrCents(priceCents: number, cycle: BillingCycle): number {
  switch (cycle) {
    case 'monthly':
      return priceCents;
    case 'quarterly':
      return Math.round(priceCents / 3);
    case 'annual':
      return Math.round(priceCents / 12);
    default:
      return priceCents;
  }
}

// ---------- Data fetcher ----------

interface AgreementsData {
  agreements: ServiceAgreement[];
  stats: {
    total: number;
    active: number;
    expiringSoon: number;
    mrrCents: number;
  };
}

async function getAgreementsData(): Promise<AgreementsData> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('service_agreements')
    .select(`
      *,
      customer:customers(name, email)
    `)
    .eq('deleted', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching agreements:', error);
    return {
      agreements: [],
      stats: { total: 0, active: 0, expiringSoon: 0, mrrCents: 0 },
    };
  }

  const agreements: ServiceAgreement[] = data || [];

  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(now.getDate() + 30);

  const activeAgreements = agreements.filter((a) => a.status === 'active');

  const expiringSoon = activeAgreements.filter((a) => {
    if (!a.end_date) return false;
    const endDate = new Date(a.end_date);
    return endDate >= now && endDate <= thirtyDaysFromNow;
  }).length;

  const mrrCents = activeAgreements.reduce(
    (sum, a) => sum + computeMrrCents(a.price_cents, a.billing_cycle),
    0
  );

  return {
    agreements,
    stats: {
      total: agreements.length,
      active: activeAgreements.length,
      expiringSoon,
      mrrCents,
    },
  };
}

// ---------- Agreement Card ----------

function AgreementCard({ agreement }: { agreement: ServiceAgreement }) {
  const config = typeConfig[agreement.type] || typeConfig.maintenance;
  const TypeIcon = config.icon;
  const daysUntilExpiry = getDaysUntilExpiry(agreement.end_date);
  const isExpiringSoon =
    agreement.status === 'active' && daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 30;

  return (
    <Card className="p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`p-2 rounded-lg ${config.color}`}>
            <TypeIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-slate-900 truncate">{agreement.name}</div>
            {agreement.customer && (
              <div className="text-sm text-slate-500 truncate">{agreement.customer.name}</div>
            )}
          </div>
        </div>
        <button className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors">
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge className={statusColors[agreement.status]}>
          {agreement.status.charAt(0).toUpperCase() + agreement.status.slice(1)}
        </Badge>
        <Badge className={config.color}>{config.label}</Badge>
      </div>

      <div className="mt-4 space-y-2">
        {/* Price + billing cycle */}
        <div className="flex items-center gap-2 text-sm">
          <DollarSign className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-medium text-slate-900">
            {formatCents(agreement.price_cents)}
            <span className="text-slate-500 font-normal">{billingLabels[agreement.billing_cycle]}</span>
          </span>
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>
            {formatDate(agreement.start_date)}
            {' \u2192 '}
            {agreement.end_date ? formatDate(agreement.end_date) : 'No end date'}
          </span>
        </div>

        {/* Expiry warning */}
        {isExpiringSoon && (
          <div className="flex items-center gap-2 text-sm text-amber-600">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="font-medium">
              {daysUntilExpiry === 0
                ? 'Expires today'
                : daysUntilExpiry === 1
                  ? 'Expires tomorrow'
                  : `Expires in ${daysUntilExpiry} days`}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}

// ---------- Page ----------

export default async function AgreementsPage() {
  const { agreements, stats } = await getAgreementsData();

  return (
    <div>
      <Header title="Service Agreements" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-sm text-slate-500">Total Agreements</div>
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">Active</div>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">Expiring Soon</div>
            <div className={`text-2xl font-bold ${stats.expiringSoon > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {stats.expiringSoon}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-slate-500">Monthly Revenue</div>
            <div className="text-2xl font-bold text-green-600">
              {formatCents(stats.mrrCents)}
            </div>
          </Card>
        </div>

        {/* Agreements List */}
        <Card padding="none">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">All Agreements</h2>
              <p className="text-sm text-slate-500">
                Manage maintenance, warranty, and membership plans
              </p>
            </div>
            <Link href="/agreements/new">
              <Button size="sm">
                <Plus className="w-4 h-4" />
                New Agreement
              </Button>
            </Link>
          </div>

          {/* Filter buttons */}
          <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-2 overflow-x-auto">
            <Link
              href="/agreements"
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors"
            >
              All
            </Link>
            <Link
              href="/agreements?status=active"
              className="px-3 py-1.5 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Active
            </Link>
            <Link
              href="/agreements?status=expiring"
              className="px-3 py-1.5 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Expiring
            </Link>
            <Link
              href="/agreements?status=expired"
              className="px-3 py-1.5 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Expired
            </Link>
          </div>

          {agreements.length > 0 ? (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agreements.map((agreement) => (
                <AgreementCard key={agreement.id} agreement={agreement} />
              ))}
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <FileCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <div className="text-slate-500">No service agreements yet</div>
              <div className="text-sm text-slate-400">
                Create your first service agreement to manage recurring work
              </div>
              <Link href="/agreements/new" className="mt-4 inline-block">
                <Button size="sm">
                  <Plus className="w-4 h-4" />
                  Create Agreement
                </Button>
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
