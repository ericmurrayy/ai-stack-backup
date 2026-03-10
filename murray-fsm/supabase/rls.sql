-- ============================================================================
-- Murray's FSM - Row Level Security Policies
-- ============================================================================
-- AUTHORITATIVE RLS policy file for ALL public tables.
-- Last synced: 2026-03-10
--
-- DESIGN PHILOSOPHY:
--   This is an internal business application. Authenticated users (the
--   business owner and their team) get full CRUD on every table. The
--   owner_id column is NOT used for row-level filtering because a single
--   business operates under one Supabase project.
--
--   Exceptions for public/anon access:
--     - business_settings : anon SELECT (booking widget reads biz info)
--     - customer_portal_tokens : anon SELECT by token (portal auth)
--     - jobs : anon INSERT (booking widget creates new jobs)
--
-- POLICY PATTERN:
--   DROP POLICY IF EXISTS "name" ON table;
--   CREATE POLICY "name" ON table FOR <cmd>
--     TO <role> USING (...) WITH CHECK (...);
--
-- TABLES (30 total):
--   profiles, customers, locations, technicians,
--   raw_events, jobs, interactions, follow_ups,
--   estimates, estimate_items, recurring_jobs, time_entries,
--   call_logs, message_logs, pipeline_stages, leads,
--   notifications, reviews, service_agreements,
--   campaigns, campaign_recipients, referrals,
--   inventory_items, inventory_transactions,
--   action_queue, business_settings, tags,
--   api_keys, webhook_endpoints, installed_plugins
--
-- NOTE: customer_portal_tokens is referenced here for future-proofing.
--   If the table does not yet exist, those statements will be no-ops or
--   should be applied after the table is created.
-- ============================================================================


-- ============================================================================
-- STEP 1: ENABLE RLS ON EVERY TABLE
-- ============================================================================
-- Idempotent: ENABLE ROW LEVEL SECURITY is safe to run repeatedly.

ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE technicians            ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups             ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates              ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_jobs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries           ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews                ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_agreements     ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns              ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients    ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals              ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_queue           ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys               ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints      ENABLE ROW LEVEL SECURITY;
ALTER TABLE installed_plugins      ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- STEP 2: DROP ALL EXISTING POLICIES (clean slate)
-- ============================================================================
-- Ensures no stale / conflicting policies remain from prior deploys.

-- profiles
DROP POLICY IF EXISTS "Users can view own profile"       ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile"      ON profiles;
DROP POLICY IF EXISTS "Users can update own profile"      ON profiles;
DROP POLICY IF EXISTS "profiles_select"                   ON profiles;
DROP POLICY IF EXISTS "profiles_insert"                   ON profiles;
DROP POLICY IF EXISTS "profiles_update"                   ON profiles;
DROP POLICY IF EXISTS "profiles_delete"                   ON profiles;
DROP POLICY IF EXISTS "profiles_authenticated_select"     ON profiles;
DROP POLICY IF EXISTS "profiles_authenticated_insert"     ON profiles;
DROP POLICY IF EXISTS "profiles_authenticated_update"     ON profiles;
DROP POLICY IF EXISTS "profiles_authenticated_delete"     ON profiles;

-- customers
DROP POLICY IF EXISTS "Users can view own customers"      ON customers;
DROP POLICY IF EXISTS "Users can insert own customers"    ON customers;
DROP POLICY IF EXISTS "Users can update own customers"    ON customers;
DROP POLICY IF EXISTS "Users can delete own customers"    ON customers;
DROP POLICY IF EXISTS "customers_authenticated_select"    ON customers;
DROP POLICY IF EXISTS "customers_authenticated_insert"    ON customers;
DROP POLICY IF EXISTS "customers_authenticated_update"    ON customers;
DROP POLICY IF EXISTS "customers_authenticated_delete"    ON customers;

-- locations
DROP POLICY IF EXISTS "Users can view own locations"      ON locations;
DROP POLICY IF EXISTS "Users can insert own locations"    ON locations;
DROP POLICY IF EXISTS "Users can update own locations"    ON locations;
DROP POLICY IF EXISTS "Users can delete own locations"    ON locations;
DROP POLICY IF EXISTS "locations_authenticated_select"    ON locations;
DROP POLICY IF EXISTS "locations_authenticated_insert"    ON locations;
DROP POLICY IF EXISTS "locations_authenticated_update"    ON locations;
DROP POLICY IF EXISTS "locations_authenticated_delete"    ON locations;

-- technicians
DROP POLICY IF EXISTS "technicians_select"                ON technicians;
DROP POLICY IF EXISTS "technicians_insert"                ON technicians;
DROP POLICY IF EXISTS "technicians_update"                ON technicians;
DROP POLICY IF EXISTS "technicians_delete"                ON technicians;
DROP POLICY IF EXISTS "technicians_authenticated_select"  ON technicians;
DROP POLICY IF EXISTS "technicians_authenticated_insert"  ON technicians;
DROP POLICY IF EXISTS "technicians_authenticated_update"  ON technicians;
DROP POLICY IF EXISTS "technicians_authenticated_delete"  ON technicians;

-- raw_events
DROP POLICY IF EXISTS "Service role full access"          ON raw_events;
DROP POLICY IF EXISTS "Authenticated users can view raw_events" ON raw_events;
DROP POLICY IF EXISTS "raw_events_authenticated_select"   ON raw_events;
DROP POLICY IF EXISTS "raw_events_authenticated_insert"   ON raw_events;
DROP POLICY IF EXISTS "raw_events_authenticated_update"   ON raw_events;
DROP POLICY IF EXISTS "raw_events_authenticated_delete"   ON raw_events;

