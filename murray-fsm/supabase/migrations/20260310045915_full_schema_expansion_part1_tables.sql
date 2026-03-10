-- Full Schema Expansion Part 1: Tables, Enums, Columns
-- Applied: 2026-03-10
-- Drops empty legacy tables, creates 13 new tables, alters jobs + inventory_items

-- ============================================================
-- 1. Drop empty legacy tables that conflict with new schema
-- ============================================================
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS marketing_campaigns CASCADE;

DROP TYPE IF EXISTS team_role;
DROP TYPE IF EXISTS review_platform;

-- ============================================================
-- 2. Create enum types
-- ============================================================
CREATE TYPE technician_role AS ENUM ('technician', 'dispatcher', 'admin');
CREATE TYPE review_platform AS ENUM ('google', 'yelp', 'facebook', 'direct', 'other');
CREATE TYPE inventory_tx_type AS ENUM ('purchase', 'use', 'adjustment', 'return');
CREATE TYPE campaign_channel AS ENUM ('email', 'sms');
CREATE TYPE campaign_recipient_status AS ENUM ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed');
CREATE TYPE time_entry_type AS ENUM ('travel', 'work', 'break');
CREATE TYPE estimate_status AS ENUM ('draft', 'sent', 'viewed', 'approved', 'rejected', 'expired');
CREATE TYPE agreement_type AS ENUM ('maintenance', 'warranty', 'membership');
CREATE TYPE agreement_status AS ENUM ('active', 'expired', 'canceled');
CREATE TYPE billing_cycle AS ENUM ('monthly', 'quarterly', 'annual');
CREATE TYPE job_priority AS ENUM ('low', 'normal', 'high', 'emergency');
-- campaign_type and campaign_status already exist from previous schema

-- ============================================================
-- 3. Helper function for updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 4. Create new tables
-- ============================================================

-- technicians
CREATE TABLE technicians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES profiles(id),
    profile_id UUID REFERENCES profiles(id),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role technician_role NOT NULL DEFAULT 'technician',
    skills TEXT[] DEFAULT '{}',
    hourly_rate_cents INTEGER,
    color TEXT DEFAULT '#3B82F6',
    is_active BOOLEAN DEFAULT TRUE,
    availability JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_technicians_owner ON technicians(owner_id);
CREATE TRIGGER set_technicians_updated_at BEFORE UPDATE ON technicians
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- recurring_jobs
CREATE TABLE recurring_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES profiles(id),
    customer_id UUID REFERENCES customers(id),
    location_id UUID REFERENCES locations(id),
    title TEXT NOT NULL,
    service_type TEXT,
    description TEXT,
    rrule TEXT NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    assigned_technician_id UUID REFERENCES technicians(id),
    line_items_template JSONB DEFAULT '[]',
    next_occurrence_at TIMESTAMPTZ,
    last_generated_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_recurring_jobs_owner ON recurring_jobs(owner_id);
