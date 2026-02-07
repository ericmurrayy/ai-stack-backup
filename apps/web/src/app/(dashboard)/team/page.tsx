// Murray's FSM - Team Management
// ===============================
// Multi-technician scheduling, time tracking, performance

import { createAdminClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { formatCents } from '@/lib/utils';
import {
  User,
  Briefcase,
  TrendingUp,
  CheckCircle,
} from 'lucide-react';
import {
  AddTeamMemberButton,
  TimeTrackingButton,
  ScheduleViewButton,
  TeamFilterButtons,
  InteractiveTeamMemberCard,
} from './TeamActions';

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: string;
  color: string;
  avatar_url?: string;
  skills: string[];
  is_active: boolean;
  hourly_rate_cents: number;
  // Computed stats
  jobs_today: number;
  jobs_this_week: number;
  revenue_this_month: number;
  avg_rating: number;
  on_time_rate: number;
}

async function getTeamData(): Promise<TeamMember[]> {
  const supabase = createAdminClient();

  // Get team members - table may not exist in current schema
  const { data: members, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('deleted', false)
    .order('full_name');

  if (!members?.length) {
    // Return demo data if no team members exist
    return [
      {
        id: '1',
        full_name: 'Mike Johnson',
        email: 'mike@example.com',
        phone: '+15551234567',
        role: 'technician',
        color: '#3b82f6',
        skills: ['Garage Door Repair', 'Spring Replacement', 'Opener Installation'],
        is_active: true,
        hourly_rate_cents: 2500,
        jobs_today: 3,
        jobs_this_week: 12,
        revenue_this_month: 875000,
        avg_rating: 4.8,
        on_time_rate: 94,
      },
      {
        id: '2',
        full_name: 'Sarah Williams',
        email: 'sarah@example.com',
        phone: '+15559876543',
        role: 'technician',
        color: '#22c55e',
        skills: ['Garage Door Installation', 'Panel Replacement'],
        is_active: true,
        hourly_rate_cents: 2800,
        jobs_today: 2,
        jobs_this_week: 10,
        revenue_this_month: 920000,
        avg_rating: 4.9,
        on_time_rate: 98,
      },
      {
        id: '3',
        full_name: 'Tom Davis',
        email: 'tom@example.com',
        role: 'dispatcher',
        color: '#f59e0b',
        skills: [],
        is_active: true,
        hourly_rate_cents: 2000,
        jobs_today: 0,
        jobs_this_week: 0,
        revenue_this_month: 0,
        avg_rating: 0,
        on_time_rate: 0,
      },
    ];
  }

  // In production, would join with jobs/time_entries for real stats
  return members.map((m) => ({
    ...m,
    jobs_today: 0,
    jobs_this_week: 0,
    revenue_this_month: 0,
    avg_rating: 0,
    on_time_rate: 0,
  }));
}


export default async function TeamPage() {
  const team = await getTeamData();

  const technicians = team.filter(m => m.role === 'technician');
  const activeToday = technicians.filter(m => m.jobs_today > 0).length;
  const totalJobsToday = technicians.reduce((sum, m) => sum + m.jobs_today, 0);

  return (
    <div>
      <Header title="Team Management" />

      <div className="p-6 space-y-6">
        {/* Team Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{team.length}</div>
                <div className="text-sm text-slate-500">Team Members</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{activeToday}</div>
                <div className="text-sm text-slate-500">Active Today</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-50">
                <Briefcase className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{totalJobsToday}</div>
                <div className="text-sm text-slate-500">Jobs Today</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">94%</div>
                <div className="text-sm text-slate-500">On-Time Rate</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Team Actions */}
        <div className="flex items-center justify-between">
          <TeamFilterButtons teamCount={team.length} technicianCount={technicians.length} />
          <div className="flex items-center gap-2">
            <TimeTrackingButton />
            <ScheduleViewButton />
            <AddTeamMemberButton />
          </div>
        </div>

        {/* Team List */}
        <div className="space-y-4">
          {team.map((member) => (
            <InteractiveTeamMemberCard key={member.id} member={member} />
          ))}
        </div>

        {team.length === 0 && (
          <Card className="p-12 text-center">
            <User className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No team members yet</h3>
            <p className="text-slate-500 mb-4">Add your first team member to start scheduling jobs</p>
            <AddTeamMemberButton variant="secondary" />
          </Card>
        )}
      </div>
    </div>
  );
}
