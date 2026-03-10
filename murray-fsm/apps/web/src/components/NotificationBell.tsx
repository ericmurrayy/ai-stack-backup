'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatRelativeTime } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Notification {
  id: string;
  owner_id: string;
  title: string;
  body: string | null;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Type -> color mapping
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<string, string> = {
  job_assigned: 'bg-blue-500',
  job_completed: 'bg-green-500',
  payment_received: 'bg-green-500',
  review_received: 'bg-yellow-500',
  estimate_approved: 'bg-green-500',
  estimate_rejected: 'bg-red-500',
  low_stock: 'bg-orange-500',
  agreement_expiring: 'bg-yellow-500',
};

function getDotColor(type: string): string {
  return TYPE_COLORS[type] ?? 'bg-slate-400';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // ---- Fetch notifications ------------------------------------------------

  const fetchNotifications = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) {
      setNotifications(data as Notification[]);
      setUnreadCount(data.filter((n: Notification) => !n.is_read).length);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // ---- Click outside to close ---------------------------------------------

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ---- Mark single notification as read -----------------------------------

  async function markAsRead(notificationId: string) {
    const supabase = createClient();
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId);

    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId
          ? { ...n, is_read: true, read_at: new Date().toISOString() }
          : n,
      ),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  // ---- Mark all as read ---------------------------------------------------

  async function markAllRead() {
    const supabase = createClient();
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('is_read', false);

    setNotifications((prev) =>
      prev.map((n) => ({
        ...n,
        is_read: true,
        read_at: n.read_at ?? new Date().toISOString(),
      })),
    );
    setUnreadCount(0);
  }

  // ---- Render -------------------------------------------------------------

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />

        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-medium text-blue-600 hover:text-blue-800"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                No notifications
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!n.is_read) markAsRead(n.id);
                      }}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                        !n.is_read ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      {/* Type color dot */}
                      <span
                        className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${getDotColor(n.type)}`}
                      />

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900">
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="mt-0.5 truncate text-sm text-slate-500">
                            {n.body}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-slate-400">
                          {formatRelativeTime(n.created_at)}
                        </p>
                      </div>

                      {/* Unread indicator */}
                      {!n.is_read && (
                        <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 px-4 py-2 text-center">
            <span className="text-xs font-medium text-slate-400">
              View all notifications
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
