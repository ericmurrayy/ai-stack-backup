// Murray's FSM - Professional Sidebar
// ====================================

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Calendar,
  Briefcase,
  Users,
  Package,
  DollarSign,
  Phone,
  MessageSquare,
  BarChart3,
  Star,
  Megaphone,
  GitBranch,
  CheckSquare,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  UserPlus,
  Sparkles,
  FileText,
  Receipt,
  TrendingUp,
  Wallet,
  RefreshCw,
  Truck,
  Radio,
  ScrollText,
  ClipboardList,
} from 'lucide-react';
import { useState } from 'react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface NavGroup {
  title: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

const navGroups: NavGroup[] = [
  {
    title: 'Core',
    defaultOpen: true,
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Dispatch', href: '/dispatch', icon: Radio },
      { name: 'Schedule', href: '/schedule', icon: Calendar },
      { name: 'Jobs', href: '/jobs', icon: Briefcase },
      { name: 'Recurring', href: '/recurring', icon: RefreshCw },
      { name: 'Customers', href: '/customers', icon: Users },
    ],
  },
  {
    title: 'Revenue',
    defaultOpen: true,
    items: [
      { name: 'Revenue', href: '/revenue', icon: DollarSign },
      { name: 'Profit/Loss', href: '/profit', icon: TrendingUp },
      { name: 'Quotes', href: '/quotes', icon: FileText },
      { name: 'Invoices', href: '/invoices', icon: Receipt },
      { name: 'Phone AI', href: '/phone', icon: Phone },
    ],
  },
  {
    title: 'Operations',
    defaultOpen: false,
    items: [
      { name: 'Pipeline', href: '/pipeline', icon: GitBranch },
      { name: 'Contracts', href: '/contracts', icon: ScrollText },
      { name: 'Work Orders', href: '/work-orders', icon: ClipboardList },
      { name: 'Inventory', href: '/inventory', icon: Package },
      { name: 'Equipment', href: '/equipment', icon: Truck },
      { name: 'Expenses', href: '/expenses', icon: Receipt },
      { name: 'Payments', href: '/payments', icon: DollarSign },
      { name: 'Approvals', href: '/approvals', icon: CheckSquare },
    ],
  },
  {
    title: 'Communication',
    defaultOpen: false,
    items: [
      { name: 'Calls', href: '/calls', icon: Phone },
      { name: 'Texts', href: '/texts', icon: MessageSquare },
    ],
  },
  {
    title: 'Growth',
    defaultOpen: false,
    items: [
      { name: 'Analytics', href: '/analytics', icon: BarChart3 },
      { name: 'Reviews', href: '/reviews', icon: Star },
      { name: 'Surveys', href: '/surveys', icon: MessageSquare },
      { name: 'Referrals', href: '/referrals', icon: UserPlus },
      { name: 'Marketing', href: '/marketing', icon: Megaphone },
    ],
  },
  {
    title: 'Team',
    defaultOpen: false,
    items: [
      { name: 'Team', href: '/team', icon: UserPlus },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    Object.fromEntries(navGroups.map(g => [g.title, g.defaultOpen ?? false]))
  );

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const toggleGroup = (title: string) => {
    setExpandedGroups(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const NavLink = ({ item }: { item: NavItem }) => (
    <Link
      href={item.href}
      onClick={() => setMobileOpen(false)}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all',
        isActive(item.href)
          ? 'bg-primary text-white shadow-md'
          : 'text-foreground-secondary hover:bg-muted'
      )}
    >
      <item.icon className={cn('w-4 h-4', isActive(item.href) ? 'text-white' : 'text-foreground-tertiary')} />
      <span className="flex-1">{item.name}</span>
      {item.badge && (
        <span className="px-1.5 py-0.5 text-xs bg-danger text-white rounded-full">{item.badge}</span>
      )}
    </Link>
  );

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-surface rounded-lg shadow-md"
      >
        {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-overlay z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        'fixed lg:static inset-y-0 left-0 z-40 flex flex-col w-60 bg-surface border-r border-border transition-transform duration-300 lg:transform-none',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-borderSubtle">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            <div>
              <span className="text-foreground font-semibold block leading-tight">Murray&apos;s</span>
              <span className="text-foreground-secondary text-xs">Field Service</span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.title}>
              <button
                onClick={() => toggleGroup(group.title)}
                className="flex items-center justify-between w-full px-2 py-1 text-xs font-semibold text-foreground-tertiary uppercase tracking-wider hover:text-foreground-secondary"
              >
                {group.title}
                {expandedGroups[group.title] ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
              </button>
              {expandedGroups[group.title] && (
                <div className="mt-1 space-y-0.5">
                  {group.items.map((item) => (
                    <NavLink key={item.name} item={item} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* AI Status Indicator */}
        <div className="px-3 py-2 mx-3 mb-2 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-100">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span className="text-xs font-medium text-purple-700">AI Assistant</span>
            <span className="ml-auto w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-borderSubtle space-y-0.5">
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all',
              isActive('/settings')
                ? 'bg-primary text-white'
                : 'text-foreground-secondary hover:bg-muted'
            )}
          >
            <Settings className={cn('w-4 h-4', isActive('/settings') ? 'text-white' : 'text-foreground-tertiary')} />
            Settings
          </Link>

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-foreground-secondary hover:bg-danger-bg hover:text-danger-text transition-all"
            >
              <LogOut className="w-4 h-4 text-foreground-tertiary" />
              Sign Out
            </button>
          </form>
        </div>

        {/* Version */}
        <div className="px-4 py-2 text-xs text-foreground-tertiary border-t border-borderSubtle">
          Murray FSM v3.0 + AI
        </div>
      </div>
    </>
  );
}
