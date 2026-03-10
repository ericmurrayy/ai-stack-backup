-- ============================================================================
-- Migration: Restrict RLS on Sensitive Tables
-- ============================================================================
-- Date:    2026-03-10
-- Author:  Security hardening
--
-- PROBLEM:
--   Four sensitive tables had overly permissive RLS policies using
--   USING(true) / WITH CHECK(true). This means ANY authenticated user
--   could read/modify ALL rows, including rows belonging to other owners.
--
--   Affected tables:
--     1. api_keys          - Contains API key hashes, scopes, rate limits
--     2. webhook_endpoints - Contains webhook secrets and URLs
--     3. business_settings - Contains business configuration
--     4. profiles          - Contains user profile data
--
-- FIX:
--   Replace USING(true) with owner_id = auth.uid() so each user can
--   only access their own rows. The service_role key (used by Edge
--   Functions and server-side operations) bypasses RLS entirely, so
--   cross-tenant operations from trusted server code are unaffected.
--
-- NOTE ON service_role:
--   Supabase's service_role key bypasses RLS by default. Edge Functions
--   and server-side admin calls that use the service_role key will
--   continue to work without any policy changes. No explicit
--   service_role policies are needed.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. API_KEYS - Restrict to owner only
-- ============================================================================
-- API keys contain sensitive credentials (key hashes, scopes, rate limits).
-- Only the owner who created them should have access.

DROP POLICY IF EXISTS "api_keys_authenticated_select" ON api_keys;
DROP POLICY IF EXISTS "api_keys_authenticated_insert" ON api_keys;
DROP POLICY IF EXISTS "api_keys_authenticated_update" ON api_keys;
DROP POLICY IF EXISTS "api_keys_authenticated_delete" ON api_keys;

-- Legacy policy names (in case they exist from earlier migrations)
DROP POLICY IF EXISTS "Users can view own api_keys"   ON api_keys;
DROP POLICY IF EXISTS "Users can insert own api_keys"  ON api_keys;
DROP POLICY IF EXISTS "Users can update own api_keys"  ON api_keys;
DROP POLICY IF EXISTS "Users can delete own api_keys"  ON api_keys;

CREATE POLICY "api_keys_owner_select"
    ON api_keys FOR SELECT
    TO authenticated
    USING (owner_id = auth.uid());

CREATE POLICY "api_keys_owner_insert"
    ON api_keys FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "api_keys_owner_update"
    ON api_keys FOR UPDATE
    TO authenticated
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "api_keys_owner_delete"
    ON api_keys FOR DELETE
    TO authenticated
    USING (owner_id = auth.uid());


-- ============================================================================
-- 2. WEBHOOK_ENDPOINTS - Restrict to owner only
-- ============================================================================
-- Webhook endpoints contain secrets used for HMAC signing. Exposing these
-- to other authenticated users would allow them to forge webhook payloads.

DROP POLICY IF EXISTS "webhook_endpoints_authenticated_select" ON webhook_endpoints;
DROP POLICY IF EXISTS "webhook_endpoints_authenticated_insert" ON webhook_endpoints;
DROP POLICY IF EXISTS "webhook_endpoints_authenticated_update" ON webhook_endpoints;
DROP POLICY IF EXISTS "webhook_endpoints_authenticated_delete" ON webhook_endpoints;

-- Legacy policy names
DROP POLICY IF EXISTS "Users can view own webhook_endpoints"   ON webhook_endpoints;
DROP POLICY IF EXISTS "Users can insert own webhook_endpoints"  ON webhook_endpoints;
DROP POLICY IF EXISTS "Users can update own webhook_endpoints"  ON webhook_endpoints;
DROP POLICY IF EXISTS "Users can delete own webhook_endpoints"  ON webhook_endpoints;

CREATE POLICY "webhook_endpoints_owner_select"
    ON webhook_endpoints FOR SELECT
    TO authenticated
    USING (owner_id = auth.uid());

