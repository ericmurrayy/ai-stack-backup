-- ============================================================================
-- Murray's FSM - Authoritative Schema v2
-- ============================================================================
-- Single source of truth for the live Supabase database.
-- Generated from live DB introspection on 2026-03-10.
-- Project ID: pglzuykkdazzvxrdargj
--
-- DO NOT modify supabase/schema.sql - it is historical reference only.
-- This file reflects the ACTUAL production schema.
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================================
-- SECTION 1: CUSTOM ENUM TYPES
-- ============================================================================

CREATE TYPE event_type AS ENUM (
    'inbound_call', 'outbound_call', 'missed_call',
    'voicemail', 'sms_inbound', 'sms_outbound'
);

CREATE TYPE processing_status AS ENUM (
    'pending', 'awaiting_transcript', 'processing',
    'completed', 'failed', 'skipped'
);

CREATE TYPE job_status AS ENUM (
    'new', 'contacted', 'scheduled', 'in_progress',
    'completed', 'cancelled', 'spam'
);

CREATE TYPE service_category AS ENUM (
    'spring_repair', 'opener_install', 'opener_repair',
    'panel_replacement', 'full_door_install', 'cable_repair',
    'track_repair', 'roller_replacement', 'sensor_alignment',
    'weatherseal', 'maintenance', 'emergency', 'other', 'unknown'
);

CREATE TYPE urgency_level AS ENUM (
    'low', 'medium', 'high', 'emergency'
);

CREATE TYPE job_priority AS ENUM (
    'low', 'normal', 'high', 'emergency'
);

CREATE TYPE technician_role AS ENUM (
    'technician', 'dispatcher', 'admin'
);

CREATE TYPE time_entry_type AS ENUM (
    'travel', 'work', 'break'
);

CREATE TYPE estimate_status AS ENUM (
    'draft', 'sent', 'viewed', 'approved', 'rejected', 'expired'
);

CREATE TYPE call_direction AS ENUM (
    'inbound', 'outbound'
);

CREATE TYPE message_direction AS ENUM (
    'inbound', 'outbound'
);

CREATE TYPE action_status AS ENUM (
    'pending', 'approved', 'rejected', 'executed', 'failed'
);

CREATE TYPE campaign_type AS ENUM (
    'email', 'sms', 'both'
);

CREATE TYPE campaign_status AS ENUM (
    'draft', 'scheduled', 'active', 'paused', 'completed'
);

CREATE TYPE campaign_channel AS ENUM (
    'email', 'sms'
);

CREATE TYPE campaign_recipient_status AS ENUM (
    'pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed'
);

CREATE TYPE review_platform AS ENUM (
    'google', 'yelp', 'facebook', 'direct', 'other'
);

CREATE TYPE agreement_type AS ENUM (
    'maintenance', 'warranty', 'membership'
);

CREATE TYPE agreement_status AS ENUM (
    'active', 'expired', 'canceled'
);

CREATE TYPE billing_cycle AS ENUM (
    'monthly', 'quarterly', 'annual'
);

CREATE TYPE inventory_tx_type AS ENUM (
    'purchase', 'use', 'adjustment', 'return'
);


-- ============================================================================
-- SECTION 2: HELPER FUNCTIONS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- SECTION 3: CORE TABLES
-- ============================================================================

-- --------------------------------------------------------------------------
-- 3.1  profiles  -  User profiles linked to auth.users
-- --------------------------------------------------------------------------
CREATE TABLE profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    owner_id    UUID NOT NULL DEFAULT auth.uid(),
    full_name   TEXT,
    phone       TEXT,
    company_name TEXT,
    timezone    TEXT DEFAULT 'America/New_York',
    settings    JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    deleted     BOOLEAN DEFAULT FALSE
);

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------------
-- 3.2  customers  -  Customer records
-- --------------------------------------------------------------------------
CREATE TABLE customers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID NOT NULL,
    name        TEXT NOT NULL,
    phone       TEXT,
    email       TEXT,
    address     TEXT,
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    deleted     BOOLEAN DEFAULT FALSE
);

CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------------
-- 3.3  locations  -  Customer service locations
-- --------------------------------------------------------------------------
CREATE TABLE locations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    address1    TEXT NOT NULL,
    address2    TEXT,
    city        TEXT NOT NULL,
    state       TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    access_notes TEXT,
    lat         DOUBLE PRECISION,
    lng         DOUBLE PRECISION,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    deleted     BOOLEAN DEFAULT FALSE
);

