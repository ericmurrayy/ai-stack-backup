// Murray's FSM - Notification Counts Hook
// ========================================

'use client';

import { useState, useEffect, useCallback } from 'react';

interface NotificationCounts {
  pendingApprovals: number;
  missedCalls: number;
  unreadMessages: number;
}

export function useNotificationCounts(refreshInterval = 30000) {
  const [counts, setCounts] = useState<NotificationCounts>({
    pendingApprovals: 0,
    missedCalls: 0,
    unreadMessages: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchCounts = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/count');
      if (response.ok) {
        const data = await response.json();
        setCounts(data);
      }
    } catch (error) {
      console.error('Error fetching notification counts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCounts();

    // Set up polling interval
    const interval = setInterval(fetchCounts, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchCounts, refreshInterval]);

  return { counts, loading, refetch: fetchCounts };
}
