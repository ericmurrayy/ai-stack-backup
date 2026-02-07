// Murray's FSM - Header Component
// =================================

'use client';

import Link from 'next/link';
import { Bell, Search, User, ChevronRight } from 'lucide-react';

interface Breadcrumb {
  label: string;
  href?: string;
}

interface HeaderProps {
  title: string;
  breadcrumbs?: Breadcrumb[];
}

export function Header({ title, breadcrumbs }: HeaderProps) {
  return (
    <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-6">
      <div>
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1 text-sm text-foreground-secondary mb-0.5">
            {breadcrumbs.map((crumb, index) => (
              <span key={index} className="flex items-center gap-1">
                {index > 0 && <ChevronRight className="w-3 h-3" />}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-foreground transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-foreground font-medium">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Search - triggers command palette */}
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
          className="relative flex items-center w-64 pl-10 pr-4 py-2 text-sm bg-muted border border-transparent rounded-lg hover:bg-muted transition-colors text-left"
        >
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground-tertiary" />
          <span className="text-foreground-tertiary">Search...</span>
          <kbd className="ml-auto text-xs bg-border px-1.5 py-0.5 rounded text-foreground-secondary">Ctrl+K</kbd>
        </button>

        {/* Notifications */}
        <button className="relative p-2 text-foreground-secondary hover:text-foreground hover:bg-muted rounded-lg transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full" />
        </button>

        {/* User menu */}
        <button className="flex items-center gap-2 p-2 text-foreground-secondary hover:text-foreground hover:bg-muted rounded-lg transition-colors">
          <div className="w-8 h-8 bg-primary-light rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-primary" />
          </div>
        </button>
      </div>
    </header>
  );
}