CREATE TRIGGER update_locations_updated_at
    BEFORE UPDATE ON locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------------
-- 3.4  technicians  -  Technician / team member records
-- --------------------------------------------------------------------------
CREATE TABLE technicians (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id          UUID NOT NULL,
    profile_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,
    name              TEXT NOT NULL,
    email             TEXT,
    phone             TEXT,
    role              technician_role DEFAULT 'technician',
    skills            TEXT[] DEFAULT '{}',
    hourly_rate_cents INTEGER DEFAULT 0,
    color             TEXT DEFAULT '#3B82F6',
    is_active         BOOLEAN DEFAULT TRUE,
    availability      JSONB DEFAULT '{
        "mon": {"start": "08:00", "end": "17:00"},
        "tue": {"start": "08:00", "end": "17:00"},
        "wed": {"start": "08:00", "end": "17:00"},
        "thu": {"start": "08:00", "end": "17:00"},
        "fri": {"start": "08:00", "end": "17:00"},
        "sat": null,
        "sun": null
    }'::jsonb,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    deleted           BOOLEAN DEFAULT FALSE
);

CREATE TRIGGER update_technicians_updated_at
    BEFORE UPDATE ON technicians
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- SECTION 4: EVENT INGESTION PIPELINE
-- ============================================================================

