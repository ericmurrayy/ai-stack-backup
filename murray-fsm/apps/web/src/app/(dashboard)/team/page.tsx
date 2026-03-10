// Murray's FSM - Team Management
// ===============================
// Multi-technician scheduling, time tracking, performance

import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCents, formatRelativeTime } from '@/lib/utils';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Clock,
  Briefcase,
  Star,
  MoreVertical,
  Plus,
  Calendar,
  TrendingUp,
  CheckCircle,
} from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  color: string;
  skills: string[];
  is_active: boolean;
  hourly_rate_cents: number;
  // Computed stats
  jobs_today: number;
  jobs_this_week: number;
  revenue_this_month: number;
  avg_rating: number;
}

async function getTeamData(): Promise<TeamMember[]> {
  const supabase = createClient();

  const { data: members } = await supabase
    .from('technicians')
    .select('id, name, email, phone, role, color, skills, is_active, hourly_rate_cents')
    .eq('deleted', false)
    .order('name');

  if (!members?.length) {
    return [];
  }

  return members.map((m: any) => ({
    ...m,
    jobs_today: 0,
    jobs_this_week: 0,
    revenue_this_month: 0,
    avg_rating: 0,
  }));
}

const roleColors: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-800',
  admin: 'bg-blue-100 text-blue-800',
  dispatcher: 'bg-yellow-100 text-yellow-800',
  technician: 'bg-green-100 text-green-800',
  office: 'bg-slate-100 text-slate-800',
};

function TeamMemberCard({ member }: { member: TeamMember }) {
  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg"
          style={{ backgroundColor: member.color }}
        >
          {member.name.split(' ').map(n => n[0]).join('')}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900 truncate">{member.name}</h3>
            <Badge className={roleColors[member.role] || roleColors.office}>
              {member.role}
            </Badge>
            {!member.is_active && (
              <Badge className="bg-red-100 text-red-800">Inactive</Badge>
            )}
          </div>

          <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Mail className="w-3.5 h-3.5" />
              {member.email}
            </span>
            {member.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                {member.phone}
              </span>
            )}
          </div>

          {member.skills.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {member.skills.slice(0, 3).map((skill) => (
                <span
                  key={skill}
                  className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded"
                >
                  {skill}
                </span>
              ))}
              {member.skills.length > 3 && (
                <span className="text-xs text-slate-400">+{member.skills.length - 3} more</span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <MoreVertical className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      {/* Stats (for technicians) */}
      {member.role === 'technician' && (
        <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100">
          <div>
            <div className="text-lg font-semibold text-slate-900">{member.jobs_today}</div>
            <div className="text-xs text-slate-500">Jobs Today</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-slate-900">{member.jobs_this_week}</div>
            <div className="text-xs text-slate-500">This Week</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-green-600">
              {formatCents(member.revenue_this_month)}
            </div>
            <div className="text-xs text-slate-500">Revenue</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-slate-900 flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              {member.avg_rating > 0 ? member.avg_rating.toFixed(1) : '-'}
            </div>
            <div className="text-xs text-slate-500">Rating</div>
          </div>
        </div>
      )}
    </Card>
  );
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
                <div className="text-2xl font-bold text-slate-900">—</div>
                <div className="text-sm text-slate-500">On-Time Rate</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Team Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
              All ({team.length})
            </button>
            <button className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg">
              Technicians ({technicians.length})
            </button>
            <button className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg">
              Office Staff
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Time Tracking
            </button>
            <button className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Schedule View
            </button>
            <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Team Member
            </button>
          </div>
        </div>

        {/* Team List */}
        <div className="space-y-4">
          {team.map((member) => (
            <TeamMemberCard key={member.id} member={member} />
          ))}
        </div>

        {team.length === 0 && (
          <Card className="p-12 text-center">
            <User className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No team members yet</h3>
            <p className="text-slate-500 mb-4">Add your first team member to start scheduling jobs</p>
            <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              Add Team Member
            </button>
          </Card>
        )}
      </div>
    </div>
  );
}
