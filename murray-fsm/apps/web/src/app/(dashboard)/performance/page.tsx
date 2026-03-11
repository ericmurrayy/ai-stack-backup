// Murray's FSM - Technician Performance & Commission Page
// ========================================================
// Track technician KPIs, commissions, and performance rankings

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCents } from '@/lib/utils';
import {
  Users,
  Trophy,
  DollarSign,
  Star,
  Clock,
  CheckCircle,
  Briefcase,
  TrendingUp,
  Award,
  Zap,
  Phone,
} from 'lucide-react';
import Link from 'next/link';

// ---------- Types ----------

interface TechPerformance {
  id: string;
  name: string;
  color: string;
  phone: string | null;
  role: string;
  hourly_rate_cents: number;
  // Computed
  jobsCompleted: number;
  jobsAssigned: number;
  completionRate: number;
  revenueGenerated: number;
  avgRating: number | null;
  reviewCount: number;
  hoursWorked: number;
  laborCost: number;
  commission: number;
  efficiency: number; // revenue per hour
}

// ---------- Data Fetcher ----------

async function getPerformanceData() {
  const supabase = await createClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Get all active technicians
  const { data: technicians } = await supabase
    .from('technicians')
    .select('id, name, color, phone, role, hourly_rate_cents')
    .eq('is_active', true)
    .eq('deleted', false)
    .order('name');

  if (!technicians || technicians.length === 0) {
    return { technicians: [], topPerformer: null };
  }

  const techIds = technicians.map(t => t.id);

  // Jobs this month by technician
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, assigned_technician_id, status')
    .eq('is_spam', false)
    .in('assigned_technician_id', techIds)
    .gte('created_at', monthStart.toISOString());

  // Revenue (approved estimates for jobs assigned to technicians)
  const { data: estimates } = await supabase
    .from('estimates')
    .select('total_cents, converted_job_id')
    .eq('status', 'approved')
    .eq('deleted', false)
    .gte('approved_at', monthStart.toISOString());

  // Get the technician associated with each estimate's job
  const jobIds = (estimates || []).map(e => e.converted_job_id).filter(Boolean);
  let jobTechMap: Record<string, string> = {};
  if (jobIds.length > 0) {
    const { data: estimateJobs } = await supabase
      .from('jobs')
      .select('id, assigned_technician_id')
      .in('id', jobIds);
    if (estimateJobs) {
      estimateJobs.forEach(j => {
        if (j.assigned_technician_id) {
          jobTechMap[j.id] = j.assigned_technician_id;
        }
      });
    }
  }

  // Reviews
  const { data: reviews } = await supabase
    .from('reviews')
    .select('rating, job_id')
    .eq('deleted', false)
    .gte('reviewed_at', monthStart.toISOString());

  // Time entries this month
  const { data: timeEntries } = await supabase
    .from('time_entries')
    .select('technician_id, duration_minutes')
    .gte('created_at', monthStart.toISOString());

  // Get job → technician mapping for reviews
  const reviewJobIds = (reviews || []).map(r => r.job_id).filter(Boolean);
  let reviewJobTechMap: Record<string, string> = {};
  if (reviewJobIds.length > 0) {
    const { data: reviewJobs } = await supabase
      .from('jobs')
      .select('id, assigned_technician_id')
      .in('id', reviewJobIds);
    if (reviewJobs) {
      reviewJobs.forEach(j => {
        if (j.assigned_technician_id) {
          reviewJobTechMap[j.id] = j.assigned_technician_id;
        }
      });
    }
  }

  // Commission rate: 10% of revenue generated
  const COMMISSION_RATE = 0.10;

  // Build performance data
  const techPerformance: TechPerformance[] = technicians.map(tech => {
    const techJobs = (jobs || []).filter(j => j.assigned_technician_id === tech.id);
    const completed = techJobs.filter(j => j.status === 'completed').length;
    const assigned = techJobs.length;

    // Revenue
    const revenue = (estimates || [])
      .filter(e => e.converted_job_id && jobTechMap[e.converted_job_id] === tech.id)
      .reduce((sum, e) => sum + (e.total_cents || 0), 0);

    // Reviews
    const techReviews = (reviews || [])
      .filter(r => r.job_id && reviewJobTechMap[r.job_id] === tech.id);
    const avgRating = techReviews.length > 0
      ? techReviews.reduce((sum, r) => sum + r.rating, 0) / techReviews.length
      : null;

    // Hours
    const minutes = (timeEntries || [])
      .filter(te => te.technician_id === tech.id)
      .reduce((sum, te) => sum + (te.duration_minutes || 0), 0);
    const hours = Math.round(minutes / 60 * 10) / 10;

    const laborCost = Math.round(hours * (tech.hourly_rate_cents || 3500));
    const commission = Math.round(revenue * COMMISSION_RATE);
    const efficiency = hours > 0 ? Math.round(revenue / hours) : 0;

    return {
      id: tech.id,
      name: tech.name,
      color: tech.color,
      phone: tech.phone,
      role: tech.role || 'technician',
      hourly_rate_cents: tech.hourly_rate_cents || 3500,
      jobsCompleted: completed,
      jobsAssigned: assigned,
      completionRate: assigned > 0 ? Math.round((completed / assigned) * 100) : 0,
      revenueGenerated: revenue,
      avgRating,
      reviewCount: techReviews.length,
      hoursWorked: hours,
      laborCost,
      commission,
      efficiency,
    };
  });

  // Sort by revenue for top performer
  const sorted = [...techPerformance].sort((a, b) => b.revenueGenerated - a.revenueGenerated);
  const topPerformer = sorted[0]?.revenueGenerated > 0 ? sorted[0] : null;

  return { technicians: sorted, topPerformer };
}