-- --------------------------------------------------------------------------
-- 4.1  raw_events  -  Inbound webhook events (calls, SMS) from Beside/VoIP
-- --------------------------------------------------------------------------
CREATE TABLE raw_events (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id       TEXT NOT NULL,
    event_type        event_type NOT NULL,
    source            TEXT NOT NULL DEFAULT 'beside',
    phone_number      TEXT NOT NULL,
    phone_e164        TEXT,
    caller_name       TEXT,
    raw_payload       JSONB NOT NULL,
    has_transcript    BOOLEAN DEFAULT FALSE,
    transcript        TEXT,
    ai_summary        TEXT,
    recording_url     TEXT,
    processing_status processing_status DEFAULT 'pending',
    processing_error  TEXT,
    processed_at      TIMESTAMPTZ,
    retry_count       INTEGER DEFAULT 0,
    next_retry_at     TIMESTAMPTZ,
    job_id            UUID,                        -- FK added after jobs table
    event_timestamp   TIMESTAMPTZ NOT NULL,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_raw_events_updated_at
    BEFORE UPDATE ON raw_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- SECTION 5: JOBS & WORK ORDERS
-- ============================================================================

-- --------------------------------------------------------------------------
-- 5.1  jobs  -  Service jobs / work orders (core table)
-- --------------------------------------------------------------------------
CREATE TABLE jobs (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_number            INTEGER NOT NULL GENERATED BY DEFAULT AS IDENTITY,
    phone_number          TEXT NOT NULL,
    phone_e164            TEXT NOT NULL,
    customer_name         TEXT,
    email                 TEXT,
    city                  TEXT,
    address               TEXT,
    zip_code              TEXT,
    service_category      service_category DEFAULT 'unknown',
    urgency               urgency_level DEFAULT 'medium',
    issue_description     TEXT,
    preferred_time        TEXT,
    scheduled_at          TIMESTAMPTZ,
    status                job_status DEFAULT 'new',
    is_spam               BOOLEAN DEFAULT FALSE,
    spam_reason           TEXT,
    extraction_confidence NUMERIC,
    recommended_action    TEXT,
    source_event_id       UUID REFERENCES raw_events(id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW(),
    closed_at             TIMESTAMPTZ,
    assigned_technician_id UUID REFERENCES technicians(id) ON DELETE SET NULL,
    priority              job_priority DEFAULT 'normal',
    source                TEXT,
    recurring_job_id      UUID,                    -- FK added after recurring_jobs table
    estimate_id           UUID                     -- FK added after estimates table
);

CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add deferred FK from raw_events -> jobs
ALTER TABLE raw_events
    ADD CONSTRAINT fk_raw_events_job
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL;

-- --------------------------------------------------------------------------
-- 5.2  interactions  -  Per-job communication log entries
-- --------------------------------------------------------------------------
CREATE TABLE interactions (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id           UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    raw_event_id     UUID REFERENCES raw_events(id) ON DELETE SET NULL,
    interaction_type event_type NOT NULL,
    direction        TEXT NOT NULL,
    summary          TEXT,
    transcript       TEXT,
    recording_url    TEXT,
    message_body     TEXT,
    duration_seconds INTEGER,
    occurred_at      TIMESTAMPTZ NOT NULL,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- 5.3  follow_ups  -  Scheduled follow-up actions for a job
-- --------------------------------------------------------------------------
CREATE TABLE follow_ups (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id        UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    action_type   TEXT NOT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL,
    status        TEXT DEFAULT 'pending',
    sent_at       TIMESTAMPTZ,
    error         TEXT,
    payload       JSONB,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- SECTION 6: ESTIMATES & LINE ITEMS
-- ============================================================================

-- --------------------------------------------------------------------------
-- 6.1  estimates  -  Estimate / quote documents
-- --------------------------------------------------------------------------
CREATE TABLE estimates (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id         UUID NOT NULL,
    customer_id      UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    location_id      UUID REFERENCES locations(id) ON DELETE SET NULL,
    estimate_number  TEXT,
    status           estimate_status DEFAULT 'draft',
    title            TEXT NOT NULL,
    notes            TEXT,
    valid_until      DATE,
    total_cents      INTEGER DEFAULT 0,
    sent_at          TIMESTAMPTZ,
    approved_at      TIMESTAMPTZ,
    converted_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    deleted          BOOLEAN DEFAULT FALSE
);

CREATE TRIGGER update_estimates_updated_at
    BEFORE UPDATE ON estimates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add deferred FK from jobs -> estimates
ALTER TABLE jobs
    ADD CONSTRAINT fk_jobs_estimate
    FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE SET NULL;

-- --------------------------------------------------------------------------
-- 6.2  estimate_items  -  Line items belonging to an estimate
-- --------------------------------------------------------------------------
CREATE TABLE estimate_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL,
    estimate_id     UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    qty             NUMERIC DEFAULT 1,
    unit_price_cents INTEGER NOT NULL,
    total_cents     INTEGER,
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted         BOOLEAN DEFAULT FALSE
);

CREATE TRIGGER update_estimate_items_updated_at
    BEFORE UPDATE ON estimate_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- SECTION 7: RECURRING JOBS
-- ============================================================================

-- --------------------------------------------------------------------------
-- 7.1  recurring_jobs  -  Templates for auto-generated repeat work
-- --------------------------------------------------------------------------
CREATE TABLE recurring_jobs (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id              UUID NOT NULL,
    customer_id           UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    location_id           UUID REFERENCES locations(id) ON DELETE SET NULL,
    title                 TEXT NOT NULL,
    service_type          TEXT,
    description           TEXT,
    rrule                 TEXT NOT NULL,           -- iCal RRULE string
    duration_minutes      INTEGER DEFAULT 120,
    assigned_technician_id UUID REFERENCES technicians(id) ON DELETE SET NULL,
    line_items_template   JSONB DEFAULT '[]'::jsonb,
    next_occurrence_at    TIMESTAMPTZ,
    last_generated_at     TIMESTAMPTZ,
    is_active             BOOLEAN DEFAULT TRUE,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW(),
    deleted               BOOLEAN DEFAULT FALSE
);

CREATE TRIGGER update_recurring_jobs_updated_at
    BEFORE UPDATE ON recurring_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add deferred FK from jobs -> recurring_jobs
ALTER TABLE jobs
    ADD CONSTRAINT fk_jobs_recurring_job
    FOREIGN KEY (recurring_job_id) REFERENCES recurring_jobs(id) ON DELETE SET NULL;


-- ============================================================================
-- SECTION 8: TIME TRACKING
-- ============================================================================

-- --------------------------------------------------------------------------
-- 8.1  time_entries  -  Clock in/out records per technician per job
-- --------------------------------------------------------------------------
CREATE TABLE time_entries (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id         UUID NOT NULL,
    technician_id    UUID NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
    job_id           UUID REFERENCES jobs(id) ON DELETE SET NULL,
    entry_type       time_entry_type DEFAULT 'work',
    started_at       TIMESTAMPTZ NOT NULL,
    ended_at         TIMESTAMPTZ,
    duration_minutes INTEGER,
    notes            TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    deleted          BOOLEAN DEFAULT FALSE
);

CREATE TRIGGER update_time_entries_updated_at
    BEFORE UPDATE ON time_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- SECTION 9: COMMUNICATIONS
-- ============================================================================

-- --------------------------------------------------------------------------
-- 9.1  call_logs  -  Call records from VoIP provider
-- --------------------------------------------------------------------------
CREATE TABLE call_logs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id         UUID NOT NULL,
    external_call_id TEXT NOT NULL,
    direction        call_direction NOT NULL,
    from_phone       TEXT NOT NULL,
    to_phone         TEXT NOT NULL,
    duration_seconds INTEGER,
    started_at       TIMESTAMPTZ,
    ended_at         TIMESTAMPTZ,
    answered_at      TIMESTAMPTZ,
    recording_url    TEXT,
    transcript       TEXT,
    summary          TEXT,
    action_items     JSONB DEFAULT '[]'::jsonb,
    raw_event        JSONB,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    deleted          BOOLEAN DEFAULT FALSE
);

CREATE TRIGGER update_call_logs_updated_at
    BEFORE UPDATE ON call_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------------
-- 9.2  message_logs  -  SMS/MMS messages from VoIP provider
-- --------------------------------------------------------------------------
CREATE TABLE message_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id            UUID NOT NULL,
    external_message_id TEXT NOT NULL,
    direction           message_direction NOT NULL,
    from_phone          TEXT NOT NULL,
    to_phone            TEXT NOT NULL,
    body                TEXT,
    media               JSONB DEFAULT '[]'::jsonb,
    status              TEXT,
    received_at         TIMESTAMPTZ,
    raw_event           JSONB,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted             BOOLEAN DEFAULT FALSE
);

CREATE TRIGGER update_message_logs_updated_at
    BEFORE UPDATE ON message_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- SECTION 10: PIPELINE & LEADS
-- ============================================================================

-- --------------------------------------------------------------------------
-- 10.1  pipeline_stages  -  Kanban pipeline stage definitions
-- --------------------------------------------------------------------------
CREATE TABLE pipeline_stages (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id   UUID NOT NULL,
    name       TEXT NOT NULL,
    color      TEXT DEFAULT '#3b82f6',
    sort_order INTEGER DEFAULT 0,
    is_won     BOOLEAN DEFAULT FALSE,
    is_lost    BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted    BOOLEAN DEFAULT FALSE
);

CREATE TRIGGER update_pipeline_stages_updated_at
    BEFORE UPDATE ON pipeline_stages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------------
-- 10.2  leads  -  Sales leads / opportunities
-- --------------------------------------------------------------------------
CREATE TABLE leads (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id              UUID NOT NULL,
    customer_id           UUID REFERENCES customers(id) ON DELETE SET NULL,
    stage_id              UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE RESTRICT,
    title                 TEXT NOT NULL,
    description           TEXT,
    source                TEXT,
    estimated_value_cents INTEGER DEFAULT 0,
    probability           INTEGER DEFAULT 50,
    assigned_technician_id UUID REFERENCES technicians(id) ON DELETE SET NULL,
    expected_close_date   DATE,
    won_at                TIMESTAMPTZ,
    lost_at               TIMESTAMPTZ,
    lost_reason           TEXT,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW(),
    deleted               BOOLEAN DEFAULT FALSE
);

CREATE TRIGGER update_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- SECTION 11: NOTIFICATIONS
-- ============================================================================

-- --------------------------------------------------------------------------
-- 11.1  notifications  -  In-app notification feed
-- --------------------------------------------------------------------------
CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID NOT NULL,
    title       TEXT NOT NULL,
    body        TEXT,
    type        TEXT NOT NULL,                     -- e.g. 'new_job', 'estimate_approved'
    entity_type TEXT,                              -- e.g. 'job', 'estimate', 'lead'
    entity_id   UUID,
    is_read     BOOLEAN DEFAULT FALSE,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- SECTION 12: REVIEWS & REPUTATION
-- ============================================================================

-- --------------------------------------------------------------------------
-- 12.1  reviews  -  Customer reviews across platforms
-- --------------------------------------------------------------------------
CREATE TABLE reviews (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id           UUID NOT NULL,
    customer_id        UUID REFERENCES customers(id) ON DELETE SET NULL,
    job_id             UUID REFERENCES jobs(id) ON DELETE SET NULL,
    platform           review_platform DEFAULT 'direct',
    reviewer_name      TEXT,
    rating             INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text        TEXT,
    response_text      TEXT,
    responded_at       TIMESTAMPTZ,
    external_review_id TEXT,
    review_url         TEXT,
    reviewed_at        TIMESTAMPTZ DEFAULT NOW(),
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW(),
    deleted            BOOLEAN DEFAULT FALSE
);

CREATE TRIGGER update_reviews_updated_at
    BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- SECTION 13: SERVICE AGREEMENTS
-- ============================================================================

-- --------------------------------------------------------------------------
-- 13.1  service_agreements  -  Maintenance contracts / memberships
-- --------------------------------------------------------------------------
CREATE TABLE service_agreements (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id         UUID NOT NULL,
    customer_id      UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    location_id      UUID REFERENCES locations(id) ON DELETE SET NULL,
    name             TEXT NOT NULL,
    description      TEXT,
    type             agreement_type DEFAULT 'maintenance',
    status           agreement_status DEFAULT 'active',
    start_date       DATE NOT NULL,
    end_date         DATE,
    recurring_job_id UUID REFERENCES recurring_jobs(id) ON DELETE SET NULL,
    price_cents      INTEGER DEFAULT 0,
    billing_cycle    billing_cycle DEFAULT 'monthly',
    terms            TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    deleted          BOOLEAN DEFAULT FALSE
);

CREATE TRIGGER update_service_agreements_updated_at
    BEFORE UPDATE ON service_agreements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- SECTION 14: MARKETING & CAMPAIGNS
-- ============================================================================

-- --------------------------------------------------------------------------
-- 14.1  campaigns  -  Email / SMS marketing campaigns
-- --------------------------------------------------------------------------
CREATE TABLE campaigns (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id         UUID NOT NULL,
    name             TEXT NOT NULL,
    description      TEXT,
    type             campaign_type DEFAULT 'email',
    status           campaign_status DEFAULT 'draft',
    template_subject TEXT,
    template_body    TEXT,
    target_filter    JSONB DEFAULT '{}'::jsonb,
    scheduled_at     TIMESTAMPTZ,
    started_at       TIMESTAMPTZ,
    completed_at     TIMESTAMPTZ,
    stats            JSONB DEFAULT '{"sent":0,"delivered":0,"opened":0,"clicked":0,"converted":0}'::jsonb,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    deleted          BOOLEAN DEFAULT FALSE
);

CREATE TRIGGER update_campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------------
-- 14.2  campaign_recipients  -  Individual send records
-- --------------------------------------------------------------------------
CREATE TABLE campaign_recipients (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id     UUID NOT NULL,
    campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    customer_id  UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    channel      campaign_channel NOT NULL,
    destination  TEXT NOT NULL,                    -- email address or phone number
    status       campaign_recipient_status DEFAULT 'pending',
    sent_at      TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at    TIMESTAMPTZ,
    clicked_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- 14.3  referrals  -  Customer referral program
-- --------------------------------------------------------------------------
CREATE TABLE referrals (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id              UUID NOT NULL,
    referrer_customer_id  UUID REFERENCES customers(id) ON DELETE SET NULL,
    referred_customer_id  UUID REFERENCES customers(id) ON DELETE SET NULL,
    referred_name         TEXT,
    referred_phone        TEXT,
    referred_email        TEXT,
    referral_code         TEXT,
    status                TEXT DEFAULT 'pending',  -- pending, contacted, converted, expired
    referrer_reward_cents INTEGER DEFAULT 0,
    referrer_reward_paid  BOOLEAN DEFAULT FALSE,
    expires_at            TIMESTAMPTZ,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW(),
    deleted               BOOLEAN DEFAULT FALSE
);

CREATE TRIGGER update_referrals_updated_at
    BEFORE UPDATE ON referrals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- SECTION 15: INVENTORY
-- ============================================================================

-- --------------------------------------------------------------------------
-- 15.1  inventory_items  -  Parts and materials catalog
-- --------------------------------------------------------------------------
CREATE TABLE inventory_items (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id         UUID NOT NULL,
    sku              TEXT,
    name             TEXT NOT NULL,
    description      TEXT,
    category         TEXT,
    unit_of_measure  TEXT DEFAULT 'each',
    cost_cents       INTEGER DEFAULT 0,
    price_cents      INTEGER DEFAULT 0,
    qty_on_hand      NUMERIC DEFAULT 0,
    qty_reserved     NUMERIC DEFAULT 0,
    reorder_point    NUMERIC DEFAULT 5,
    reorder_qty      NUMERIC DEFAULT 10,
    vendor           TEXT,
    vendor_part_number TEXT,
    location_in_shop TEXT,
    is_active        BOOLEAN DEFAULT TRUE,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    deleted          BOOLEAN DEFAULT FALSE
);

CREATE TRIGGER update_inventory_items_updated_at
    BEFORE UPDATE ON inventory_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------------
-- 15.2  inventory_transactions  -  Stock movement ledger
-- --------------------------------------------------------------------------
CREATE TABLE inventory_transactions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id         UUID NOT NULL,
    item_id          UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    transaction_type inventory_tx_type NOT NULL,
    qty_change       NUMERIC NOT NULL,             -- positive = in, negative = out
    job_id           UUID REFERENCES jobs(id) ON DELETE SET NULL,
    notes            TEXT,
    created_by       UUID,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- SECTION 16: AUTOMATION & ACTION QUEUE
-- ============================================================================

-- --------------------------------------------------------------------------
-- 16.1  action_queue  -  Pending automated actions awaiting approval
-- --------------------------------------------------------------------------
CREATE TABLE action_queue (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id          UUID NOT NULL,
    source_type       TEXT NOT NULL,                -- 'call', 'message', 'manual'
    source_id         TEXT,
    kind              TEXT NOT NULL,                -- 'create_job', 'send_sms', etc.
    payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
    status            action_status DEFAULT 'pending',
    requires_approval BOOLEAN DEFAULT TRUE,
    approved_at       TIMESTAMPTZ,
    executed_at       TIMESTAMPTZ,
    error             TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    deleted           BOOLEAN DEFAULT FALSE
);

CREATE TRIGGER update_action_queue_updated_at
    BEFORE UPDATE ON action_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- SECTION 17: BUSINESS SETTINGS
-- ============================================================================

-- --------------------------------------------------------------------------
-- 17.1  business_settings  -  Per-owner business configuration
-- --------------------------------------------------------------------------
CREATE TABLE business_settings (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id             UUID NOT NULL UNIQUE,
    business_name        TEXT,
    business_phone       TEXT,
    business_email       TEXT,
    referral_reward_cents INTEGER DEFAULT 5000,
    min_job_value_cents  INTEGER DEFAULT 10000,
    referral_expiry_days INTEGER DEFAULT 30,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_business_settings_updated_at
    BEFORE UPDATE ON business_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- SECTION 18: TAGS
-- ============================================================================

-- --------------------------------------------------------------------------
-- 18.1  tags  -  Polymorphic tagging system
-- --------------------------------------------------------------------------
CREATE TABLE tags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID NOT NULL,
    entity_type TEXT NOT NULL,                     -- 'job', 'customer', 'lead', etc.
    entity_id   UUID NOT NULL,
    tag         TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- SECTION 19: INTEGRATIONS & API
-- ============================================================================

-- --------------------------------------------------------------------------
-- 19.1  api_keys  -  API access management
-- --------------------------------------------------------------------------
CREATE TABLE api_keys (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id             UUID NOT NULL,
    name                 TEXT NOT NULL,
    key_prefix           TEXT NOT NULL,
    key_hash             TEXT NOT NULL,
    scopes               TEXT[] NOT NULL,
    description          TEXT,
    expires_at           TIMESTAMPTZ,
    last_used_at         TIMESTAMPTZ,
    is_active            BOOLEAN DEFAULT TRUE,
    rate_limit_per_minute INTEGER DEFAULT 100,
    created_by           UUID NOT NULL,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW(),
    deleted              BOOLEAN DEFAULT FALSE
);

CREATE TRIGGER update_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------------
-- 19.2  webhook_endpoints  -  Outgoing webhook endpoints
-- --------------------------------------------------------------------------
CREATE TABLE webhook_endpoints (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL,
    url             TEXT NOT NULL,
    secret          TEXT NOT NULL,
    events          TEXT[] NOT NULL,
    description     TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    failure_count   INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted         BOOLEAN DEFAULT FALSE
);

CREATE TRIGGER update_webhook_endpoints_updated_at
    BEFORE UPDATE ON webhook_endpoints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------------
-- 19.3  installed_plugins  -  Third-party plugin management
-- --------------------------------------------------------------------------
CREATE TABLE installed_plugins (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id     UUID NOT NULL,
    plugin_id    TEXT NOT NULL,
    enabled      BOOLEAN DEFAULT TRUE,
    config       JSONB DEFAULT '{}'::jsonb,
    installed_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    deleted      BOOLEAN DEFAULT FALSE
);

CREATE TRIGGER update_installed_plugins_updated_at
    BEFORE UPDATE ON installed_plugins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- SECTION 20: AUTH HELPER - Profile auto-creation on signup
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, owner_id, full_name, phone)
    VALUES (
        NEW.id,
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'phone', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();


-- ============================================================================
-- SECTION 21: BILLING - INVOICES & PAYMENTS
-- ============================================================================

CREATE TYPE payment_status AS ENUM (
    'pending', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded', 'canceled'
);

CREATE TYPE payment_method_type AS ENUM (
    'card', 'cash', 'check', 'bank_transfer', 'other'
);

CREATE TYPE invoice_status AS ENUM (
    'draft', 'sent', 'viewed', 'paid', 'partially_paid', 'overdue', 'void', 'written_off'
);

-- --------------------------------------------------------------------------
-- 21.1  invoices  -  Invoice documents
-- --------------------------------------------------------------------------
CREATE TABLE invoices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id            UUID NOT NULL,
    invoice_number      INTEGER NOT NULL GENERATED BY DEFAULT AS IDENTITY,
    job_id              UUID REFERENCES jobs(id) ON DELETE SET NULL,
    customer_id         UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name       TEXT,
    customer_email      TEXT,
    customer_phone      TEXT,
    customer_address    TEXT,
    status              invoice_status DEFAULT 'draft',
    issue_date          DATE DEFAULT CURRENT_DATE,
    due_date            DATE,
    subtotal_cents      INTEGER DEFAULT 0,
    tax_rate            NUMERIC(5,4) DEFAULT 0,
    tax_cents           INTEGER DEFAULT 0,
    discount_cents      INTEGER DEFAULT 0,
    total_cents         INTEGER DEFAULT 0,
    amount_paid_cents   INTEGER DEFAULT 0,
    balance_due_cents   INTEGER DEFAULT 0,
    notes               TEXT,
    terms               TEXT,
    footer              TEXT,
    sent_at             TIMESTAMPTZ,
    viewed_at           TIMESTAMPTZ,
    paid_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted             BOOLEAN DEFAULT FALSE
);

CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------------
-- 21.2  invoice_items  -  Line items belonging to an invoice
-- --------------------------------------------------------------------------
CREATE TABLE invoice_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id            UUID NOT NULL,
    invoice_id          UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    inventory_item_id   UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    qty                 NUMERIC DEFAULT 1,
    unit_price_cents    INTEGER NOT NULL,
    total_cents         INTEGER,
    sort_order          INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted             BOOLEAN DEFAULT FALSE
);

CREATE TRIGGER update_invoice_items_updated_at
    BEFORE UPDATE ON invoice_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------------
-- 21.3  payments  -  Payment records (Stripe, cash, check, etc.)
-- --------------------------------------------------------------------------
CREATE TABLE payments (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id                UUID NOT NULL,
    job_id                  UUID REFERENCES jobs(id) ON DELETE SET NULL,
    invoice_id              UUID REFERENCES invoices(id) ON DELETE SET NULL,
    provider                TEXT NOT NULL DEFAULT 'stripe',
    method                  payment_method_type DEFAULT 'card',
    status                  payment_status DEFAULT 'pending',
    amount_cents            INTEGER NOT NULL,
    currency                TEXT DEFAULT 'usd',
    stripe_payment_intent_id TEXT,
    stripe_charge_id         TEXT,
    stripe_customer_id       TEXT,
    stripe_receipt_url       TEXT,
    refunded_amount_cents   INTEGER DEFAULT 0,
    description             TEXT,
    metadata                JSONB DEFAULT '{}'::jsonb,
    failure_reason          TEXT,
    paid_at                 TIMESTAMPTZ,
    refunded_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),
    deleted                 BOOLEAN DEFAULT FALSE
);

CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
-- Total tables: 33
--   profiles, customers, locations, technicians,
--   raw_events, jobs, interactions, follow_ups,
--   estimates, estimate_items,
--   recurring_jobs, time_entries,
--   call_logs, message_logs,
--   pipeline_stages, leads,
--   notifications, reviews,
--   service_agreements,
--   campaigns, campaign_recipients, referrals,
--   inventory_items, inventory_transactions,
--   action_queue, business_settings, tags,
--   api_keys, webhook_endpoints, installed_plugins,
--   invoices, invoice_items, payments
-- ============================================================================
