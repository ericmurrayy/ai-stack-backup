'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Calendar, Briefcase, Users, Package, DollarSign,
  Settings, Plus, BarChart3, Phone, X
} from 'lucide-react';

interface Command {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  shortcut?: string;
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);

  const commands: Command[] = [
    { id: 'dashboard', label: 'Go to Dashboard', icon: BarChart3, action: () => router.push('/dashboard'), shortcut: 'G D' },
    { id: 'schedule', label: 'Go to Schedule', icon: Calendar, action: () => router.push('/schedule'), shortcut: 'G S' },
    { id: 'jobs', label: 'Go to Jobs', icon: Briefcase, action: () => router.push('/jobs'), shortcut: 'G J' },
    { id: 'customers', label: 'Go to Customers', icon: Users, action: () => router.push('/customers'), shortcut: 'G C' },
    { id: 'inventory', label: 'Go to Inventory', icon: Package, action: () => router.push('/inventory'), shortcut: 'G I' },
    { id: 'payments', label: 'Go to Payments', icon: DollarSign, action: () => router.push('/payments'), shortcut: 'G P' },
    { id: 'calls', label: 'Go to Calls', icon: Phone, action: () => router.push('/calls') },
    { id: 'settings', label: 'Go to Settings', icon: Settings, action: () => router.push('/settings') },
    { id: 'new-job', label: 'Create New Job', icon: Plus, action: () => router.push('/jobs/new'), shortcut: 'N J' },
  ];

  const filtered = commands.filter(cmd =>
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setIsOpen(prev => !prev);
      setQuery('');
      setSelectedIndex(0);
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }, []);

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      runCommand(filtered[selectedIndex]);
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const runCommand = (cmd: Command) => {
    cmd.action();
    setIsOpen(false);
    setQuery('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="fixed inset-0 bg-overlay" onClick={() => setIsOpen(false)} />
      <div className="relative w-full max-w-lg bg-surface rounded-xl shadow-2xl border border-border overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-5 h-5 text-foreground-tertiary" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search commands..."
            className="flex-1 bg-transparent outline-none text-foreground placeholder-foreground-tertiary"
            autoFocus
          />
          <kbd className="px-2 py-1 text-xs bg-muted rounded">ESC</kbd>
        </div>
        <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {filtered.map((cmd, index) => (
            <button
              key={cmd.id}
              onClick={() => runCommand(cmd)}
              className={`w-full flex items-center gap-3 px-4 py-2 transition-colors ${
                index === selectedIndex
                  ? 'bg-info-bg'
                  : 'hover:bg-muted'
              }`}
            >
              <cmd.icon className="w-4 h-4 text-foreground-tertiary" />
              <span className="flex-1 text-left text-foreground">{cmd.label}</span>
              {cmd.shortcut && (
                <kbd className="px-2 py-0.5 text-xs bg-muted rounded">{cmd.shortcut}</kbd>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-foreground-secondary">No commands found</div>
          )}
        </div>
        <div className="px-4 py-2 border-t border-border text-xs text-foreground-secondary">
          Press <kbd className="px-1 bg-muted rounded">↑↓</kbd> to navigate, <kbd className="px-1 bg-muted rounded">Enter</kbd> to select
        </div>
      </div>
    </div>
  );
}