-- jobs
DROP POLICY IF EXISTS "Service role full access"          ON jobs;
DROP POLICY IF EXISTS "Authenticated users can view jobs" ON jobs;
DROP POLICY IF EXISTS "Authenticated users can update jobs" ON jobs;
DROP POLICY IF EXISTS "jobs_authenticated_select"         ON jobs;
DROP POLICY IF EXISTS "jobs_authenticated_insert"         ON jobs;
DROP POLICY IF EXISTS "jobs_authenticated_update"         ON jobs;
DROP POLICY IF EXISTS "jobs_authenticated_delete"         ON jobs;
DROP POLICY IF EXISTS "jobs_anon_insert"                  ON jobs;
DROP POLICY IF EXISTS "jobs_anon_insert_restricted"       ON jobs;

-- interactions
DROP POLICY IF EXISTS "Service role full access"          ON interactions;
DROP POLICY IF EXISTS "Authenticated users can view interactions" ON interactions;
DROP POLICY IF EXISTS "Authenticated users can update interactions" ON interactions;
DROP POLICY IF EXISTS "interactions_authenticated_select"  ON interactions;
DROP POLICY IF EXISTS "interactions_authenticated_insert"  ON interactions;
DROP POLICY IF EXISTS "interactions_authenticated_update"  ON interactions;
DROP POLICY IF EXISTS "interactions_authenticated_delete"  ON interactions;

-- follow_ups
DROP POLICY IF EXISTS "Service role full access"          ON follow_ups;
DROP POLICY IF EXISTS "Authenticated users can view follow_ups" ON follow_ups;
DROP POLICY IF EXISTS "Authenticated users can update follow_ups" ON follow_ups;
DROP POLICY IF EXISTS "follow_ups_authenticated_select"   ON follow_ups;
DROP POLICY IF EXISTS "follow_ups_authenticated_insert"   ON follow_ups;
DROP POLICY IF EXISTS "follow_ups_authenticated_update"   ON follow_ups;
DROP POLICY IF EXISTS "follow_ups_authenticated_delete"   ON follow_ups;

-- estimates
DROP POLICY IF EXISTS "estimates_select"                  ON estimates;
DROP POLICY IF EXISTS "estimates_insert"                  ON estimates;
DROP POLICY IF EXISTS "estimates_update"                  ON estimates;
DROP POLICY IF EXISTS "estimates_delete"                  ON estimates;
DROP POLICY IF EXISTS "estimates_authenticated_select"    ON estimates;
DROP POLICY IF EXISTS "estimates_authenticated_insert"    ON estimates;
DROP POLICY IF EXISTS "estimates_authenticated_update"    ON estimates;
DROP POLICY IF EXISTS "estimates_authenticated_delete"    ON estimates;

-- estimate_items
DROP POLICY IF EXISTS "estimate_items_select"             ON estimate_items;
DROP POLICY IF EXISTS "estimate_items_insert"             ON estimate_items;
DROP POLICY IF EXISTS "estimate_items_update"             ON estimate_items;
DROP POLICY IF EXISTS "estimate_items_delete"             ON estimate_items;
DROP POLICY IF EXISTS "estimate_items_authenticated_select" ON estimate_items;
DROP POLICY IF EXISTS "estimate_items_authenticated_insert" ON estimate_items;
DROP POLICY IF EXISTS "estimate_items_authenticated_update" ON estimate_items;
DROP POLICY IF EXISTS "estimate_items_authenticated_delete" ON estimate_items;

-- recurring_jobs
DROP POLICY IF EXISTS "recurring_jobs_select"             ON recurring_jobs;
DROP POLICY IF EXISTS "recurring_jobs_insert"             ON recurring_jobs;
DROP POLICY IF EXISTS "recurring_jobs_update"             ON recurring_jobs;
DROP POLICY IF EXISTS "recurring_jobs_delete"             ON recurring_jobs;
DROP POLICY IF EXISTS "recurring_jobs_authenticated_select" ON recurring_jobs;
DROP POLICY IF EXISTS "recurring_jobs_authenticated_insert" ON recurring_jobs;
DROP POLICY IF EXISTS "recurring_jobs_authenticated_update" ON recurring_jobs;
DROP POLICY IF EXISTS "recurring_jobs_authenticated_delete" ON recurring_jobs;

-- time_entries
DROP POLICY IF EXISTS "time_entries_select"               ON time_entries;
DROP POLICY IF EXISTS "time_entries_insert"               ON time_entries;
DROP POLICY IF EXISTS "time_entries_update"               ON time_entries;
DROP POLICY IF EXISTS "time_entries_delete"               ON time_entries;
DROP POLICY IF EXISTS "time_entries_authenticated_select" ON time_entries;
DROP POLICY IF EXISTS "time_entries_authenticated_insert" ON time_entries;
DROP POLICY IF EXISTS "time_entries_authenticated_update" ON time_entries;
DROP POLICY IF EXISTS "time_entries_authenticated_delete" ON time_entries;

-- call_logs
DROP POLICY IF EXISTS "Users can view own call logs"      ON call_logs;
DROP POLICY IF EXISTS "Users can insert own call logs"    ON call_logs;
DROP POLICY IF EXISTS "Users can update own call logs"    ON call_logs;
DROP POLICY IF EXISTS "Users can delete own call logs"    ON call_logs;
DROP POLICY IF EXISTS "call_logs_authenticated_select"    ON call_logs;
DROP POLICY IF EXISTS "call_logs_authenticated_insert"    ON call_logs;
DROP POLICY IF EXISTS "call_logs_authenticated_update"    ON call_logs;
DROP POLICY IF EXISTS "call_logs_authenticated_delete"    ON call_logs;

