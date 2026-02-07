// Murray's FSM - Legend-State Store
// ===================================
// Offline-first state management with Supabase sync

import { observable } from '@legendapp/state';
import { configureObservableSync, synced, syncObservable } from '@legendapp/state/sync';
import { syncedSupabase } from '@legendapp/state/sync-plugins/supabase';
import { observablePersistAsyncStorage } from '@legendapp/state/persist-plugins/async-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import type {
  Customer,
  Location,
  Job,
  JobEvent,
  JobPhoto,
  JobSignature,
  LineItem,
  Payment,
  ActionQueueItem,
  CalendarEvent,
} from '../types';

// Configure Legend-State for persistence
const persistPlugin = observablePersistAsyncStorage({ AsyncStorage });

configureObservableSync({
  persist: {
    plugin: persistPlugin,
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
const createSupabaseSync = <T extends { id: string; updated_at: string }>(
  tableName: string,
  _options?: {
    filter?: (item: T) => boolean;
    transform?: (item: any) => T;
  }
) => {
  return syncedSupabase({
    supabase,
    collection: tableName as any,
    filter: (query) => query.eq('deleted', false),
    actions: ['read', 'create', 'update', 'delete'],
    realtime: true,
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
    fieldUpdatedAt: 'updated_at',
    fieldDeleted: 'deleted',
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

// Line Items store
export const lineItems$ = observable<Record<string, LineItem>>(
  synced({
    ...createSupabaseSync<LineItem>('line_items'),
    initial: {},
  })
);

// Payments store
export const payments$ = observable<Record<string, Payment>>(
  synced({
    ...createSupabaseSync<Payment>('payments'),
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
  return syncObservable(store, {});
};

// Helper selectors
export const getJobById = (id: string) => jobs$[id];

export const getJobsForToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return Object.values(jobs$.get() || {}).filter((job) => {
    if (!job.scheduled_start) return false;
    const scheduledDate = new Date(job.scheduled_start);
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
      if (!job.scheduled_start) return false;
      const scheduledDate = new Date(job.scheduled_start);
      return scheduledDate >= today && scheduledDate <= endDate;
    })
    .sort((a, b) => {
      const dateA = new Date(a.scheduled_start!);
      const dateB = new Date(b.scheduled_start!);
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

export const getLineItemsByJob = (jobId: string) => {
  return Object.values(lineItems$.get() || {}).filter(
    (item) => item.job_id === jobId
  );
};

export const getEstimateLineItems = (jobId: string) => {
  return getLineItemsByJob(jobId)
    .filter((item) => item.kind === 'estimate')
    .sort((a, b) => a.sort_order - b.sort_order);
};

export const getInvoiceLineItems = (jobId: string) => {
  return getLineItemsByJob(jobId)
    .filter((item) => item.kind === 'invoice')
    .sort((a, b) => a.sort_order - b.sort_order);
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

export const getPaymentsByJob = (jobId: string) => {
  return Object.values(payments$.get() || {}).filter(
    (payment) => payment.job_id === jobId
  );
};

export const getPendingActions = () => {
  return Object.values(actionQueue$.get() || {}).filter(
    (action) => action.status === 'pending'
  );
};