// ---------- Page ----------

export default async function PerformancePage() {
  const { technicians, topPerformer } = await getPerformanceData();

  const totalRevenue = technicians.reduce((s, t) => s + t.revenueGenerated, 0);
  const totalCommissions = technicians.reduce((s, t) => s + t.commission, 0);
  const totalJobs = technicians.reduce((s, t) => s + t.jobsCompleted, 0);

  return (
    <div>
      <Header title="Team Performance" />

      <div className="p-6 space-y-6">
        {/* Top Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{formatCents(totalRevenue)}</div>
                <div className="text-sm text-slate-500">Team Revenue</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50">
                <Award className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">{formatCents(totalCommissions)}</div>
                <div className="text-sm text-slate-500">Total Commissions</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Briefcase className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{totalJobs}</div>
                <div className="text-sm text-slate-500">Jobs Completed</div>
              </div>
            </div>
          </Card>
          {topPerformer && (
            <Card className="p-4 border-yellow-200 bg-yellow-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-100">
                  <Trophy className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-900">{topPerformer.name}</div>
                  <div className="text-sm text-yellow-700">Top Performer 🏆</div>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Performance Table */}
        <Card padding="none">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Technician Scorecard — This Month</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Rank</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">Technician</th>
                  <th className="text-center px-6 py-3 text-xs font-medium text-slate-500 uppercase">Jobs</th>
                  <th className="text-center px-6 py-3 text-xs font-medium text-slate-500 uppercase">Completion</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">Revenue</th>
                  <th className="text-center px-6 py-3 text-xs font-medium text-slate-500 uppercase">Rating</th>
                  <th className="text-center px-6 py-3 text-xs font-medium text-slate-500 uppercase">Hours</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">$/Hour</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase">Commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {technicians.map((tech, index) => (
                  <tr key={tech.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700' :
                        index === 1 ? 'bg-slate-200 text-slate-600' :
                        index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                          style={{ backgroundColor: tech.color }}
                        >
                          {tech.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{tech.name}</div>
                          <Badge className="bg-slate-100 text-slate-600 text-xs capitalize">{tech.role}</Badge>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-medium text-slate-900">{tech.jobsCompleted}</span>
                      <span className="text-slate-400">/{tech.jobsAssigned}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 bg-slate-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${tech.completionRate >= 80 ? 'bg-green-500' : tech.completionRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${tech.completionRate}%` }}
                          />
                        </div>
                        <span className="text-sm text-slate-600">{tech.completionRate}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-900">
                      {formatCents(tech.revenueGenerated)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {tech.avgRating !== null ? (
                        <div className="flex items-center justify-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          <span className="text-sm font-medium text-slate-900">
                            {tech.avgRating.toFixed(1)}
                          </span>
                          <span className="text-xs text-slate-400">({tech.reviewCount})</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-slate-900">
                      {tech.hoursWorked}h
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`text-sm font-medium ${tech.efficiency > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                        {tech.efficiency > 0 ? formatCents(tech.efficiency) : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-semibold text-purple-600">
                        {formatCents(tech.commission)}
                      </span>
                    </td>
                  </tr>
                ))}
                {technicians.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center">
                      <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <div className="text-slate-500">No technicians found</div>
                      <Link href="/team" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
                        Add technicians →
                      </Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