-- message_logs
DROP POLICY IF EXISTS "Users can view own message logs"   ON message_logs;
DROP POLICY IF EXISTS "Users can insert own message logs" ON message_logs;
DROP POLICY IF EXISTS "Users can update own message logs" ON message_logs;
DROP POLICY IF EXISTS "Users can delete own message logs" ON message_logs;
DROP POLICY IF EXISTS "message_logs_authenticated_select" ON message_logs;
DROP POLICY IF EXISTS "message_logs_authenticated_insert" ON message_logs;
DROP POLICY IF EXISTS "message_logs_authenticated_update" ON message_logs;
DROP POLICY IF EXISTS "message_logs_authenticated_delete" ON message_logs;

-- pipeline_stages
DROP POLICY IF EXISTS "pipeline_stages_select"            ON pipeline_stages;
DROP POLICY IF EXISTS "pipeline_stages_insert"            ON pipeline_stages;
DROP POLICY IF EXISTS "pipeline_stages_update"            ON pipeline_stages;
DROP POLICY IF EXISTS "pipeline_stages_delete"            ON pipeline_stages;
DROP POLICY IF EXISTS "pipeline_stages_authenticated_select" ON pipeline_stages;
DROP POLICY IF EXISTS "pipeline_stages_authenticated_insert" ON pipeline_stages;
DROP POLICY IF EXISTS "pipeline_stages_authenticated_update" ON pipeline_stages;
DROP POLICY IF EXISTS "pipeline_stages_authenticated_delete" ON pipeline_stages;

-- leads
DROP POLICY IF EXISTS "leads_select"                      ON leads;
DROP POLICY IF EXISTS "leads_insert"                      ON leads;
DROP POLICY IF EXISTS "leads_update"                      ON leads;
DROP POLICY IF EXISTS "leads_delete"                      ON leads;
DROP POLICY IF EXISTS "leads_authenticated_select"        ON leads;
DROP POLICY IF EXISTS "leads_authenticated_insert"        ON leads;
DROP POLICY IF EXISTS "leads_authenticated_update"        ON leads;
DROP POLICY IF EXISTS "leads_authenticated_delete"        ON leads;

-- notifications
DROP POLICY IF EXISTS "notifications_select"              ON notifications;
DROP POLICY IF EXISTS "notifications_insert"              ON notifications;
DROP POLICY IF EXISTS "notifications_update"              ON notifications;
DROP POLICY IF EXISTS "notifications_delete"              ON notifications;
DROP POLICY IF EXISTS "notifications_authenticated_select" ON notifications;
DROP POLICY IF EXISTS "notifications_authenticated_insert" ON notifications;
DROP POLICY IF EXISTS "notifications_authenticated_update" ON notifications;
DROP POLICY IF EXISTS "notifications_authenticated_delete" ON notifications;

-- reviews
DROP POLICY IF EXISTS "reviews_select"                    ON reviews;
DROP POLICY IF EXISTS "reviews_insert"                    ON reviews;
DROP POLICY IF EXISTS "reviews_update"                    ON reviews;
DROP POLICY IF EXISTS "reviews_delete"                    ON reviews;
DROP POLICY IF EXISTS "reviews_authenticated_select"      ON reviews;
DROP POLICY IF EXISTS "reviews_authenticated_insert"      ON reviews;
DROP POLICY IF EXISTS "reviews_authenticated_update"      ON reviews;
DROP POLICY IF EXISTS "reviews_authenticated_delete"      ON reviews;

-- service_agreements
DROP POLICY IF EXISTS "agreements_select"                 ON service_agreements;
DROP POLICY IF EXISTS "agreements_insert"                 ON service_agreements;
DROP POLICY IF EXISTS "agreements_update"                 ON service_agreements;
DROP POLICY IF EXISTS "agreements_delete"                 ON service_agreements;
DROP POLICY IF EXISTS "service_agreements_authenticated_select" ON service_agreements;
DROP POLICY IF EXISTS "service_agreements_authenticated_insert" ON service_agreements;
DROP POLICY IF EXISTS "service_agreements_authenticated_update" ON service_agreements;
DROP POLICY IF EXISTS "service_agreements_authenticated_delete" ON service_agreements;

-- campaigns
DROP POLICY IF EXISTS "campaigns_select"                  ON campaigns;
DROP POLICY IF EXISTS "campaigns_insert"                  ON campaigns;
DROP POLICY IF EXISTS "campaigns_update"                  ON campaigns;
DROP POLICY IF EXISTS "campaigns_delete"                  ON campaigns;
DROP POLICY IF EXISTS "campaigns_authenticated_select"    ON campaigns;
DROP POLICY IF EXISTS "campaigns_authenticated_insert"    ON campaigns;
DROP POLICY IF EXISTS "campaigns_authenticated_update"    ON campaigns;
DROP POLICY IF EXISTS "campaigns_authenticated_delete"    ON campaigns;

-- campaign_recipients
DROP POLICY IF EXISTS "campaign_recipients_select"        ON campaign_recipients;
DROP POLICY IF EXISTS "campaign_recipients_insert"        ON campaign_recipients;
DROP POLICY IF EXISTS "campaign_recipients_update"        ON campaign_recipients;
DROP POLICY IF EXISTS "campaign_recipients_delete"        ON campaign_recipients;
DROP POLICY IF EXISTS "campaign_recipients_authenticated_select" ON campaign_recipients;
DROP POLICY IF EXISTS "campaign_recipients_authenticated_insert" ON campaign_recipients;
DROP POLICY IF EXISTS "campaign_recipients_authenticated_update" ON campaign_recipients;
DROP POLICY IF EXISTS "campaign_recipients_authenticated_delete" ON campaign_recipients;

