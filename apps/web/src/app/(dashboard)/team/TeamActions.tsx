'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Phone,
  Mail,
  Plus,
  Clock,
  Calendar,
  MoreVertical,
  Star,
  X,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCents } from '@/lib/utils';

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
  jobs_today: number;
  jobs_this_week: number;
  revenue_this_month: number;
  avg_rating: number;
  on_time_rate: number;
}

const roleColors: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-800',
  admin: 'bg-blue-100 text-blue-800',
  dispatcher: 'bg-yellow-100 text-yellow-800',
  technician: 'bg-green-100 text-green-800',
  office: 'bg-slate-100 text-slate-800',
};

// Add Team Member Button with Modal
export function AddTeamMemberButton({ variant = 'primary' }: { variant?: 'primary' | 'secondary' }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: 'technician',
    hourly_rate: '',
    skills: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone || null,
          role: formData.role,
          hourly_rate_cents: formData.hourly_rate ? Math.round(parseFloat(formData.hourly_rate) * 100) : 0,
          skills: formData.skills ? formData.skills.split(',').map(s => s.trim()) : [],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create team member');
      }

      setIsOpen(false);
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        role: 'technician',
        hourly_rate: '',
        skills: '',
      });
      router.refresh();
    } catch (err) {
      console.error('Failed to create team member:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={variant === 'primary'
          ? "px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          : "px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        }
      >
        <Plus className="w-4 h-4" />
        Add Team Member
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Add Team Member</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="John Smith"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Role *
                </label>
                <select
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="technician">Technician</option>
                  <option value="dispatcher">Dispatcher</option>
                  <option value="office">Office Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Hourly Rate
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.hourly_rate}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="25.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Skills (comma separated)
                </label>
                <input
                  type="text"
                  value={formData.skills}
                  onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Garage Door Repair, Spring Replacement"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// Time Tracking Button
export function TimeTrackingButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2"
      >
        <Clock className="w-4 h-4" />
        Time Tracking
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Time Tracking</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6">
              <div className="text-center py-12 text-slate-500">
                <Clock className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>Time tracking dashboard coming soon.</p>
                <p className="text-sm mt-2">Track hours, breaks, and overtime for your team.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Schedule View Button
export function ScheduleViewButton() {
  return (
    <a
      href="/calendar"
      className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2"
    >
      <Calendar className="w-4 h-4" />
      Schedule View
    </a>
  );
}

// Filter Buttons
export function TeamFilterButtons({ teamCount, technicianCount }: { teamCount: number; technicianCount: number }) {
  const [activeFilter, setActiveFilter] = useState('all');

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setActiveFilter('all')}
        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
          activeFilter === 'all'
            ? 'bg-slate-100 text-slate-700'
            : 'text-slate-500 hover:bg-slate-100'
        }`}
      >
        All ({teamCount})
      </button>
      <button
        onClick={() => setActiveFilter('technicians')}
        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
          activeFilter === 'technicians'
            ? 'bg-slate-100 text-slate-700'
            : 'text-slate-500 hover:bg-slate-100'
        }`}
      >
        Technicians ({technicianCount})
      </button>
      <button
        onClick={() => setActiveFilter('office')}
        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
          activeFilter === 'office'
            ? 'bg-slate-100 text-slate-700'
            : 'text-slate-500 hover:bg-slate-100'
        }`}
      >
        Office Staff
      </button>
    </div>
  );
}

// Team Member Card with interactive actions
export function InteractiveTeamMemberCard({ member }: { member: TeamMember }) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg"
          style={{ backgroundColor: member.color }}
        >
          {member.full_name.split(' ').map(n => n[0]).join('')}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900 truncate">{member.full_name}</h3>
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
              <a
                href={`tel:${member.phone}`}
                className="flex items-center gap-1 hover:text-blue-600"
              >
                <Phone className="w-3.5 h-3.5" />
                {member.phone}
              </a>
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
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <MoreVertical className="w-5 h-5 text-slate-400" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-slate-200 z-20 py-1">
                <button className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                  View Profile
                </button>
                <button className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                  Edit Details
                </button>
                <button className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                  View Schedule
                </button>
                {member.phone && (
                  <a
                    href={`tel:${member.phone}`}
                    className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    Call
                  </a>
                )}
                <a
                  href={`mailto:${member.email}`}
                  className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Send Email
                </a>
              </div>
            </>
          )}
        </div>
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