CREATE POLICY "webhook_endpoints_owner_insert"
    ON webhook_endpoints FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "webhook_endpoints_owner_update"
    ON webhook_endpoints FOR UPDATE
    TO authenticated
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "webhook_endpoints_owner_delete"
    ON webhook_endpoints FOR DELETE
    TO authenticated
    USING (owner_id = auth.uid());


-- ============================================================================
-- 3. BUSINESS_SETTINGS - Restrict authenticated access to owner only
-- ============================================================================
-- Business settings contain configuration for the business (name, phone,
-- email, referral settings). Only the owner should modify these.
--
-- The anon SELECT policy is PRESERVED because the public booking widget
-- needs to read business name, phone, hours, etc. Sensitive fields are
-- excluded at the application layer (API/Edge Function), not via RLS.

DROP POLICY IF EXISTS "business_settings_authenticated_select" ON business_settings;
DROP POLICY IF EXISTS "business_settings_authenticated_insert" ON business_settings;
DROP POLICY IF EXISTS "business_settings_authenticated_update" ON business_settings;
DROP POLICY IF EXISTS "business_settings_authenticated_delete" ON business_settings;

-- Legacy policy names
DROP POLICY IF EXISTS "Users can view own business_settings"   ON business_settings;
DROP POLICY IF EXISTS "Users can insert own business_settings"  ON business_settings;
DROP POLICY IF EXISTS "Users can update own business_settings"  ON business_settings;

-- NOTE: We do NOT drop "business_settings_anon_select" - it is intentionally
-- kept for the public booking widget. If it was already dropped by a previous
-- migration, the DROP IF EXISTS below is a safe no-op.
DROP POLICY IF EXISTS "business_settings_anon_select" ON business_settings;

-- Authenticated: owner only
CREATE POLICY "business_settings_owner_select"
    ON business_settings FOR SELECT
    TO authenticated
    USING (owner_id = auth.uid());

CREATE POLICY "business_settings_owner_insert"
    ON business_settings FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "business_settings_owner_update"
    ON business_settings FOR UPDATE
    TO authenticated
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "business_settings_owner_delete"
    ON business_settings FOR DELETE
    TO authenticated
    USING (owner_id = auth.uid());

-- Anon: SELECT only (booking widget)
CREATE POLICY "business_settings_anon_select"
    ON business_settings FOR SELECT
    TO anon
    USING (true);


-- ============================================================================
-- 4. PROFILES - Restrict to owner only
-- ============================================================================
-- Profiles contain user identity data. The SELECT policy allows a user to
-- see their own profile row (id = auth.uid()) OR any row where they are
-- the owner (owner_id = auth.uid()). This supports the case where an
-- owner creates team member profiles under their owner_id.
--
-- INSERT/UPDATE/DELETE restricted to rows the user owns.

DROP POLICY IF EXISTS "profiles_authenticated_select" ON profiles;
DROP POLICY IF EXISTS "profiles_authenticated_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_authenticated_update" ON profiles;
DROP POLICY IF EXISTS "profiles_authenticated_delete" ON profiles;

-- Legacy policy names
DROP POLICY IF EXISTS "Users can view own profile"   ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile"  ON profiles;
DROP POLICY IF EXISTS "Users can update own profile"  ON profiles;
DROP POLICY IF EXISTS "profiles_select"               ON profiles;
DROP POLICY IF EXISTS "profiles_insert"               ON profiles;
DROP POLICY IF EXISTS "profiles_update"               ON profiles;
DROP POLICY IF EXISTS "profiles_delete"               ON profiles;

CREATE POLICY "profiles_owner_select"
    ON profiles FOR SELECT
    TO authenticated
    USING (id = auth.uid() OR owner_id = auth.uid());

CREATE POLICY "profiles_owner_insert"
    ON profiles FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "profiles_owner_update"
    ON profiles FOR UPDATE
    TO authenticated
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "profiles_owner_delete"
    ON profiles FOR DELETE
    TO authenticated
    USING (owner_id = auth.uid());

COMMIT;