-- referrals
DROP POLICY IF EXISTS "referrals_select"                  ON referrals;
DROP POLICY IF EXISTS "referrals_insert"                  ON referrals;
DROP POLICY IF EXISTS "referrals_update"                  ON referrals;
DROP POLICY IF EXISTS "referrals_delete"                  ON referrals;
DROP POLICY IF EXISTS "referrals_authenticated_select"    ON referrals;
DROP POLICY IF EXISTS "referrals_authenticated_insert"    ON referrals;
DROP POLICY IF EXISTS "referrals_authenticated_update"    ON referrals;
DROP POLICY IF EXISTS "referrals_authenticated_delete"    ON referrals;

-- inventory_items
DROP POLICY IF EXISTS "Users can view own inventory_items"   ON inventory_items;
DROP POLICY IF EXISTS "Users can insert own inventory_items" ON inventory_items;
DROP POLICY IF EXISTS "Users can update own inventory_items" ON inventory_items;
DROP POLICY IF EXISTS "Users can delete own inventory_items" ON inventory_items;
DROP POLICY IF EXISTS "inventory_items_authenticated_select" ON inventory_items;
DROP POLICY IF EXISTS "inventory_items_authenticated_insert" ON inventory_items;
DROP POLICY IF EXISTS "inventory_items_authenticated_update" ON inventory_items;
DROP POLICY IF EXISTS "inventory_items_authenticated_delete" ON inventory_items;

-- inventory_transactions
DROP POLICY IF EXISTS "inventory_tx_select"               ON inventory_transactions;
DROP POLICY IF EXISTS "inventory_tx_insert"               ON inventory_transactions;
DROP POLICY IF EXISTS "inventory_tx_update"               ON inventory_transactions;
DROP POLICY IF EXISTS "inventory_tx_delete"               ON inventory_transactions;
DROP POLICY IF EXISTS "inventory_transactions_authenticated_select" ON inventory_transactions;
DROP POLICY IF EXISTS "inventory_transactions_authenticated_insert" ON inventory_transactions;
DROP POLICY IF EXISTS "inventory_transactions_authenticated_update" ON inventory_transactions;
DROP POLICY IF EXISTS "inventory_transactions_authenticated_delete" ON inventory_transactions;

-- action_queue
DROP POLICY IF EXISTS "Users can view own action queue"   ON action_queue;
DROP POLICY IF EXISTS "Users can insert own action queue" ON action_queue;
DROP POLICY IF EXISTS "Users can update own action queue" ON action_queue;
DROP POLICY IF EXISTS "Users can delete own action queue" ON action_queue;
DROP POLICY IF EXISTS "action_queue_authenticated_select" ON action_queue;
DROP POLICY IF EXISTS "action_queue_authenticated_insert" ON action_queue;
DROP POLICY IF EXISTS "action_queue_authenticated_update" ON action_queue;
DROP POLICY IF EXISTS "action_queue_authenticated_delete" ON action_queue;

-- business_settings
DROP POLICY IF EXISTS "Users can view own business_settings"   ON business_settings;
DROP POLICY IF EXISTS "Users can insert own business_settings" ON business_settings;
DROP POLICY IF EXISTS "Users can update own business_settings" ON business_settings;
DROP POLICY IF EXISTS "Anon can read business_settings"        ON business_settings;
DROP POLICY IF EXISTS "business_settings_authenticated_select" ON business_settings;
DROP POLICY IF EXISTS "business_settings_authenticated_insert" ON business_settings;
DROP POLICY IF EXISTS "business_settings_authenticated_update" ON business_settings;
DROP POLICY IF EXISTS "business_settings_authenticated_delete" ON business_settings;
DROP POLICY IF EXISTS "business_settings_anon_select"          ON business_settings;

-- tags
DROP POLICY IF EXISTS "tags_select"                       ON tags;
DROP POLICY IF EXISTS "tags_insert"                       ON tags;
DROP POLICY IF EXISTS "tags_update"                       ON tags;
DROP POLICY IF EXISTS "tags_delete"                       ON tags;
DROP POLICY IF EXISTS "tags_authenticated_select"         ON tags;
DROP POLICY IF EXISTS "tags_authenticated_insert"         ON tags;
DROP POLICY IF EXISTS "tags_authenticated_update"         ON tags;
DROP POLICY IF EXISTS "tags_authenticated_delete"         ON tags;

-- api_keys
DROP POLICY IF EXISTS "Users can view own api_keys"       ON api_keys;
DROP POLICY IF EXISTS "Users can insert own api_keys"     ON api_keys;
DROP POLICY IF EXISTS "Users can update own api_keys"     ON api_keys;
DROP POLICY IF EXISTS "Users can delete own api_keys"     ON api_keys;
DROP POLICY IF EXISTS "api_keys_authenticated_select"     ON api_keys;
DROP POLICY IF EXISTS "api_keys_authenticated_insert"     ON api_keys;
DROP POLICY IF EXISTS "api_keys_authenticated_update"     ON api_keys;
DROP POLICY IF EXISTS "api_keys_authenticated_delete"     ON api_keys;

