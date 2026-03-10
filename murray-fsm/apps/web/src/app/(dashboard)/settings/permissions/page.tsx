// Murray's FSM - Team Permissions Settings
// ==========================================
// Role-based access control configuration

'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Users,
  ArrowLeft,
  Save,
  CheckCircle,
  Shield,
  Eye,
  Edit,
  Trash2,
  Plus,
  Settings,
} from 'lucide-react';
import Link from 'next/link';

interface Role {
  id: string;
  name: string;
  description: string;
  userCount: number;
  color: string;
  permissions: Record<string, boolean>;
}

const PERMISSION_GROUPS = [
  {
    group: 'Jobs',
    permissions: [
      { key: 'jobs.view', label: 'View Jobs' },
      { key: 'jobs.create', label: 'Create Jobs' },
      { key: 'jobs.edit', label: 'Edit Jobs' },
      { key: 'jobs.delete', label: 'Delete Jobs' },
      { key: 'jobs.assign', label: 'Assign Technicians' },
    ],
  },
  {
    group: 'Customers',
    permissions: [
      { key: 'customers.view', label: 'View Customers' },
      { key: 'customers.create', label: 'Create Customers' },
      { key: 'customers.edit', label: 'Edit Customers' },
      { key: 'customers.delete', label: 'Delete Customers' },
    ],
  },
  {
    group: 'Financial',
    permissions: [
      { key: 'estimates.view', label: 'View Estimates' },
      { key: 'estimates.create', label: 'Create Estimates' },
      { key: 'invoices.view', label: 'View Invoices' },
      { key: 'payments.view', label: 'View Payments' },
      { key: 'reports.view', label: 'View Reports' },
    ],
  },
  {
    group: 'Settings',
    permissions: [
      { key: 'settings.view', label: 'View Settings' },
      { key: 'settings.edit', label: 'Edit Settings' },
      { key: 'team.manage', label: 'Manage Team' },
      { key: 'integrations.manage', label: 'Manage Integrations' },
    ],
  },
];

const defaultRoles: Role[] = [
  {
    id: '1',
    name: 'Owner',
    description: 'Full access to everything',
    userCount: 1,
    color: 'bg-red-100 text-red-800',
    permissions: Object.fromEntries(
      PERMISSION_GROUPS.flatMap((g) => g.permissions).map((p) => [p.key, true])
    ),
  },
  {
    id: '2',
    name: 'Admin',
    description: 'Everything except billing and account deletion',
    userCount: 1,
    color: 'bg-blue-100 text-blue-800',
    permissions: Object.fromEntries(
      PERMISSION_GROUPS.flatMap((g) => g.permissions).map((p) => [p.key, true])
    ),
  },
  {
    id: '3',
    name: 'Dispatcher',
    description: 'Manage jobs and scheduling, view customers',
    userCount: 1,
    color: 'bg-purple-100 text-purple-800',
    permissions: {
      'jobs.view': true,
      'jobs.create': true,
      'jobs.edit': true,
      'jobs.delete': false,
      'jobs.assign': true,
      'customers.view': true,
      'customers.create': true,
      'customers.edit': true,
      'customers.delete': false,
      'estimates.view': true,
      'estimates.create': true,
      'invoices.view': true,
      'payments.view': false,
      'reports.view': false,
      'settings.view': false,
      'settings.edit': false,
      'team.manage': false,
      'integrations.manage': false,
    },
  },
  {
    id: '4',
    name: 'Technician',
    description: 'View assigned jobs and update status',
    userCount: 4,
    color: 'bg-green-100 text-green-800',
    permissions: {
      'jobs.view': true,
      'jobs.create': false,
      'jobs.edit': true,
      'jobs.delete': false,
      'jobs.assign': false,
      'customers.view': true,
      'customers.create': false,
      'customers.edit': false,
      'customers.delete': false,
      'estimates.view': true,
      'estimates.create': false,
      'invoices.view': false,
      'payments.view': false,
      'reports.view': false,
      'settings.view': false,
      'settings.edit': false,
      'team.manage': false,
      'integrations.manage': false,
    },
  },
];

export default function PermissionsPage() {
  const [roles, setRoles] = useState(defaultRoles);
  const [selectedRole, setSelectedRole] = useState<Role>(defaultRoles[2]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const togglePermission = (permKey: string) => {
    if (selectedRole.name === 'Owner') return; // Can't modify owner
    setRoles((prev) =>
      prev.map((r) =>
        r.id === selectedRole.id
          ? {
              ...r,
              permissions: {
                ...r.permissions,
                [permKey]: !r.permissions[permKey],
              },
            }
          : r
      )
    );
    setSelectedRole((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permKey]: !prev.permissions[permKey],
      },
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    setSaved(true);
  };

  return (
    <div>
      <Header title="Team Permissions" />

      <div className="p-6 space-y-6 max-w-5xl">
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </Link>

        <div className="grid grid-cols-12 gap-6">
          {/* Role List */}
          <div className="col-span-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Roles</h2>
              <Button variant="outline" size="sm">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add
              </Button>
            </div>

            {roles.map((role) => (
              <div
                key={role.id}
                onClick={() => setSelectedRole(role)}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedRole(role)}
              >
                <Card
                  className={`p-4 transition-all ${
                    selectedRole.id === role.id
                      ? 'ring-2 ring-blue-500 shadow-sm'
                      : 'hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge className={role.color}>{role.name}</Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{role.description}</p>
                    </div>
                    <div className="text-xs text-slate-400">
                      {role.userCount} {role.userCount === 1 ? 'user' : 'users'}
                    </div>
                  </div>
                </Card>
              </div>
            ))}
          </div>

          {/* Permission Matrix */}
          <div className="col-span-8">
            <Card padding="none">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-slate-600" />
                  <div>
                    <h2 className="font-semibold text-slate-900">
                      {selectedRole.name} Permissions
                    </h2>
                    <p className="text-xs text-slate-500">{selectedRole.description}</p>
                  </div>
                </div>
                <Button onClick={handleSave} loading={saving} size="sm">
                  {saved ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-1" />
                      Save
                    </>
                  )}
                </Button>
              </div>

              <div className="divide-y divide-slate-200">
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.group}>
                    <div className="px-6 py-2 bg-slate-50">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        {group.group}
                      </span>
                    </div>
                    {group.permissions.map((perm) => (
                      <div
                        key={perm.key}
                        className="px-6 py-3 flex items-center justify-between hover:bg-slate-50"
                      >
                        <span className="text-sm text-slate-700">{perm.label}</span>
                        <button
                          onClick={() => togglePermission(perm.key)}
                          disabled={selectedRole.name === 'Owner'}
                          aria-label={`Toggle ${perm.label}`}
                          className={`relative w-10 h-5 rounded-full transition-colors ${
                            selectedRole.permissions[perm.key]
                              ? 'bg-blue-600'
                              : 'bg-slate-300'
                          } ${selectedRole.name === 'Owner' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                              selectedRole.permissions[perm.key] ? 'translate-x-5' : ''
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
