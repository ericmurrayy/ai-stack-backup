// Murray's FSM - Job Hook
// ========================

import { useMemo } from 'react';
import { useSelector } from '@legendapp/state/react';
import {
  jobs$,
  customers$,
  locations$,
  lineItems$,
  jobPhotos$,
  jobSignatures$,
  payments$,
  appState$,
} from '../store';
import type { Job, JobWithRelations, LineItem } from '../types';

export const useJob = (jobId: string) => {
  const job = useSelector(() => jobs$[jobId]?.get());
  const isOnline = useSelector(() => appState$.isOnline.get());

  const customer = useSelector(() => {
    if (!job?.customer_id) return null;
    return customers$[job.customer_id]?.get();
  });

  const location = useSelector(() => {
    if (!job?.location_id) return null;
    return locations$[job.location_id]?.get();
  });

  const lineItemsList = useSelector(() => {
    const allItems = lineItems$.get() || {};
    return Object.values(allItems).filter((item) => item.job_id === jobId);
  });

  const photos = useSelector(() => {
    const allPhotos = jobPhotos$.get() || {};
    return Object.values(allPhotos).filter((photo) => photo.job_id === jobId);
  });

  const signatures = useSelector(() => {
    const allSigs = jobSignatures$.get() || {};
    return Object.values(allSigs).filter((sig) => sig.job_id === jobId);
  });

  const paymentsList = useSelector(() => {
    const allPayments = payments$.get() || {};
    return Object.values(allPayments).filter((payment) => payment.job_id === jobId);
  });

  const estimateItems = useMemo(
    () =>
      lineItemsList
        .filter((item) => item.kind === 'estimate')
        .sort((a, b) => a.sort_order - b.sort_order),
    [lineItemsList]
  );

  const invoiceItems = useMemo(
    () =>
      lineItemsList
        .filter((item) => item.kind === 'invoice')
        .sort((a, b) => a.sort_order - b.sort_order),
    [lineItemsList]
  );

  const estimateTotal = useMemo(
    () => estimateItems.reduce((sum, item) => sum + item.total_cents, 0),
    [estimateItems]
  );

  const invoiceTotal = useMemo(
    () => invoiceItems.reduce((sum, item) => sum + item.total_cents, 0),
    [invoiceItems]
  );

  const paidTotal = useMemo(
    () =>
      paymentsList
        .filter((p) => p.status === 'succeeded')
        .reduce((sum, p) => sum + p.amount_cents, 0),
    [paymentsList]
  );

  const balanceDue = invoiceTotal - paidTotal;

  // Update job
  const updateJob = (updates: Partial<Job>) => {
    if (!job) return;
    jobs$[jobId].set({
      ...job,
      ...updates,
      updated_at: new Date().toISOString(),
    });
  };

  // Update job status
  const updateStatus = (status: Job['status']) => {
    const now = new Date().toISOString();
    const updates: Partial<Job> = { status };

    if (status === 'in_progress' && !job?.started_at) {
      updates.started_at = now;
    }
    if (status === 'completed' && !job?.completed_at) {
      updates.completed_at = now;
    }

    updateJob(updates);
  };

  // Mark arrived
  const markArrived = () => {
    updateJob({ arrived_at: new Date().toISOString() });
  };

  // Add line item
  const addLineItem = (item: Omit<LineItem, 'id' | 'owner_id' | 'created_at' | 'updated_at' | 'deleted' | 'total_cents' | 'job_id'>) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const ownerId = appState$.currentUserId.get();

    if (!ownerId) return;

    lineItems$[id].set({
      id,
      owner_id: ownerId,
      job_id: jobId,
      ...item,
      total_cents: Math.round(item.qty * item.unit_price_cents),
      created_at: now,
      updated_at: now,
      deleted: false,
    });
  };

  // Update line item
  const updateLineItem = (itemId: string, updates: Partial<LineItem>) => {
    const existing = lineItems$[itemId].get();
    if (!existing) return;

    lineItems$[itemId].set({
      ...existing,
      ...updates,
      total_cents: Math.round((updates.qty ?? existing.qty) * (updates.unit_price_cents ?? existing.unit_price_cents)),
      updated_at: new Date().toISOString(),
    });
  };

  // Delete line item
  const deleteLineItem = (itemId: string) => {
    const existing = lineItems$[itemId].get();
    if (!existing) return;

    lineItems$[itemId].set({
      ...existing,
      deleted: true,
      updated_at: new Date().toISOString(),
    });
  };

  return {
    job,
    customer,
    location,
    estimateItems,
    invoiceItems,
    photos,
    signatures,
    payments: paymentsList,
    estimateTotal,
    invoiceTotal,
    paidTotal,
    balanceDue,
    isOnline,
    updateJob,
    updateStatus,
    markArrived,
    addLineItem,
    updateLineItem,
    deleteLineItem,
  };
};
