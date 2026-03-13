-- ============================================================================
-- Migration: Harden multitenant RLS for core business tables
-- ============================================================================
-- Date: 2026-03-12
--
-- Problem:
--   Multiple core tables still had permissive authenticated policies with
--   USING (true) / WITH CHECK (true), which allows cross-tenant data access.
--
-- Fix:
--   Replace permissive policies with owner-scoped policies
--   (owner_id = auth.uid()) for authenticated users. Keep the restricted anon
--   booking policy on jobs, and remove anon SELECT access for portal tokens.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own customers" ON customers;
DROP POLICY IF EXISTS "Users can insert own customers" ON customers;
DROP POLICY IF EXISTS "Users can update own customers" ON customers;
DROP POLICY IF EXISTS "Users can delete own customers" ON customers;
DROP POLICY IF EXISTS "customers_authenticated_select" ON customers;
DROP POLICY IF EXISTS "customers_authenticated_insert" ON customers;
DROP POLICY IF EXISTS "customers_authenticated_update" ON customers;
DROP POLICY IF EXISTS "customers_authenticated_delete" ON customers;
DROP POLICY IF EXISTS "customers_owner_select" ON customers;
DROP POLICY IF EXISTS "customers_owner_insert" ON customers;
DROP POLICY IF EXISTS "customers_owner_update" ON customers;
DROP POLICY IF EXISTS "customers_owner_delete" ON customers;

CREATE POLICY "customers_owner_select"
  ON customers FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "customers_owner_insert"
  ON customers FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "customers_owner_update"
  ON customers FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "customers_owner_delete"
  ON customers FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- locations
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own locations" ON locations;
DROP POLICY IF EXISTS "Users can insert own locations" ON locations;
DROP POLICY IF EXISTS "Users can update own locations" ON locations;
DROP POLICY IF EXISTS "Users can delete own locations" ON locations;
DROP POLICY IF EXISTS "locations_authenticated_select" ON locations;
DROP POLICY IF EXISTS "locations_authenticated_insert" ON locations;
DROP POLICY IF EXISTS "locations_authenticated_update" ON locations;
DROP POLICY IF EXISTS "locations_authenticated_delete" ON locations;
DROP POLICY IF EXISTS "locations_owner_select" ON locations;
DROP POLICY IF EXISTS "locations_owner_insert" ON locations;
DROP POLICY IF EXISTS "locations_owner_update" ON locations;
DROP POLICY IF EXISTS "locations_owner_delete" ON locations;

CREATE POLICY "locations_owner_select"
  ON locations FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "locations_owner_insert"
  ON locations FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "locations_owner_update"
  ON locations FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "locations_owner_delete"
  ON locations FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- jobs
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role full access" ON jobs;
DROP POLICY IF EXISTS "Authenticated users can view jobs" ON jobs;
DROP POLICY IF EXISTS "Authenticated users can update jobs" ON jobs;
DROP POLICY IF EXISTS "jobs_authenticated_select" ON jobs;
DROP POLICY IF EXISTS "jobs_authenticated_insert" ON jobs;
DROP POLICY IF EXISTS "jobs_authenticated_update" ON jobs;
DROP POLICY IF EXISTS "jobs_authenticated_delete" ON jobs;
DROP POLICY IF EXISTS "jobs_owner_select" ON jobs;
DROP POLICY IF EXISTS "jobs_owner_insert" ON jobs;
DROP POLICY IF EXISTS "jobs_owner_update" ON jobs;
DROP POLICY IF EXISTS "jobs_owner_delete" ON jobs;

CREATE POLICY "jobs_owner_select"
  ON jobs FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "jobs_owner_insert"
  ON jobs FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "jobs_owner_update"
  ON jobs FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "jobs_owner_delete"
  ON jobs FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- Keep restricted public booking insert policy.
DROP POLICY IF EXISTS "jobs_anon_insert" ON jobs;
DROP POLICY IF EXISTS "jobs_anon_insert_restricted" ON jobs;
CREATE POLICY "jobs_anon_insert_restricted"
  ON jobs FOR INSERT TO anon
  WITH CHECK (
    phone_number IS NOT NULL
    AND phone_e164 IS NOT NULL
    AND status = 'new'
    AND assigned_technician_id IS NULL
    AND scheduled_at IS NULL
    AND is_spam = FALSE
    AND priority = 'normal'
    AND closed_at IS NULL
    AND source_event_id IS NULL
    AND estimate_id IS NULL
    AND recurring_job_id IS NULL
  );

-- ---------------------------------------------------------------------------
-- estimates
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "estimates_select" ON estimates;
DROP POLICY IF EXISTS "estimates_insert" ON estimates;
DROP POLICY IF EXISTS "estimates_update" ON estimates;
DROP POLICY IF EXISTS "estimates_delete" ON estimates;
DROP POLICY IF EXISTS "estimates_authenticated_select" ON estimates;
DROP POLICY IF EXISTS "estimates_authenticated_insert" ON estimates;
DROP POLICY IF EXISTS "estimates_authenticated_update" ON estimates;
DROP POLICY IF EXISTS "estimates_authenticated_delete" ON estimates;
DROP POLICY IF EXISTS "estimates_owner_select" ON estimates;
DROP POLICY IF EXISTS "estimates_owner_insert" ON estimates;
DROP POLICY IF EXISTS "estimates_owner_update" ON estimates;
DROP POLICY IF EXISTS "estimates_owner_delete" ON estimates;

