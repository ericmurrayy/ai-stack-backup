-- Murray's FSM - Complete Database Schema
-- =========================================
-- Run this in Supabase SQL Editor to create all tables
-- Go to: SQL Editor (left sidebar) > New Query > Paste this > Run

-- Helper function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================
-- CUSTOMERS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    communication_preferences JSONB DEFAULT '{"email_marketing": true, "sms_marketing": true}'::jsonb,
    portal_enabled BOOLEAN DEFAULT TRUE,
    lifetime_value_cents INTEGER DEFAULT 0,
    total_jobs INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    source TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_customers_owner ON customers(owner_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- =====================
-- PROFILES TABLE
-- =====================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL DEFAULT auth.uid(),
    full_name TEXT,
    phone TEXT,
    company_name TEXT,
    timezone TEXT DEFAULT 'America/New_York',
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

-- =====================
-- LOCATIONS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    address1 TEXT NOT NULL,
    address2 TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    access_notes TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_locations_customer ON locations(customer_id);

-- =====================
-- JOBS TABLE (if not exists)
-- =====================
DO $$ BEGIN
    CREATE TYPE job_status AS ENUM ('scheduled', 'in_progress', 'completed', 'canceled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    service_type TEXT,
    problem_description TEXT,
    status job_status DEFAULT 'scheduled',
    scheduled_start TIMESTAMPTZ,
    scheduled_end TIMESTAMPTZ,
    arrived_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    internal_notes TEXT,
    customer_notes TEXT,
    total_estimate_cents INTEGER DEFAULT 0,
    total_invoice_cents INTEGER DEFAULT 0,
    paid_cents INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_jobs_owner ON jobs(owner_id);
CREATE INDEX IF NOT EXISTS idx_jobs_customer ON jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

-- =====================
-- JOB EVENTS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS job_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

-- =====================
-- JOB PHOTOS TABLE
-- =====================
DO $$ BEGIN
    CREATE TYPE photo_kind AS ENUM ('before', 'after', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS job_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    kind photo_kind DEFAULT 'other',
    storage_bucket TEXT DEFAULT 'job-photos',
    storage_path TEXT NOT NULL,
    mime_type TEXT,
    caption TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

-- =====================
-- JOB SIGNATURES TABLE
-- =====================
CREATE TABLE IF NOT EXISTS job_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    signer_name TEXT NOT NULL,
    signed_at TIMESTAMPTZ DEFAULT NOW(),
    storage_bucket TEXT DEFAULT 'job-signatures',
    storage_path TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

-- =====================
-- LINE ITEMS TABLE
-- =====================
DO $$ BEGIN
    CREATE TYPE line_item_kind AS ENUM ('estimate', 'invoice');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    kind line_item_kind NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    qty NUMERIC(10, 2) DEFAULT 1,
    unit_price_cents INTEGER NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

-- =====================
-- PAYMENTS TABLE
-- =====================
DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'canceled', 'refunded');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE RESTRICT,
    provider TEXT DEFAULT 'stripe',
    stripe_payment_intent_id TEXT,
    amount_cents INTEGER NOT NULL,
    status payment_status DEFAULT 'pending',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

-- =====================
-- COMM THREADS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS comm_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    external_provider TEXT DEFAULT 'quo',
    external_phone_number_id TEXT,
    contact_phone TEXT NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

-- =====================
-- CALL LOGS TABLE
-- =====================
DO $$ BEGIN
    CREATE TYPE call_direction AS ENUM ('inbound', 'outbound');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    external_call_id TEXT UNIQUE NOT NULL,
    thread_id UUID REFERENCES comm_threads(id) ON DELETE SET NULL,
    direction call_direction NOT NULL,
    from_phone TEXT NOT NULL,
    to_phone TEXT NOT NULL,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    recording_url TEXT,
    transcript TEXT,
    summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

-- =====================
-- MESSAGE LOGS TABLE
-- =====================
DO $$ BEGIN
    CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS message_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    external_message_id TEXT UNIQUE NOT NULL,
    thread_id UUID REFERENCES comm_threads(id) ON DELETE SET NULL,
    direction message_direction NOT NULL,
    from_phone TEXT NOT NULL,
    to_phone TEXT NOT NULL,
    body TEXT,
    media JSONB DEFAULT '[]'::jsonb,
    status TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

-- =====================
-- ACTION QUEUE TABLE
-- =====================
DO $$ BEGIN
    CREATE TYPE action_status AS ENUM ('pending', 'approved', 'rejected', 'executed', 'failed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS action_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    source_type TEXT NOT NULL,
    source_id TEXT,
    kind TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status action_status DEFAULT 'pending',
    requires_approval BOOLEAN DEFAULT TRUE,
    approved_at TIMESTAMPTZ,
    approved_by UUID,
    executed_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

-- =====================
-- AUTOMATION EVENTS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS automation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    source TEXT NOT NULL,
    event_type TEXT NOT NULL,
    idempotency_key TEXT UNIQUE NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

-- =====================
-- CALENDAR EVENTS TABLE
-- =====================
DO $$ BEGIN
    CREATE TYPE calendar_provider AS ENUM ('google', 'outlook', 'icloud');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    provider calendar_provider NOT NULL,
    external_event_id TEXT,
    calendar_id TEXT,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    UNIQUE(job_id, provider)
);

-- =====================
-- TEAM MEMBERS TABLE
-- =====================
DO $$ BEGIN
    CREATE TYPE team_role AS ENUM ('owner', 'admin', 'dispatcher', 'technician', 'office');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role team_role DEFAULT 'technician',
    hourly_rate_cents INTEGER DEFAULT 0,
    color TEXT DEFAULT '#3b82f6',
    skills TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

-- =====================
-- INVENTORY ITEMS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    sku TEXT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    unit TEXT DEFAULT 'each',
    cost_cents INTEGER DEFAULT 0,
    price_cents INTEGER DEFAULT 0,
    quantity_on_hand NUMERIC(10,2) DEFAULT 0,
    reorder_point NUMERIC(10,2) DEFAULT 5,
    reorder_quantity NUMERIC(10,2) DEFAULT 10,
    supplier TEXT,
    location TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

-- =====================
-- MARKETING CAMPAIGNS TABLE
-- =====================
DO $$ BEGIN
    CREATE TYPE campaign_type AS ENUM ('email', 'sms', 'both');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE campaign_status AS ENUM ('draft', 'scheduled', 'active', 'paused', 'completed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    campaign_type campaign_type DEFAULT 'email',
    status campaign_status DEFAULT 'draft',
    subject TEXT,
    message TEXT,
    scheduled_at TIMESTAMPTZ,
    total_recipients INTEGER DEFAULT 0,
    total_sent INTEGER DEFAULT 0,
    total_opened INTEGER DEFAULT 0,
    total_clicked INTEGER DEFAULT 0,
    total_converted INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

-- =====================
-- BUSINESS SETTINGS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS business_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL UNIQUE,
    business_name TEXT,
    business_phone TEXT,
    business_email TEXT,
    referral_reward_cents INTEGER DEFAULT 5000,
    min_job_value_cents INTEGER DEFAULT 10000,
    referral_expiry_days INTEGER DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- INSTALLED PLUGINS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS installed_plugins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    plugin_id TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    config JSONB DEFAULT '{}'::jsonb,
    installed_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    UNIQUE(owner_id, plugin_id)
);

-- =====================
-- WEBHOOK ENDPOINTS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    events TEXT[] NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    failure_count INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

-- =====================
-- API KEYS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    scopes TEXT[] NOT NULL,
    description TEXT,
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    rate_limit_per_minute INTEGER DEFAULT 100,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

-- =====================
-- PIPELINE STAGES TABLE
-- =====================
CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3b82f6',
    sort_order INTEGER DEFAULT 0,
    is_won BOOLEAN DEFAULT FALSE,
    is_lost BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

-- =====================
-- LEADS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES team_members(id) ON DELETE SET NULL,
    source TEXT,
    title TEXT NOT NULL,
    description TEXT,
    estimated_value_cents INTEGER DEFAULT 0,
    probability INTEGER DEFAULT 50,
    next_follow_up_at TIMESTAMPTZ,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

-- =====================
-- REFERRALS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    referrer_customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    referred_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    referred_name TEXT,
    referred_phone TEXT,
    referred_email TEXT,
    referral_code TEXT UNIQUE,
    status TEXT DEFAULT 'pending',
    referrer_reward_cents INTEGER DEFAULT 0,
    referrer_reward_paid BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

-- =====================
-- REVIEWS TABLE
-- =====================
DO $$ BEGIN
    CREATE TYPE review_platform AS ENUM ('google', 'yelp', 'facebook', 'homeadvisor', 'angieslist', 'bbb', 'internal');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    platform review_platform NOT NULL,
    external_review_id TEXT,
    reviewer_name TEXT,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title TEXT,
    content TEXT,
    review_date TIMESTAMPTZ,
    response TEXT,
    response_date TIMESTAMPTZ,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

-- =====================
-- ENABLE ROW LEVEL SECURITY
-- =====================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comm_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE installed_plugins ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- =====================
-- ROW LEVEL SECURITY POLICIES
-- =====================
-- Allow users to see only their own data

CREATE POLICY "Users can view own customers" ON customers FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own customers" ON customers FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own customers" ON customers FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can delete own customers" ON customers FOR DELETE USING (owner_id = auth.uid());

CREATE POLICY "Users can view own profiles" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profiles" ON profiles FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users can view own locations" ON locations FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own locations" ON locations FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own locations" ON locations FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can delete own locations" ON locations FOR DELETE USING (owner_id = auth.uid());

CREATE POLICY "Users can view own jobs" ON jobs FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own jobs" ON jobs FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own jobs" ON jobs FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can delete own jobs" ON jobs FOR DELETE USING (owner_id = auth.uid());

CREATE POLICY "Users can view own team_members" ON team_members FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own team_members" ON team_members FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own team_members" ON team_members FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can delete own team_members" ON team_members FOR DELETE USING (owner_id = auth.uid());

CREATE POLICY "Users can view own inventory_items" ON inventory_items FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own inventory_items" ON inventory_items FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own inventory_items" ON inventory_items FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can delete own inventory_items" ON inventory_items FOR DELETE USING (owner_id = auth.uid());

CREATE POLICY "Users can view own marketing_campaigns" ON marketing_campaigns FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own marketing_campaigns" ON marketing_campaigns FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own marketing_campaigns" ON marketing_campaigns FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can delete own marketing_campaigns" ON marketing_campaigns FOR DELETE USING (owner_id = auth.uid());

CREATE POLICY "Users can view own business_settings" ON business_settings FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own business_settings" ON business_settings FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own business_settings" ON business_settings FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can view own installed_plugins" ON installed_plugins FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own installed_plugins" ON installed_plugins FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own installed_plugins" ON installed_plugins FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can delete own installed_plugins" ON installed_plugins FOR DELETE USING (owner_id = auth.uid());

CREATE POLICY "Users can view own webhook_endpoints" ON webhook_endpoints FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own webhook_endpoints" ON webhook_endpoints FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own webhook_endpoints" ON webhook_endpoints FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can delete own webhook_endpoints" ON webhook_endpoints FOR DELETE USING (owner_id = auth.uid());

CREATE POLICY "Users can view own api_keys" ON api_keys FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own api_keys" ON api_keys FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own api_keys" ON api_keys FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can delete own api_keys" ON api_keys FOR DELETE USING (owner_id = auth.uid());

CREATE POLICY "Users can view own pipeline_stages" ON pipeline_stages FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own pipeline_stages" ON pipeline_stages FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own pipeline_stages" ON pipeline_stages FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can delete own pipeline_stages" ON pipeline_stages FOR DELETE USING (owner_id = auth.uid());

CREATE POLICY "Users can view own leads" ON leads FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own leads" ON leads FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own leads" ON leads FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can delete own leads" ON leads FOR DELETE USING (owner_id = auth.uid());

-- Service role bypass for all tables (for API routes)
CREATE POLICY "Service role full access customers" ON customers FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access jobs" ON jobs FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access team_members" ON team_members FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access inventory_items" ON inventory_items FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access marketing_campaigns" ON marketing_campaigns FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access business_settings" ON business_settings FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access installed_plugins" ON installed_plugins FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access webhook_endpoints" ON webhook_endpoints FOR ALL USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access api_keys" ON api_keys FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- =====================
-- DONE!
-- =====================
SELECT 'Schema creation complete! You should now have all tables.' as message;
