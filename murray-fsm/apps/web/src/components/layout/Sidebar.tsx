// Murray's FSM - Sidebar Component
// ==================================

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Briefcase,
  Users,
  Phone,
  MessageSquare,
  CheckCircle,
  Calendar,
  CreditCard,
  Settings,
  LogOut,
} from 'lucide-react';

const navigation = [
  { name: 'Jobs', href: '/jobs', icon: Briefcase },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Calls', href: '/calls', icon: Phone },
  { name: 'Texts', href: '/texts', icon: MessageSquare },
  { name: 'Approvals', href: '/approvals', icon: CheckCircle },
  { name: 'Calendar', href: '/calendar', icon: Calendar },
  { name: 'Payments', href: '/payments', icon: CreditCard },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col w-64 bg-slate-900 min-h-screen">
      {/* Logo */}
      <div className="flex items-center h-16 px-6 border-b border-slate-800">
        <Link href="/jobs" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">M</span>
          </div>
          <span className="text-white font-semibold text-lg">Murray's FSM</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-slate-800">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            pathname === '/settings'
              ? 'bg-primary-600 text-white'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          )}
        >
          <Settings className="w-5 h-5" />
          Settings
        </Link>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </form>
      </div>
    </div>
  );
}
