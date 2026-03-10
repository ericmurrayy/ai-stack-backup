// Murray's FSM - Legend-State Store
// ===================================
// Offline-first state management with Supabase sync

import { observable, syncState } from '@legendapp/state';
import { configureSynced, synced } from '@legendapp/state/sync';
import { syncedSupabase } from '@legendapp/state/sync-plugins/supabase';
import { ObservablePersistAsyncStorage } from '@legendapp/state/persist-plugins/async-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import type {
  Customer,
  Location,
  Job,
  JobEvent,
  JobPhoto,
  JobSignature,
  Technician,
  InventoryItem,
  Notification,
  Estimate,
  ActionQueueItem,
  CalendarEvent,
} from '../types';

// Configure Legend-State for persistence
configureSynced({
  persist: {
    plugin: new ObservablePersistAsyncStorage({
      AsyncStorage,
    }),
  },
});

// App-level state (not synced)
export const appState$ = observable({
  isOnline: true,
  isSyncing: false,
  lastSyncTime: null as string | null,
  currentUserId: null as string | null,
  authLoading: true,
});

// Auth state
export const authState$ = observable({
  session: null as any,
  user: null as any,
  loading: true,
});

// Generate sync configuration for a table
const createSupabaseSync = <T extends { id: string }>(
  tableName: string,
  options?: {
    fieldUpdatedAt?: string | false;
    fieldDeleted?: string | false;
  }
) => {
  return syncedSupabase({
    supabase,
    collection: tableName,
    actions: ['read', 'create', 'update', 'delete'],
    realtime: {},
    persist: {
      name: `fsm_${tableName}`,
      retrySync: true,
    },
    retry: {
      infinite: true,
      backoff: 'exponential',
      maxDelay: 30000,
    },
    changesSince: 'last-sync',
    fieldCreatedAt: 'created_at',
    fieldUpdatedAt: options?.fieldUpdatedAt !== false ? (options?.fieldUpdatedAt ?? 'updated_at') : undefined,
    fieldDeleted: options?.fieldDeleted !== false ? (options?.fieldDeleted ?? 'deleted') : undefined,
  });
};

// Customers store
export const customers$ = observable<Record<string, Customer>>(
  synced({
    ...createSupabaseSync<Customer>('customers'),
    initial: {},
  })
);

// Locations store
export const locations$ = observable<Record<string, Location>>(
  synced({
    ...createSupabaseSync<Location>('locations'),
    initial: {},
  })
);

// Jobs store
export const jobs$ = observable<Record<string, Job>>(
  synced({
    ...createSupabaseSync<Job>('jobs'),
    initial: {},
  })
);

// Job Events store
export const jobEvents$ = observable<Record<string, JobEvent>>(
  synced({
    ...createSupabaseSync<JobEvent>('job_events'),
    initial: {},
  })
);

// Job Photos store (metadata only - actual files handled separately)
export const jobPhotos$ = observable<Record<string, JobPhoto>>(
  synced({
    ...createSupabaseSync<JobPhoto>('job_photos'),
    initial: {},
  })
);

// Job Signatures store (metadata only)
export const jobSignatures$ = observable<Record<string, JobSignature>>(
  synced({
    ...createSupabaseSync<JobSignature>('job_signatures'),
    initial: {},
  })
);

// Technicians store
export const technicians$ = observable<Record<string, Technician>>(
  synced({
    ...createSupabaseSync<Technician>('technicians', { fieldDeleted: false }),
    initial: {},
  })
);

// Inventory Items store
export const inventoryItems$ = observable<Record<string, InventoryItem>>(
  synced({
    ...createSupabaseSync<InventoryItem>('inventory_items', { fieldDeleted: false }),
    initial: {},
  })
);

// Notifications store
export const notifications$ = observable<Record<string, Notification>>(
  synced({
    ...createSupabaseSync<Notification>('notifications', { fieldUpdatedAt: false, fieldDeleted: false }),
    initial: {},
  })
);

// Estimates store
export const estimates$ = observable<Record<string, Estimate>>(
  synced({
    ...createSupabaseSync<Estimate>('estimates', { fieldDeleted: false }),
    initial: {},
  })
);

// Action Queue store (read-only from mobile)
export const actionQueue$ = observable<Record<string, ActionQueueItem>>(
  synced({
    ...createSupabaseSync<ActionQueueItem>('action_queue'),
    initial: {},
  })
);

// Calendar Events store
export const calendarEvents$ = observable<Record<string, CalendarEvent>>(
  synced({
    ...createSupabaseSync<CalendarEvent>('calendar_events'),
    initial: {},
  })
);

// Pending uploads queue (local only)
export const pendingUploads$ = observable<{
  photos: Array<{
    id: string;
    jobId: string;
    localUri: string;
    kind: string;
    caption?: string;
  }>;
  signatures: Array<{
    id: string;
    jobId: string;
    localUri: string;
    signerName: string;
  }>;
}>(
  synced({
    initial: { photos: [], signatures: [] },
    persist: {
      name: 'fsm_pending_uploads',
    },
  })
);

// Sync status helpers
export const getSyncState = (store: any) => {
  return syncState(store);
};

// Helper selectors
export const getJobById = (id: string) => jobs$[id];

export const getJobsForToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return Object.values(jobs$.get() || {}).filter((job) => {
    if (!job.scheduled_at) return false;
    const scheduledDate = new Date(job.scheduled_at);
    return scheduledDate >= today && scheduledDate < tomorrow;
  });
};

export const getUpcomingJobs = (days = 7) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + days);

  return Object.values(jobs$.get() || {})
    .filter((job) => {
      if (!job.scheduled_at) return false;
      const scheduledDate = new Date(job.scheduled_at);
      return scheduledDate >= today && scheduledDate <= endDate;
    })
    .sort((a, b) => {
      const dateA = new Date(a.scheduled_at!);
      const dateB = new Date(b.scheduled_at!);
      return dateA.getTime() - dateB.getTime();
    });
};

export const getCustomerById = (id: string) => customers$[id];

export const getLocationById = (id: string) => locations$[id];

export const getLocationsByCustomer = (customerId: string) => {
  return Object.values(locations$.get() || {}).filter(
    (loc) => loc.customer_id === customerId
  );
};

export const getPhotosByJob = (jobId: string) => {
  return Object.values(jobPhotos$.get() || {}).filter(
    (photo) => photo.job_id === jobId
  );
};

export const getSignaturesByJob = (jobId: string) => {
  return Object.values(jobSignatures$.get() || {}).filter(
    (sig) => sig.job_id === jobId
  );
};

export const getEstimatesByJob = (jobId: string) => {
  return Object.values(estimates$.get() || {}).filter(
    (estimate) => estimate.job_id === jobId
  );
};

export const getTechnicianById = (id: string) => technicians$[id];

export const getActiveTechnicians = () => {
  return Object.values(technicians$.get() || {}).filter(
    (tech) => tech.is_active
  );
};

export const getUnreadNotifications = () => {
  return Object.values(notifications$.get() || {}).filter(
    (n) => !n.is_read
  );
};

export const getInventoryLowStock = () => {
  return Object.values(inventoryItems$.get() || {}).filter(
    (item) => item.is_active && item.reorder_point != null && item.quantity_on_hand <= item.reorder_point
  );
};

export const getPendingActions = () => {
  return Object.values(actionQueue$.get() || {}).filter(
    (action) => action.status === 'pending'
  );
};
