'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ---------- Types ----------

export interface DispatchTechnician {
  id: string;
  name: string;
  color: string;
  skills: string[];
  is_active: boolean;
  phone: string | null;
}

export interface DispatchJob {
  id: string;
  title: string;
  status: string;
  service_category: string | null;
  urgency: string;
  scheduled_at: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  assigned_technician_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  address: string | null;
  description: string | null;
  created_at: string;
}

export interface UseDispatchRealtimeOptions {
  initialJobs: DispatchJob[];
  initialTechnicians: DispatchTechnician[];
  targetDate: string; // YYYY-MM-DD
}

export interface UseDispatchRealtimeReturn {
  jobs: DispatchJob[];
  technicians: DispatchTechnician[];
  isConnected: boolean;
}

// ---------- Hook ----------

export function useDispatchRealtime({
  initialJobs,
  initialTechnicians,
  targetDate,
}: UseDispatchRealtimeOptions): UseDispatchRealtimeReturn {
  const [jobs, setJobs] = useState<DispatchJob[]>(initialJobs);
  const [technicians, setTechnicians] = useState<DispatchTechnician[]>(initialTechnicians);
  const [isConnected, setIsConnected] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);

  // Sync with new server data when initialJobs/initialTechnicians change
  // (e.g., when Next.js re-renders the server component on navigation)
  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  useEffect(() => {
    setTechnicians(initialTechnicians);
  }, [initialTechnicians]);

  // Compute the day boundaries for filtering
  const getDayBounds = useCallback((dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    return { dayStart, dayEnd };
  }, []);

  // Check if a job belongs to the target date
  const isJobForDate = useCallback(
    (job: { scheduled_at?: string | null; scheduled_start?: string | null; created_at?: string | null }, dateStr: string): boolean => {
      const { dayStart, dayEnd } = getDayBounds(dateStr);
      const startMs = dayStart.getTime();
      const endMs = dayEnd.getTime();

      // Check scheduled_start
      if (job.scheduled_start) {
        const t = new Date(job.scheduled_start).getTime();
        if (t >= startMs && t < endMs) return true;
      }
      // Check scheduled_at
      if (job.scheduled_at) {
        const t = new Date(job.scheduled_at).getTime();
        if (t >= startMs && t < endMs) return true;
      }
      // Fallback: unscheduled jobs created today
      if (!job.scheduled_at && !job.scheduled_start && job.created_at) {
        const t = new Date(job.created_at).getTime();
        if (t >= startMs && t < endMs) return true;
      }
      return false;
    },
    [getDayBounds],
  );

  // ---- Subscription ----

  useEffect(() => {
    const supabase = createClient();

    // Clean up previous channel if any
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      setIsConnected(false);
    }

    const channelName = `dispatch-realtime-${targetDate}`;

    const channel = supabase
      .channel(channelName)
      // ---- Jobs: INSERT ----
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'jobs',
        },
        (payload) => {
          const newRow = payload.new as Record<string, any>;

          // Build a DispatchJob from the raw row.
          // Realtime payloads include column values but NOT joined relations,
          // so customer_name / address will be null until the next full refresh.
          const newJob: DispatchJob = {
            id: newRow.id,
            title: newRow.title ?? 'New Job',
            status: newRow.status ?? 'new',
            service_category: newRow.service_category ?? null,
            urgency: newRow.urgency ?? 'medium',
            scheduled_at: newRow.scheduled_at ?? null,
            scheduled_start: newRow.scheduled_start ?? null,
            scheduled_end: newRow.scheduled_end ?? null,
            assigned_technician_id: newRow.assigned_technician_id ?? null,
            customer_name: null, // Not available from realtime payload
            customer_phone: null,
            address: null,
            description: newRow.description ?? null,
            created_at: newRow.created_at ?? new Date().toISOString(),
          };

          // Only add if it belongs to the current target date
          if (isJobForDate(newJob, targetDate) && !newRow.is_spam) {
            setJobs((prev) => {
              // Guard against duplicates
              if (prev.some((j) => j.id === newJob.id)) return prev;
              return [...prev, newJob];
            });
          }
        },
      )
      // ---- Jobs: UPDATE ----
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
        },
        (payload) => {
          const updated = payload.new as Record<string, any>;

          setJobs((prev) => {
            // If the updated job was cancelled or marked spam, remove it
            if (updated.status === 'cancelled' || updated.is_spam) {
              return prev.filter((j) => j.id !== updated.id);
            }

            const exists = prev.find((j) => j.id === updated.id);

            if (exists) {
              // Update existing job in place, preserving joined fields
              return prev.map((j) => {
                if (j.id !== updated.id) return j;
                return {
                  ...j,
                  title: updated.title ?? j.title,
                  status: updated.status ?? j.status,
                  service_category: updated.service_category ?? j.service_category,
                  urgency: updated.urgency ?? j.urgency,
                  scheduled_at: updated.scheduled_at ?? j.scheduled_at,
                  scheduled_start: updated.scheduled_start ?? j.scheduled_start,
                  scheduled_end: updated.scheduled_end ?? j.scheduled_end,
                  assigned_technician_id: updated.assigned_technician_id ?? j.assigned_technician_id,
                  description: updated.description ?? j.description,
                };
              });
            } else {
              // Job was reassigned/rescheduled into today -- add it
              if (isJobForDate(updated, targetDate) && updated.status !== 'cancelled' && !updated.is_spam) {
                const newJob: DispatchJob = {
                  id: updated.id,
                  title: updated.title ?? 'Job',
                  status: updated.status ?? 'new',
                  service_category: updated.service_category ?? null,
                  urgency: updated.urgency ?? 'medium',
                  scheduled_at: updated.scheduled_at ?? null,
                  scheduled_start: updated.scheduled_start ?? null,
                  scheduled_end: updated.scheduled_end ?? null,
                  assigned_technician_id: updated.assigned_technician_id ?? null,
                  customer_name: null,
                  customer_phone: null,
                  address: null,
                  description: updated.description ?? null,
                  created_at: updated.created_at ?? new Date().toISOString(),
                };
                return [...prev, newJob];
              }
              return prev;
            }
          });
        },
      )
      // ---- Jobs: DELETE ----
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'jobs',
        },
        (payload) => {
          const deletedId = (payload.old as Record<string, any>).id;
          if (deletedId) {
            setJobs((prev) => prev.filter((j) => j.id !== deletedId));
          }
        },
      )
      // ---- Technicians: UPDATE ----
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'technicians',
        },
        (payload) => {
          const updated = payload.new as Record<string, any>;

          setTechnicians((prev) => {
            // If technician was deactivated or deleted, remove from list
            if (updated.deleted || !updated.is_active) {
              return prev.filter((t) => t.id !== updated.id);
            }

            const exists = prev.find((t) => t.id === updated.id);
            if (exists) {
              return prev.map((t) => {
                if (t.id !== updated.id) return t;
                return {
                  ...t,
                  name: updated.name ?? t.name,
                  color: updated.color ?? t.color,
                  skills: updated.skills ?? t.skills,
                  is_active: updated.is_active ?? t.is_active,
                  phone: updated.phone ?? t.phone,
                };
              });
            } else {
              // Newly activated technician
              if (updated.is_active && !updated.deleted) {
                return [
                  ...prev,
                  {
                    id: updated.id,
                    name: updated.name ?? 'Technician',
                    color: updated.color ?? '#6366f1',
                    skills: updated.skills ?? [],
                    is_active: true,
                    phone: updated.phone ?? null,
                  },
                ].sort((a, b) => a.name.localeCompare(b.name));
              }
              return prev;
            }
          });
        },
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    // Cleanup on unmount or when targetDate changes
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      setIsConnected(false);
    };
  }, [targetDate, isJobForDate]);

  return { jobs, technicians, isConnected };
}