CREATE POLICY "estimates_owner_select"
  ON estimates FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "estimates_owner_insert"
  ON estimates FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "estimates_owner_update"
  ON estimates FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "estimates_owner_delete"
  ON estimates FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- recurring_jobs
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "recurring_jobs_select" ON recurring_jobs;
DROP POLICY IF EXISTS "recurring_jobs_insert" ON recurring_jobs;
DROP POLICY IF EXISTS "recurring_jobs_update" ON recurring_jobs;
DROP POLICY IF EXISTS "recurring_jobs_delete" ON recurring_jobs;
DROP POLICY IF EXISTS "recurring_jobs_authenticated_select" ON recurring_jobs;
DROP POLICY IF EXISTS "recurring_jobs_authenticated_insert" ON recurring_jobs;
DROP POLICY IF EXISTS "recurring_jobs_authenticated_update" ON recurring_jobs;
DROP POLICY IF EXISTS "recurring_jobs_authenticated_delete" ON recurring_jobs;
DROP POLICY IF EXISTS "recurring_jobs_owner_select" ON recurring_jobs;
DROP POLICY IF EXISTS "recurring_jobs_owner_insert" ON recurring_jobs;
DROP POLICY IF EXISTS "recurring_jobs_owner_update" ON recurring_jobs;
DROP POLICY IF EXISTS "recurring_jobs_owner_delete" ON recurring_jobs;

CREATE POLICY "recurring_jobs_owner_select"
  ON recurring_jobs FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "recurring_jobs_owner_insert"
  ON recurring_jobs FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "recurring_jobs_owner_update"
  ON recurring_jobs FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "recurring_jobs_owner_delete"
  ON recurring_jobs FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "invoices_authenticated_select" ON invoices;
DROP POLICY IF EXISTS "invoices_authenticated_insert" ON invoices;
DROP POLICY IF EXISTS "invoices_authenticated_update" ON invoices;
DROP POLICY IF EXISTS "invoices_authenticated_delete" ON invoices;
DROP POLICY IF EXISTS "invoices_owner_select" ON invoices;
DROP POLICY IF EXISTS "invoices_owner_insert" ON invoices;
DROP POLICY IF EXISTS "invoices_owner_update" ON invoices;
DROP POLICY IF EXISTS "invoices_owner_delete" ON invoices;

CREATE POLICY "invoices_owner_select"
  ON invoices FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "invoices_owner_insert"
  ON invoices FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "invoices_owner_update"
  ON invoices FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "invoices_owner_delete"
  ON invoices FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- invoice_items
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "invoice_items_authenticated_select" ON invoice_items;
DROP POLICY IF EXISTS "invoice_items_authenticated_insert" ON invoice_items;
DROP POLICY IF EXISTS "invoice_items_authenticated_update" ON invoice_items;
DROP POLICY IF EXISTS "invoice_items_authenticated_delete" ON invoice_items;
DROP POLICY IF EXISTS "invoice_items_owner_select" ON invoice_items;
DROP POLICY IF EXISTS "invoice_items_owner_insert" ON invoice_items;
DROP POLICY IF EXISTS "invoice_items_owner_update" ON invoice_items;
DROP POLICY IF EXISTS "invoice_items_owner_delete" ON invoice_items;

CREATE POLICY "invoice_items_owner_select"
  ON invoice_items FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "invoice_items_owner_insert"
  ON invoice_items FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "invoice_items_owner_update"
  ON invoice_items FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "invoice_items_owner_delete"
  ON invoice_items FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "payments_authenticated_select" ON payments;
DROP POLICY IF EXISTS "payments_authenticated_insert" ON payments;
DROP POLICY IF EXISTS "payments_authenticated_update" ON payments;
DROP POLICY IF EXISTS "payments_authenticated_delete" ON payments;
DROP POLICY IF EXISTS "payments_owner_select" ON payments;
DROP POLICY IF EXISTS "payments_owner_insert" ON payments;
DROP POLICY IF EXISTS "payments_owner_update" ON payments;
DROP POLICY IF EXISTS "payments_owner_delete" ON payments;

CREATE POLICY "payments_owner_select"
  ON payments FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "payments_owner_insert"
  ON payments FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "payments_owner_update"
  ON payments FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "payments_owner_delete"
  ON payments FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- customer_portal_tokens
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "portal_tokens_authenticated_select" ON customer_portal_tokens;
DROP POLICY IF EXISTS "portal_tokens_authenticated_insert" ON customer_portal_tokens;
DROP POLICY IF EXISTS "portal_tokens_authenticated_update" ON customer_portal_tokens;
DROP POLICY IF EXISTS "portal_tokens_authenticated_delete" ON customer_portal_tokens;
DROP POLICY IF EXISTS "portal_tokens_anon_select" ON customer_portal_tokens;
DROP POLICY IF EXISTS "customer_portal_tokens_authenticated_select" ON customer_portal_tokens;
DROP POLICY IF EXISTS "customer_portal_tokens_authenticated_insert" ON customer_portal_tokens;
DROP POLICY IF EXISTS "customer_portal_tokens_authenticated_update" ON customer_portal_tokens;
DROP POLICY IF EXISTS "customer_portal_tokens_authenticated_delete" ON customer_portal_tokens;
DROP POLICY IF EXISTS "customer_portal_tokens_anon_select" ON customer_portal_tokens;
DROP POLICY IF EXISTS "portal_tokens_owner_select" ON customer_portal_tokens;
DROP POLICY IF EXISTS "portal_tokens_owner_insert" ON customer_portal_tokens;
DROP POLICY IF EXISTS "portal_tokens_owner_update" ON customer_portal_tokens;
DROP POLICY IF EXISTS "portal_tokens_owner_delete" ON customer_portal_tokens;

CREATE POLICY "portal_tokens_owner_select"
  ON customer_portal_tokens FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "portal_tokens_owner_insert"
  ON customer_portal_tokens FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "portal_tokens_owner_update"
  ON customer_portal_tokens FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "portal_tokens_owner_delete"
  ON customer_portal_tokens FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

COMMIT;