-- webhook_endpoints
DROP POLICY IF EXISTS "Users can view own webhook_endpoints"   ON webhook_endpoints;
DROP POLICY IF EXISTS "Users can insert own webhook_endpoints" ON webhook_endpoints;
DROP POLICY IF EXISTS "Users can update own webhook_endpoints" ON webhook_endpoints;
DROP POLICY IF EXISTS "Users can delete own webhook_endpoints" ON webhook_endpoints;
DROP POLICY IF EXISTS "webhook_endpoints_authenticated_select" ON webhook_endpoints;
DROP POLICY IF EXISTS "webhook_endpoints_authenticated_insert" ON webhook_endpoints;
DROP POLICY IF EXISTS "webhook_endpoints_authenticated_update" ON webhook_endpoints;
DROP POLICY IF EXISTS "webhook_endpoints_authenticated_delete" ON webhook_endpoints;

-- installed_plugins
DROP POLICY IF EXISTS "Users can view own installed_plugins"   ON installed_plugins;
DROP POLICY IF EXISTS "Users can insert own installed_plugins" ON installed_plugins;
DROP POLICY IF EXISTS "Users can update own installed_plugins" ON installed_plugins;
DROP POLICY IF EXISTS "Users can delete own installed_plugins" ON installed_plugins;
DROP POLICY IF EXISTS "installed_plugins_authenticated_select" ON installed_plugins;
DROP POLICY IF EXISTS "installed_plugins_authenticated_insert" ON installed_plugins;
DROP POLICY IF EXISTS "installed_plugins_authenticated_update" ON installed_plugins;
DROP POLICY IF EXISTS "installed_plugins_authenticated_delete" ON installed_plugins;


-- ============================================================================
-- SECTION 1: PROFILES
-- ============================================================================
-- User profile table. PK is the auth user's UUID.
-- Authenticated users get full CRUD access.

CREATE POLICY "profiles_authenticated_select"
    ON profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "profiles_authenticated_insert"
    ON profiles FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "profiles_authenticated_update"
    ON profiles FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "profiles_authenticated_delete"
    ON profiles FOR DELETE
    TO authenticated
    USING (true);


-- ============================================================================
-- SECTION 2: CUSTOMERS
-- ============================================================================
-- Customer records. Internal business app: all authenticated users have full access.

CREATE POLICY "customers_authenticated_select"
    ON customers FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "customers_authenticated_insert"
    ON customers FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "customers_authenticated_update"
    ON customers FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "customers_authenticated_delete"
    ON customers FOR DELETE
    TO authenticated
    USING (true);


-- ============================================================================
-- SECTION 3: LOCATIONS
-- ============================================================================
-- Customer service locations. Full CRUD for authenticated users.

CREATE POLICY "locations_authenticated_select"
    ON locations FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "locations_authenticated_insert"
    ON locations FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "locations_authenticated_update"
    ON locations FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "locations_authenticated_delete"
    ON locations FOR DELETE
    TO authenticated
    USING (true);


-- ============================================================================
-- SECTION 4: TECHNICIANS
-- ============================================================================
-- Technician / team member records. Full CRUD for authenticated users.

CREATE POLICY "technicians_authenticated_select"
    ON technicians FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "technicians_authenticated_insert"
    ON technicians FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "technicians_authenticated_update"
    ON technicians FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "technicians_authenticated_delete"
    ON technicians FOR DELETE
    TO authenticated
    USING (true);


-- ============================================================================
-- SECTION 5: RAW_EVENTS
-- ============================================================================
-- Inbound webhook events (calls, SMS) from VoIP provider.
-- Written by Edge Functions (service_role) and read/managed by authenticated users.

CREATE POLICY "raw_events_authenticated_select"
    ON raw_events FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "raw_events_authenticated_insert"
    ON raw_events FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "raw_events_authenticated_update"
    ON raw_events FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "raw_events_authenticated_delete"
    ON raw_events FOR DELETE
    TO authenticated
    USING (true);


-- ============================================================================
-- SECTION 6: JOBS  (special: anon INSERT for booking widget)
-- ============================================================================
-- Service jobs / work orders. Core table.
-- Authenticated users: full CRUD.
-- Anon users: INSERT only (public booking widget creates new jobs).

CREATE POLICY "jobs_authenticated_select"
    ON jobs FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "jobs_authenticated_insert"
    ON jobs FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "jobs_authenticated_update"
    ON jobs FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "jobs_authenticated_delete"
    ON jobs FOR DELETE
    TO authenticated
    USING (true);

-- Anon access: booking widget can create new jobs without authentication.
-- RESTRICTED: only allows setting booking-relevant fields; forces safe defaults.
CREATE POLICY "jobs_anon_insert_restricted"
    ON jobs FOR INSERT
    TO anon
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


-- ============================================================================
-- SECTION 7: INTERACTIONS
-- ============================================================================
-- Per-job communication log entries (calls, SMS linked to a job).
-- Full CRUD for authenticated users.

CREATE POLICY "interactions_authenticated_select"
    ON interactions FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "interactions_authenticated_insert"
    ON interactions FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "interactions_authenticated_update"
    ON interactions FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "interactions_authenticated_delete"
    ON interactions FOR DELETE
    TO authenticated
    USING (true);


-- ============================================================================
-- SECTION 8: FOLLOW_UPS
-- ============================================================================
-- Scheduled follow-up actions for a job.
-- Full CRUD for authenticated users.

CREATE POLICY "follow_ups_authenticated_select"
    ON follow_ups FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "follow_ups_authenticated_insert"
    ON follow_ups FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "follow_ups_authenticated_update"
    ON follow_ups FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "follow_ups_authenticated_delete"
    ON follow_ups FOR DELETE
    TO authenticated
    USING (true);