CREATE INDEX idx_recurring_jobs_next ON recurring_jobs(next_occurrence_at) WHERE is_active = TRUE;
CREATE TRIGGER set_recurring_jobs_updated_at BEFORE UPDATE ON recurring_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- estimates
CREATE TABLE estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES profiles(id),
    customer_id UUID REFERENCES customers(id),
    location_id UUID REFERENCES locations(id),
    estimate_number TEXT,
    status estimate_status NOT NULL DEFAULT 'draft',
    title TEXT NOT NULL,
    notes TEXT,
    valid_until DATE,
    total_cents INTEGER DEFAULT 0,
    sent_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    converted_job_id UUID REFERENCES jobs(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_estimates_owner ON estimates(owner_id);
CREATE INDEX idx_estimates_customer ON estimates(customer_id);
CREATE TRIGGER set_estimates_updated_at BEFORE UPDATE ON estimates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- estimate_items
CREATE TABLE estimate_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES profiles(id),
    estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    qty NUMERIC(10,2) DEFAULT 1,
    unit_price_cents INTEGER NOT NULL,
    total_cents INTEGER GENERATED ALWAYS AS (ROUND(qty * unit_price_cents)::INTEGER) STORED,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_estimate_items_estimate ON estimate_items(estimate_id);
CREATE TRIGGER set_estimate_items_updated_at BEFORE UPDATE ON estimate_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- reviews
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES profiles(id),
    customer_id UUID REFERENCES customers(id),
    job_id UUID REFERENCES jobs(id),
    platform review_platform NOT NULL DEFAULT 'direct',
    reviewer_name TEXT,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    response_text TEXT,
    responded_at TIMESTAMPTZ,
    external_review_id TEXT,
    review_url TEXT,
    reviewed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_reviews_owner ON reviews(owner_id);
CREATE INDEX idx_reviews_rating ON reviews(owner_id, rating);
CREATE TRIGGER set_reviews_updated_at BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- campaigns
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES profiles(id),
    name TEXT NOT NULL,
    description TEXT,
    type campaign_type NOT NULL DEFAULT 'email',
    status campaign_status NOT NULL DEFAULT 'draft',
    template_subject TEXT,
    template_body TEXT,
    target_filter JSONB DEFAULT '{}',
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    stats JSONB DEFAULT '{"sent":0,"delivered":0,"opened":0,"clicked":0,"converted":0}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_campaigns_owner ON campaigns(owner_id);
CREATE TRIGGER set_campaigns_updated_at BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- campaign_recipients
CREATE TABLE campaign_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES profiles(id),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    channel campaign_channel NOT NULL DEFAULT 'email',
    destination TEXT NOT NULL,
    status campaign_recipient_status NOT NULL DEFAULT 'pending',
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_campaign_recipients_campaign ON campaign_recipients(campaign_id);
CREATE TRIGGER set_campaign_recipients_updated_at BEFORE UPDATE ON campaign_recipients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- leads
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES profiles(id),
    customer_id UUID REFERENCES customers(id),
    stage_id UUID REFERENCES pipeline_stages(id),
    title TEXT NOT NULL,
    description TEXT,
    source TEXT,
    estimated_value_cents INTEGER DEFAULT 0,
    probability INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
    assigned_technician_id UUID REFERENCES technicians(id),
    expected_close_date DATE,
    won_at TIMESTAMPTZ,
    lost_at TIMESTAMPTZ,
    lost_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_leads_owner ON leads(owner_id);
CREATE INDEX idx_leads_stage ON leads(stage_id);
CREATE TRIGGER set_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- time_entries
CREATE TABLE time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES profiles(id),
    technician_id UUID NOT NULL REFERENCES technicians(id),
    job_id UUID REFERENCES jobs(id),
    entry_type time_entry_type NOT NULL DEFAULT 'work',
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_time_entries_technician ON time_entries(technician_id);
CREATE INDEX idx_time_entries_job ON time_entries(job_id);
CREATE TRIGGER set_time_entries_updated_at BEFORE UPDATE ON time_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- tags
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES profiles(id),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    tag TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(owner_id, entity_type, entity_id, tag)
);
CREATE INDEX idx_tags_entity ON tags(entity_type, entity_id);

-- notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES profiles(id),
    title TEXT NOT NULL,
    body TEXT,
    type TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notifications_owner_unread ON notifications(owner_id) WHERE is_read = FALSE;

-- service_agreements
CREATE TABLE service_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES profiles(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    location_id UUID REFERENCES locations(id),
    name TEXT NOT NULL,
    description TEXT,
    type agreement_type NOT NULL DEFAULT 'maintenance',
    status agreement_status NOT NULL DEFAULT 'active',
    start_date DATE NOT NULL,
    end_date DATE,
    recurring_job_id UUID REFERENCES recurring_jobs(id),
    price_cents INTEGER DEFAULT 0,
    billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
    terms TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_service_agreements_owner ON service_agreements(owner_id);
CREATE INDEX idx_service_agreements_customer ON service_agreements(customer_id);
CREATE TRIGGER set_service_agreements_updated_at BEFORE UPDATE ON service_agreements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- inventory_transactions
CREATE TABLE inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES profiles(id),
    item_id UUID NOT NULL REFERENCES inventory_items(id),
    transaction_type inventory_tx_type NOT NULL,
    qty_change INTEGER NOT NULL,
    job_id UUID REFERENCES jobs(id),
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_inventory_tx_item ON inventory_transactions(item_id);

-- ============================================================
-- 5. Alter existing tables
-- ============================================================

-- inventory_items: rename columns, add new ones
ALTER TABLE inventory_items RENAME COLUMN unit TO unit_of_measure;
ALTER TABLE inventory_items RENAME COLUMN quantity_on_hand TO qty_on_hand;
ALTER TABLE inventory_items RENAME COLUMN reorder_quantity TO reorder_qty;
ALTER TABLE inventory_items RENAME COLUMN supplier TO vendor;
ALTER TABLE inventory_items RENAME COLUMN location TO location_in_shop;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS qty_reserved INTEGER DEFAULT 0;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS vendor_part_number TEXT;

-- jobs: add new columns
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_technician_id UUID REFERENCES technicians(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS priority job_priority DEFAULT 'normal';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recurring_job_id UUID REFERENCES recurring_jobs(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS estimate_id UUID REFERENCES estimates(id);
CREATE INDEX IF NOT EXISTS idx_jobs_technician ON jobs(assigned_technician_id);
CREATE INDEX IF NOT EXISTS idx_jobs_recurring ON jobs(recurring_job_id);
