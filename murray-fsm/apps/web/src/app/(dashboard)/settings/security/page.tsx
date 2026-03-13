// Murray's FSM - Security Settings
// ===================================
// 2FA, API keys, sessions, and security audit log

'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Shield,
  ArrowLeft,
  Save,
  CheckCircle,
  Key,
  Smartphone,
  Monitor,
  Clock,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';

interface Session {
  id: string;
  device: string;
  browser: string;
  ip: string;
  location: string;
  lastActive: string;
  current: boolean;
}

interface AuditEntry {
  id: string;
  action: string;
  user: string;
  ip: string;
  timestamp: string;
}

const sessions: Session[] = [
  {
    id: '1',
    device: 'Windows Desktop',
    browser: 'Chrome 122',
    ip: '72.14.201.xxx',
    location: 'Atlanta, GA',
    lastActive: 'Now',
    current: true,
  },
  {
    id: '2',
    device: 'iPhone 15',
    browser: 'Safari Mobile',
    ip: '72.14.201.xxx',
    location: 'Atlanta, GA',
    lastActive: '2 hours ago',
    current: false,
  },
  {
    id: '3',
    device: 'MacBook Pro',
    browser: 'Chrome 121',
    ip: '68.42.119.xxx',
    location: 'Roswell, GA',
    lastActive: '3 days ago',
    current: false,
  },
];

const auditLog: AuditEntry[] = [
  { id: '1', action: 'Login successful', user: 'admin@murrays.com', ip: '72.14.201.xxx', timestamp: '2 min ago' },
  { id: '2', action: 'Settings updated', user: 'admin@murrays.com', ip: '72.14.201.xxx', timestamp: '15 min ago' },
  { id: '3', action: 'New API key created', user: 'admin@murrays.com', ip: '72.14.201.xxx', timestamp: '1 hour ago' },
  { id: '4', action: 'User invited: tech@murrays.com', user: 'admin@murrays.com', ip: '72.14.201.xxx', timestamp: '3 hours ago' },
  { id: '5', action: 'Password changed', user: 'admin@murrays.com', ip: '68.42.119.xxx', timestamp: '2 days ago' },
  { id: '6', action: 'Login from new device', user: 'admin@murrays.com', ip: '68.42.119.xxx', timestamp: '2 days ago' },
];

export default function SecurityPage() {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(30);

  return (
    <div>
      <Header title="Security" />

      <div className="p-6 space-y-6 max-w-4xl">
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </Link>

        {/* 2FA */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-green-50 rounded-xl">
                <Smartphone className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">Two-Factor Authentication</h2>
                <p className="text-sm text-slate-500">
                  {twoFactorEnabled
                    ? 'Your account is protected with 2FA'
                    : 'Add an extra layer of security to your account'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {twoFactorEnabled ? (
                <Badge className="bg-green-100 text-green-800">Enabled</Badge>
              ) : (
                <Badge className="bg-yellow-100 text-yellow-800">Disabled</Badge>
              )}
              <Button
                variant={twoFactorEnabled ? 'outline' : 'primary'}
                size="sm"
                onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
              >
                {twoFactorEnabled ? 'Disable' : 'Enable 2FA'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Password Policy */}
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-slate-600" />
            Password Policy
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <div className="font-medium text-slate-900 text-sm">Force Password Change</div>
                <div className="text-xs text-slate-500">
                  Require all team members to change passwords every 90 days
                </div>
              </div>
              <button
                onClick={() => setForcePasswordChange(!forcePasswordChange)}
                aria-label="Toggle force password change"
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  forcePasswordChange ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    forcePasswordChange ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
            <div>
              <label htmlFor="timeout" className="block text-sm font-medium text-slate-700 mb-1">
                Session Timeout (days)
              </label>
              <input
                id="timeout"
                type="number"
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(parseInt(e.target.value) || 1)}
                min={1}
                max={365}
                className="w-32 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </Card>

        {/* Active Sessions */}
        <Card padding="none">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Active Sessions</h2>
              <p className="text-sm text-slate-500">{sessions.length} devices</p>
            </div>
            <Button variant="outline" size="sm">
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Revoke All Others
            </Button>
          </div>
          <div className="divide-y divide-slate-200">
            {sessions.map((session) => (
              <div key={session.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <Monitor className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 text-sm">
                        {session.device}
                      </span>
                      {session.current && (
                        <Badge className="bg-green-100 text-green-800 text-xs">Current</Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {session.browser} · {session.ip} · {session.location}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{session.lastActive}</span>
                  {!session.current && (
                    <button
                      className="text-red-500 hover:text-red-700 p-1"
                      aria-label={`Revoke session ${session.device}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Security Audit Log */}
        <Card padding="none">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Security Audit Log</h2>
            <p className="text-sm text-slate-500">Recent security events</p>
          </div>
          <div className="divide-y divide-slate-200">
            {auditLog.map((entry) => (
              <div key={entry.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
                  <div>
                    <span className="text-sm text-slate-900">{entry.action}</span>
                    <span className="text-xs text-slate-400 ml-2">{entry.user}</span>
                  </div>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <span>{entry.ip}</span>
                  <span>·</span>
                  <span>{entry.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