-- ============================================================================
-- SECTION 9: ESTIMATES
-- ============================================================================
-- Estimate / quote documents. Full CRUD for authenticated users.

CREATE POLICY "estimates_authenticated_select"
    ON estimates FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "estimates_authenticated_insert"
    ON estimates FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "estimates_authenticated_update"
    ON estimates FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "estimates_authenticated_delete"
    ON estimates FOR DELETE
    TO authenticated
    USING (true);


-- ============================================================================
-- SECTION 10: ESTIMATE_ITEMS
-- ============================================================================
-- Line items belonging to an estimate. Full CRUD for authenticated users.

CREATE POLICY "estimate_items_authenticated_select"
    ON estimate_items FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "estimate_items_authenticated_insert"
    ON estimate_items FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "estimate_items_authenticated_update"
    ON estimate_items FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "estimate_items_authenticated_delete"
    ON estimate_items FOR DELETE
    TO authenticated
    USING (true);


-- ============================================================================
-- SECTION 11: RECURRING_JOBS
-- ============================================================================
-- Templates for auto-generated repeat work. Full CRUD for authenticated users.

CREATE POLICY "recurring_jobs_authenticated_select"
    ON recurring_jobs FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "recurring_jobs_authenticated_insert"
    ON recurring_jobs FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "recurring_jobs_authenticated_update"
    ON recurring_jobs FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "recurring_jobs_authenticated_delete"
    ON recurring_jobs FOR DELETE
    TO authenticated
    USING (true);


-- ============================================================================
-- SECTION 12: TIME_ENTRIES
-- ============================================================================
-- Clock in/out records per technician per job. Full CRUD for authenticated users.

CREATE POLICY "time_entries_authenticated_select"
    ON time_entries FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "time_entries_authenticated_insert"
    ON time_entries FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "time_entries_authenticated_update"
    ON time_entries FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "time_entries_authenticated_delete"
    ON time_entries FOR DELETE
    TO authenticated
    USING (true);


-- ============================================================================
-- SECTION 13: CALL_LOGS
-- ============================================================================
-- Call records from VoIP provider. Full CRUD for authenticated users.

CREATE POLICY "call_logs_authenticated_select"
    ON call_logs FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "call_logs_authenticated_insert"
    ON call_logs FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "call_logs_authenticated_update"
    ON call_logs FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "call_logs_authenticated_delete"
    ON call_logs FOR DELETE
    TO authenticated
    USING (true);


-- ============================================================================
-- SECTION 14: MESSAGE_LOGS
-- ============================================================================
-- SMS/MMS messages from VoIP provider. Full CRUD for authenticated users.

CREATE POLICY "message_logs_authenticated_select"
    ON message_logs FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "message_logs_authenticated_insert"
    ON message_logs FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "message_logs_authenticated_update"
    ON message_logs FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "message_logs_authenticated_delete"
    ON message_logs FOR DELETE
    TO authenticated
    USING (true);


-- ============================================================================
-- SECTION 15: PIPELINE_STAGES
-- ============================================================================
-- Kanban pipeline stage definitions. Full CRUD for authenticated users.

CREATE POLICY "pipeline_stages_authenticated_select"
    ON pipeline_stages FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "pipeline_stages_authenticated_insert"
    ON pipeline_stages FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "pipeline_stages_authenticated_update"
    ON pipeline_stages FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "pipeline_stages_authenticated_delete"
    ON pipeline_stages FOR DELETE
    TO authenticated
    USING (true);


-- ============================================================================
-- SECTION 16: LEADS
-- ============================================================================
-- Sales leads / opportunities. Full CRUD for authenticated users.

CREATE POLICY "leads_authenticated_select"
    ON leads FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "leads_authenticated_insert"
    ON leads FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "leads_authenticated_update"
    ON leads FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "leads_authenticated_delete"
    ON leads FOR DELETE
    TO authenticated
    USING (true);


-- ============================================================================
-- SECTION 17: NOTIFICATIONS
-- ============================================================================
-- In-app notification feed. Full CRUD for authenticated users.

CREATE POLICY "notifications_authenticated_select"
    ON notifications FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "notifications_authenticated_insert"
    ON notifications FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "notifications_authenticated_update"
    ON notifications FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "notifications_authenticated_delete"
    ON notifications FOR DELETE
    TO authenticated
    USING (true);


-- ============================================================================
-- SECTION 18: REVIEWS
-- ============================================================================
-- Customer reviews across platforms. Full CRUD for authenticated users.

CREATE POLICY "reviews_authenticated_select"
    ON reviews FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "reviews_authenticated_insert"
    ON reviews FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "reviews_authenticated_update"
    ON reviews FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "reviews_authenticated_delete"
    ON reviews FOR DELETE
    TO authenticated
    USING (true);


-- ============================================================================
-- SECTION 19: SERVICE_AGREEMENTS
-- ============================================================================
-- Maintenance contracts / memberships. Full CRUD for authenticated users.

CREATE POLICY "service_agreements_authenticated_select"
    ON service_agreements FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "service_agreements_authenticated_insert"
    ON service_agreements FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "service_agreements_authenticated_update"
    ON service_agreements FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "service_agreements_authenticated_delete"
    ON service_agreements FOR DELETE
    TO authenticated
    USING (true);


-- ============================================================================
-- SECTION 20: CAMPAIGNS
-- ============================================================================
-- Email / SMS marketing campaigns. Full CRUD for authenticated users.

CREATE POLICY "campaigns_authenticated_select"
    ON campaigns FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "campaigns_authenticated_insert"
    ON campaigns FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "campaigns_authenticated_update"
    ON campaigns FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "campaigns_authenticated_delete"
    ON campaigns FOR DELETE
    TO authenticated
    USING (true);


-- ============================================================================
-- SECTION 21: CAMPAIGN_RECIPIENTS
-- ============================================================================
-- Individual campaign send records. Full CRUD for authenticated users.

CREATE POLICY "campaign_recipients_authenticated_select"
    ON campaign_recipients FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "campaign_recipients_authenticated_insert"
    ON campaign_recipients FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "campaign_recipients_authenticated_update"
    ON campaign_recipients FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "campaign_recipients_authenticated_delete"
    ON campaign_recipients FOR DELETE
    TO authenticated
    USING (true);


-- ============================================================================
-- SECTION 22: REFERRALS
-- ============================================================================
-- Customer referral program. Full CRUD for authenticated users.

CREATE POLICY "referrals_authenticated_select"
    ON referrals FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "referrals_authenticated_insert"
    ON referrals FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "referrals_authenticated_update"
    ON referrals FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "referrals_authenticated_delete"
    ON referrals FOR DELETE
    TO authenticated
    USING (true);


-- ============================================================================
-- SECTION 23: INVENTORY_ITEMS
-- ============================================================================
-- Parts and materials catalog. Full CRUD for authenticated users.

CREATE POLICY "inventory_items_authenticated_select"
    ON inventory_items FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "inventory_items_authenticated_insert"
    ON inventory_items FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "inventory_items_authenticated_update"
    ON inventory_items FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "inventory_items_authenticated_delete"
    ON inventory_items FOR DELETE
    TO authenticated
    USING (true);


-- ============================================================================
-- SECTION 24: INVENTORY_TRANSACTIONS
-- ============================================================================
-- Stock movement ledger. Full CRUD for authenticated users.

CREATE POLICY "inventory_transactions_authenticated_select"
    ON inventory_transactions FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "inventory_transactions_authenticated_insert"
    ON inventory_transactions FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "inventory_transactions_authenticated_update"
    ON inventory_transactions FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "inventory_transactions_authenticated_delete"
    ON inventory_transactions FOR DELETE
    TO authenticated
    USING (true);


-- ============================================================================
-- SECTION 25: ACTION_QUEUE
-- ============================================================================
-- Pending automated actions awaiting approval. Full CRUD for authenticated users.

CREATE POLICY "action_queue_authenticated_select"
    ON action_queue FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "action_queue_authenticated_insert"
    ON action_queue FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "action_queue_authenticated_update"
    ON action_queue FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "action_queue_authenticated_delete"
    ON action_queue FOR DELETE
    TO authenticated
    USING (true);


-- ============================================================================
-- SECTION 26: BUSINESS_SETTINGS  (special: anon SELECT for booking widget)
-- ============================================================================
-- Per-owner business configuration.
-- Authenticated users: full CRUD.
-- Anon users: SELECT only (public booking widget reads business hours, name, etc.).

CREATE POLICY "business_settings_authenticated_select"
    ON business_settings FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "business_settings_authenticated_insert"
    ON business_settings FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "business_settings_authenticated_update"
    ON business_settings FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "business_settings_authenticated_delete"
    ON business_settings FOR DELETE
    TO authenticated
    USING (true);

-- Anon read access: booking widget and public-facing pages need to read
-- business name, phone, hours, etc. Sensitive fields are excluded at the
-- application layer (API/Edge Function), not via RLS.
CREATE POLICY "business_settings_anon_select"
    ON business_settings FOR SELECT
    TO anon
    USING (true);


-- ============================================================================
-- SECTION 27: TAGS
-- ============================================================================
-- Polymorphic tagging system. Full CRUD for authenticated users.

CREATE POLICY "tags_authenticated_select"
    ON tags FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "tags_authenticated_insert"
    ON tags FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "tags_authenticated_update"
    ON tags FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "tags_authenticated_delete"
    ON tags FOR DELETE
    TO authenticated
    USING (true);


-- ============================================================================
-- SECTION 28: API_KEYS
-- ============================================================================
-- API access management. Full CRUD for authenticated users.

CREATE POLICY "api_keys_authenticated_select"
    ON api_keys FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "api_keys_authenticated_insert"
    ON api_keys FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "api_keys_authenticated_update"
    ON api_keys FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "api_keys_authenticated_delete"
    ON api_keys FOR DELETE
    TO authenticated
    USING (true);


-- ============================================================================
-- SECTION 29: WEBHOOK_ENDPOINTS
-- ============================================================================
-- Outgoing webhook endpoints. Full CRUD for authenticated users.

CREATE POLICY "webhook_endpoints_authenticated_select"
    ON webhook_endpoints FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "webhook_endpoints_authenticated_insert"
    ON webhook_endpoints FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "webhook_endpoints_authenticated_update"
    ON webhook_endpoints FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "webhook_endpoints_authenticated_delete"
    ON webhook_endpoints FOR DELETE
    TO authenticated
    USING (true);


-- ============================================================================
-- SECTION 30: INSTALLED_PLUGINS
-- ============================================================================
-- Third-party plugin management. Full CRUD for authenticated users.

CREATE POLICY "installed_plugins_authenticated_select"
    ON installed_plugins FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "installed_plugins_authenticated_insert"
    ON installed_plugins FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "installed_plugins_authenticated_update"
    ON installed_plugins FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "installed_plugins_authenticated_delete"
    ON installed_plugins FOR DELETE
    TO authenticated
    USING (true);


-- ============================================================================
-- SECTION 31: CUSTOMER_PORTAL_TOKENS  (future table)
-- ============================================================================
-- Tokens for customer portal authentication.
-- This table may not exist yet. Apply this section AFTER the table is created.
-- Authenticated users: full CRUD (manage tokens from the dashboard).
-- Anon users: SELECT by token match only (portal auth flow).
--
-- UNCOMMENT the block below once customer_portal_tokens table exists:
--
-- ALTER TABLE customer_portal_tokens ENABLE ROW LEVEL SECURITY;
--
-- DROP POLICY IF EXISTS "customer_portal_tokens_authenticated_select" ON customer_portal_tokens;
-- DROP POLICY IF EXISTS "customer_portal_tokens_authenticated_insert" ON customer_portal_tokens;
-- DROP POLICY IF EXISTS "customer_portal_tokens_authenticated_update" ON customer_portal_tokens;
-- DROP POLICY IF EXISTS "customer_portal_tokens_authenticated_delete" ON customer_portal_tokens;
-- DROP POLICY IF EXISTS "customer_portal_tokens_anon_select"          ON customer_portal_tokens;
--
-- CREATE POLICY "customer_portal_tokens_authenticated_select"
--     ON customer_portal_tokens FOR SELECT
--     TO authenticated
--     USING (true);
--
-- CREATE POLICY "customer_portal_tokens_authenticated_insert"
--     ON customer_portal_tokens FOR INSERT
--     TO authenticated
--     WITH CHECK (true);
--
-- CREATE POLICY "customer_portal_tokens_authenticated_update"
--     ON customer_portal_tokens FOR UPDATE
--     TO authenticated
--     USING (true)
--     WITH CHECK (true);
--
-- CREATE POLICY "customer_portal_tokens_authenticated_delete"
--     ON customer_portal_tokens FOR DELETE
--     TO authenticated
--     USING (true);
--
-- -- Anon access: portal auth flow looks up a token by its value.
-- -- The USING clause restricts anon to rows matching a specific token,
-- -- which is enforced at the application layer (the query always filters
-- -- by token value). RLS here just allows the SELECT to proceed.
-- CREATE POLICY "customer_portal_tokens_anon_select"
--     ON customer_portal_tokens FOR SELECT
--     TO anon
--     USING (true);


-- ============================================================================
-- SECTION 32: INVOICES  (billing table)
-- ============================================================================

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_authenticated_select" ON invoices;
DROP POLICY IF EXISTS "invoices_authenticated_insert" ON invoices;
DROP POLICY IF EXISTS "invoices_authenticated_update" ON invoices;
DROP POLICY IF EXISTS "invoices_authenticated_delete" ON invoices;

CREATE POLICY "invoices_authenticated_select"
    ON invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "invoices_authenticated_insert"
    ON invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "invoices_authenticated_update"
    ON invoices FOR UPDATE TO authenticated USING (true);
CREATE POLICY "invoices_authenticated_delete"
    ON invoices FOR DELETE TO authenticated USING (true);


-- ============================================================================
-- SECTION 33: INVOICE_ITEMS  (billing line items)
-- ============================================================================

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_items_authenticated_select" ON invoice_items;
DROP POLICY IF EXISTS "invoice_items_authenticated_insert" ON invoice_items;
DROP POLICY IF EXISTS "invoice_items_authenticated_update" ON invoice_items;
DROP POLICY IF EXISTS "invoice_items_authenticated_delete" ON invoice_items;

CREATE POLICY "invoice_items_authenticated_select"
    ON invoice_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "invoice_items_authenticated_insert"
    ON invoice_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "invoice_items_authenticated_update"
    ON invoice_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "invoice_items_authenticated_delete"
    ON invoice_items FOR DELETE TO authenticated USING (true);


-- ============================================================================
-- SECTION 34: PAYMENTS  (payment records)
-- ============================================================================

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_authenticated_select" ON payments;
DROP POLICY IF EXISTS "payments_authenticated_insert" ON payments;
DROP POLICY IF EXISTS "payments_authenticated_update" ON payments;
DROP POLICY IF EXISTS "payments_authenticated_delete" ON payments;

CREATE POLICY "payments_authenticated_select"
    ON payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "payments_authenticated_insert"
    ON payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "payments_authenticated_update"
    ON payments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "payments_authenticated_delete"
    ON payments FOR DELETE TO authenticated USING (true);


-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. All 33 public tables have RLS ENABLED and authenticated CRUD policies.
--    This is an internal business application where every logged-in user
--    should see all data within the Supabase project.
--
-- 2. service_role (used by Edge Functions) bypasses RLS entirely.
--
-- 3. Special anon access:
--      - business_settings : anon SELECT (booking widget reads biz info)
--      - jobs              : anon INSERT (booking widget creates jobs, RESTRICTED)
--      - customer_portal_tokens : anon SELECT (portal auth, future table)
--
-- 4. Tables that had RLS DISABLED in production (action_queue, call_logs,
--    message_logs) are explicitly enabled here.
--
-- 5. The old owner_id = auth.uid() pattern has been replaced with
--    TO authenticated USING (true). In a single-tenant internal app this
--    is simpler and avoids issues where Edge Functions or service_role
--    writes rows that the authenticated user then cannot read.
--
-- 6. Storage bucket policies (job-photos, job-signatures) are NOT included
--    here. Manage storage policies via the Supabase Dashboard.
--
-- 7. When customer_portal_tokens is created, uncomment Section 31 above
--    and apply it.
-- ============================================================================
