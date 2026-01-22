-- Murray's FSM - Schema Extension v2
-- ===================================
-- Advanced features to surpass Housecall, Jobber, Workiz, and GoHighLevel

-- ============================================================================
-- EXTENSION 1: TEAM MANAGEMENT
-- Multi-technician support with roles and permissions
-- ============================================================================

CREATE TYPE team_role AS ENUM ('owner', 'admin', 'dispatcher', 'technician', 'office');

CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role team_role DEFAULT 'technician',
    hourly_rate_cents INTEGER DEFAULT 0,
    color TEXT DEFAULT '#3b82f6', -- For calendar display
    avatar_url TEXT,
    skills TEXT[] DEFAULT '{}',
    service_areas TEXT[] DEFAULT '{}', -- ZIP codes or area names
    is_active BOOLEAN DEFAULT TRUE,
    can_login BOOLEAN DEFAULT TRUE,
    permissions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_team_members_owner ON team_members(owner_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE INDEX idx_team_members_active ON team_members(owner_id, is_active) WHERE deleted = FALSE;

-- Technician location tracking
CREATE TABLE technician_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tech_locations_member ON technician_locations(team_member_id, recorded_at DESC);

-- Time tracking entries
CREATE TABLE time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    clock_in TIMESTAMPTZ NOT NULL,
    clock_out TIMESTAMPTZ,
    break_minutes INTEGER DEFAULT 0,
    total_minutes INTEGER GENERATED ALWAYS AS (
        CASE WHEN clock_out IS NOT NULL
        THEN EXTRACT(EPOCH FROM (clock_out - clock_in))::INTEGER / 60 - break_minutes
        ELSE NULL END
    ) STORED,
    notes TEXT,
    approved BOOLEAN DEFAULT FALSE,
    approved_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_time_entries_member ON time_entries(team_member_id, clock_in);
CREATE INDEX idx_time_entries_job ON time_entries(job_id);

-- ============================================================================
-- EXTENSION 2: PIPELINE & LEAD MANAGEMENT
-- Visual pipeline with lead scoring (GoHighLevel killer feature)
-- ============================================================================

CREATE TABLE pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3b82f6',
    sort_order INTEGER DEFAULT 0,
    is_won BOOLEAN DEFAULT FALSE,
    is_lost BOOLEAN DEFAULT FALSE,
    auto_actions JSONB DEFAULT '[]'::jsonb, -- Automation triggers
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_pipeline_stages_owner ON pipeline_stages(owner_id, sort_order);

-- Default pipeline stages (insert via migration)
-- 1. New Lead, 2. Contacted, 3. Quote Sent, 4. Negotiating, 5. Won, 6. Lost

CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES team_members(id) ON DELETE SET NULL,
    source TEXT, -- 'website', 'referral', 'google', 'facebook', 'phone', 'walk-in'
    source_detail TEXT, -- Campaign name, referrer name, etc.
    title TEXT NOT NULL,
    description TEXT,
    estimated_value_cents INTEGER DEFAULT 0,
    probability INTEGER DEFAULT 50, -- 0-100%
    weighted_value_cents INTEGER GENERATED ALWAYS AS (
        estimated_value_cents * probability / 100
    ) STORED,
    score INTEGER DEFAULT 0, -- Lead score 0-100
    score_factors JSONB DEFAULT '{}'::jsonb,
    expected_close_date DATE,
    last_contact_at TIMESTAMPTZ,
    next_follow_up_at TIMESTAMPTZ,
    tags TEXT[] DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}'::jsonb,
    converted_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    converted_at TIMESTAMPTZ,
    lost_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_leads_owner ON leads(owner_id, created_at DESC);
CREATE INDEX idx_leads_stage ON leads(stage_id);
CREATE INDEX idx_leads_assigned ON leads(assigned_to);
CREATE INDEX idx_leads_score ON leads(owner_id, score DESC);
CREATE INDEX idx_leads_follow_up ON leads(owner_id, next_follow_up_at) WHERE deleted = FALSE;

-- Lead activity tracking
CREATE TABLE lead_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL, -- 'note', 'call', 'email', 'sms', 'meeting', 'stage_change'
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_lead_activities_lead ON lead_activities(lead_id, created_at DESC);

-- ============================================================================
-- EXTENSION 3: RECURRING JOBS & MAINTENANCE CONTRACTS
-- Automatic job generation for maintenance schedules
-- ============================================================================

CREATE TYPE recurrence_frequency AS ENUM ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'biannual', 'annual');

CREATE TABLE maintenance_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    service_type TEXT,
    frequency recurrence_frequency NOT NULL,
    day_of_week INTEGER, -- 0-6 for weekly
    day_of_month INTEGER, -- 1-31 for monthly
    month_of_year INTEGER, -- 1-12 for annual
    preferred_time_start TIME,
    preferred_time_end TIME,
    duration_minutes INTEGER DEFAULT 60,
    base_price_cents INTEGER DEFAULT 0,
    auto_generate_invoice BOOLEAN DEFAULT TRUE,
    auto_send_reminder BOOLEAN DEFAULT TRUE,
    reminder_days_before INTEGER DEFAULT 3,
    start_date DATE NOT NULL,
    end_date DATE,
    next_service_date DATE,
    last_service_date DATE,
    total_services_completed INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_maintenance_contracts_owner ON maintenance_contracts(owner_id);
CREATE INDEX idx_maintenance_contracts_customer ON maintenance_contracts(customer_id);
CREATE INDEX idx_maintenance_contracts_next ON maintenance_contracts(next_service_date) WHERE is_active = TRUE;

-- Link jobs to contracts
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES maintenance_contracts(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- EXTENSION 4: INVENTORY & PARTS MANAGEMENT
-- Track parts, costs, and reorder alerts
-- ============================================================================

CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    sku TEXT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    unit TEXT DEFAULT 'each', -- 'each', 'ft', 'lb', 'gallon', etc.
    cost_cents INTEGER DEFAULT 0,
    price_cents INTEGER DEFAULT 0, -- Sell price
    markup_percent NUMERIC(5,2) GENERATED ALWAYS AS (
        CASE WHEN cost_cents > 0
        THEN ((price_cents - cost_cents)::NUMERIC / cost_cents * 100)
        ELSE 0 END
    ) STORED,
    quantity_on_hand NUMERIC(10,2) DEFAULT 0,
    reorder_point NUMERIC(10,2) DEFAULT 5,
    reorder_quantity NUMERIC(10,2) DEFAULT 10,
    supplier TEXT,
    supplier_sku TEXT,
    location TEXT, -- Storage location
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_inventory_owner ON inventory_items(owner_id);
CREATE INDEX idx_inventory_sku ON inventory_items(owner_id, sku);
CREATE INDEX idx_inventory_low_stock ON inventory_items(owner_id)
    WHERE quantity_on_hand <= reorder_point AND is_active = TRUE;

-- Parts used on jobs
CREATE TABLE job_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
    name TEXT NOT NULL, -- Denormalized for history
    quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
    cost_cents INTEGER DEFAULT 0,
    price_cents INTEGER DEFAULT 0,
    total_cost_cents INTEGER GENERATED ALWAYS AS (ROUND(quantity * cost_cents)::INTEGER) STORED,
    total_price_cents INTEGER GENERATED ALWAYS AS (ROUND(quantity * price_cents)::INTEGER) STORED,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_job_parts_job ON job_parts(job_id);
CREATE INDEX idx_job_parts_item ON job_parts(inventory_item_id);

-- Inventory transactions
CREATE TABLE inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL, -- 'purchase', 'sale', 'adjustment', 'return', 'job_use'
    quantity NUMERIC(10,2) NOT NULL, -- Positive for in, negative for out
    unit_cost_cents INTEGER,
    reference_type TEXT, -- 'job', 'purchase_order', 'manual'
    reference_id UUID,
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inventory_tx_item ON inventory_transactions(inventory_item_id, created_at DESC);

-- ============================================================================
-- EXTENSION 5: REPUTATION MANAGEMENT
-- Review tracking and response automation
-- ============================================================================

CREATE TYPE review_platform AS ENUM ('google', 'yelp', 'facebook', 'homeadvisor', 'angieslist', 'bbb', 'internal');

CREATE TABLE reviews (
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
    responded_by UUID,
    is_public BOOLEAN DEFAULT TRUE,
    sentiment TEXT, -- 'positive', 'neutral', 'negative'
    tags TEXT[] DEFAULT '{}',
    review_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_reviews_owner ON reviews(owner_id, review_date DESC);
CREATE INDEX idx_reviews_customer ON reviews(customer_id);
CREATE INDEX idx_reviews_job ON reviews(job_id);
CREATE INDEX idx_reviews_rating ON reviews(owner_id, rating);
CREATE INDEX idx_reviews_platform ON reviews(owner_id, platform);

-- Review request tracking
CREATE TABLE review_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    sent_via TEXT NOT NULL, -- 'sms', 'email'
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    clicked_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    review_id UUID REFERENCES reviews(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_review_requests_customer ON review_requests(customer_id);
CREATE INDEX idx_review_requests_job ON review_requests(job_id);

-- ============================================================================
-- EXTENSION 6: MARKETING AUTOMATION
-- Campaigns, sequences, and referral program
-- ============================================================================

CREATE TYPE campaign_type AS ENUM ('email', 'sms', 'both');
CREATE TYPE campaign_status AS ENUM ('draft', 'scheduled', 'active', 'paused', 'completed');

CREATE TABLE marketing_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    campaign_type campaign_type NOT NULL,
    status campaign_status DEFAULT 'draft',
    target_audience JSONB DEFAULT '{}'::jsonb, -- Filters for customers
    email_subject TEXT,
    email_content TEXT,
    sms_content TEXT,
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    total_recipients INTEGER DEFAULT 0,
    total_sent INTEGER DEFAULT 0,
    total_delivered INTEGER DEFAULT 0,
    total_opened INTEGER DEFAULT 0,
    total_clicked INTEGER DEFAULT 0,
    total_converted INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_campaigns_owner ON marketing_campaigns(owner_id, created_at DESC);
CREATE INDEX idx_campaigns_status ON marketing_campaigns(status);

-- Campaign recipients
CREATE TABLE campaign_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ,
    unsubscribed_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaign_recipients_campaign ON campaign_recipients(campaign_id);
CREATE INDEX idx_campaign_recipients_customer ON campaign_recipients(customer_id);

-- Referral program
CREATE TABLE referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    referrer_customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    referred_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    referred_name TEXT,
    referred_phone TEXT,
    referred_email TEXT,
    referral_code TEXT UNIQUE,
    status TEXT DEFAULT 'pending', -- 'pending', 'contacted', 'converted', 'expired'
    converted_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    referrer_reward_cents INTEGER DEFAULT 0,
    referrer_reward_paid BOOLEAN DEFAULT FALSE,
    referred_discount_cents INTEGER DEFAULT 0,
    notes TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_referrals_owner ON referrals(owner_id);
CREATE INDEX idx_referrals_referrer ON referrals(referrer_customer_id);
CREATE INDEX idx_referrals_code ON referrals(referral_code);

-- ============================================================================
-- EXTENSION 7: CUSTOMER PORTAL
-- Self-service booking, job tracking, payment
-- ============================================================================

CREATE TABLE customer_portal_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_portal_tokens_token ON customer_portal_tokens(token) WHERE is_active = TRUE;
CREATE INDEX idx_portal_tokens_customer ON customer_portal_tokens(customer_id);

-- Customer communication preferences
ALTER TABLE customers ADD COLUMN IF NOT EXISTS communication_preferences JSONB DEFAULT '{
    "email_marketing": true,
    "sms_marketing": true,
    "appointment_reminders": true,
    "review_requests": true
}'::jsonb;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS portal_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS lifetime_value_cents INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_jobs INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- ============================================================================
-- EXTENSION 8: SERVICE AREAS & ROUTING
-- Geographic coverage and route optimization
-- ============================================================================

CREATE TABLE service_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    name TEXT NOT NULL,
    zip_codes TEXT[] DEFAULT '{}',
    cities TEXT[] DEFAULT '{}',
    counties TEXT[] DEFAULT '{}',
    states TEXT[] DEFAULT '{}',
    radius_miles NUMERIC(10,2),
    center_lat DOUBLE PRECISION,
    center_lng DOUBLE PRECISION,
    polygon JSONB, -- GeoJSON polygon for complex areas
    travel_fee_cents INTEGER DEFAULT 0,
    min_job_value_cents INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0, -- Higher = preferred
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_service_areas_owner ON service_areas(owner_id);

-- Route optimization cache
CREATE TABLE route_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    date DATE NOT NULL,
    team_member_id UUID REFERENCES team_members(id) ON DELETE CASCADE,
    job_ids UUID[] NOT NULL,
    optimized_order INTEGER[] NOT NULL,
    total_distance_miles NUMERIC(10,2),
    total_duration_minutes INTEGER,
    route_polyline TEXT, -- Encoded polyline for map display
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(owner_id, date, team_member_id)
);

CREATE INDEX idx_route_cache_lookup ON route_cache(owner_id, date, team_member_id);

-- ============================================================================
-- EXTENSION 9: ADVANCED ANALYTICS
-- Pre-computed metrics for fast reporting
-- ============================================================================

CREATE TABLE daily_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    date DATE NOT NULL,
    -- Revenue metrics
    total_revenue_cents INTEGER DEFAULT 0,
    total_collected_cents INTEGER DEFAULT 0,
    total_outstanding_cents INTEGER DEFAULT 0,
    -- Job metrics
    jobs_created INTEGER DEFAULT 0,
    jobs_completed INTEGER DEFAULT 0,
    jobs_canceled INTEGER DEFAULT 0,
    -- Lead metrics
    leads_created INTEGER DEFAULT 0,
    leads_converted INTEGER DEFAULT 0,
    leads_lost INTEGER DEFAULT 0,
    -- Customer metrics
    new_customers INTEGER DEFAULT 0,
    repeat_customers INTEGER DEFAULT 0,
    -- Time metrics
    total_labor_minutes INTEGER DEFAULT 0,
    total_drive_minutes INTEGER DEFAULT 0,
    -- Communication metrics
    calls_inbound INTEGER DEFAULT 0,
    calls_outbound INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    messages_received INTEGER DEFAULT 0,
    -- Review metrics
    reviews_received INTEGER DEFAULT 0,
    average_rating NUMERIC(3,2),
    -- Costs
    total_parts_cost_cents INTEGER DEFAULT 0,
    total_labor_cost_cents INTEGER DEFAULT 0,
    -- Computed
    gross_profit_cents INTEGER GENERATED ALWAYS AS (
        total_revenue_cents - total_parts_cost_cents - total_labor_cost_cents
    ) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(owner_id, date)
);

CREATE INDEX idx_daily_metrics_owner ON daily_metrics(owner_id, date DESC);

-- ============================================================================
-- EXTENSION 10: BUSINESS SETTINGS
-- Comprehensive business configuration
-- ============================================================================

CREATE TABLE business_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL UNIQUE,
    -- Business info
    business_name TEXT,
    business_phone TEXT,
    business_email TEXT,
    business_website TEXT,
    business_address TEXT,
    business_city TEXT,
    business_state TEXT,
    business_zip TEXT,
    business_logo_url TEXT,
    license_number TEXT,
    insurance_info TEXT,
    tax_id TEXT,
    -- Scheduling
    business_hours JSONB DEFAULT '[
        {"day": 0, "open": false},
        {"day": 1, "open": true, "start": "08:00", "end": "17:00"},
        {"day": 2, "open": true, "start": "08:00", "end": "17:00"},
        {"day": 3, "open": true, "start": "08:00", "end": "17:00"},
        {"day": 4, "open": true, "start": "08:00", "end": "17:00"},
        {"day": 5, "open": true, "start": "08:00", "end": "17:00"},
        {"day": 6, "open": true, "start": "09:00", "end": "14:00"}
    ]'::jsonb,
    default_job_duration_minutes INTEGER DEFAULT 120,
    buffer_between_jobs_minutes INTEGER DEFAULT 15,
    max_jobs_per_day INTEGER DEFAULT 8,
    -- Pricing
    hourly_rate_cents INTEGER DEFAULT 0,
    service_call_fee_cents INTEGER DEFAULT 0,
    emergency_fee_cents INTEGER DEFAULT 0,
    tax_rate NUMERIC(5,3) DEFAULT 0,
    -- Payments
    stripe_account_id TEXT,
    payment_terms_days INTEGER DEFAULT 0,
    accept_cash BOOLEAN DEFAULT TRUE,
    accept_check BOOLEAN DEFAULT TRUE,
    accept_card BOOLEAN DEFAULT TRUE,
    -- Notifications
    notify_new_lead BOOLEAN DEFAULT TRUE,
    notify_new_booking BOOLEAN DEFAULT TRUE,
    notify_job_completed BOOLEAN DEFAULT TRUE,
    notify_payment_received BOOLEAN DEFAULT TRUE,
    notify_review_received BOOLEAN DEFAULT TRUE,
    -- Branding
    primary_color TEXT DEFAULT '#1e40af',
    secondary_color TEXT DEFAULT '#3b82f6',
    email_footer TEXT,
    sms_signature TEXT,
    -- Terms
    estimate_terms TEXT,
    invoice_terms TEXT,
    warranty_terms TEXT,
    -- Integrations
    google_calendar_id TEXT,
    quickbooks_realm_id TEXT,
    -- Feature flags
    features JSONB DEFAULT '{
        "customer_portal": true,
        "online_booking": true,
        "auto_reminders": true,
        "review_requests": true,
        "marketing_campaigns": true,
        "inventory_tracking": true,
        "team_management": true,
        "route_optimization": true
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_business_settings_updated_at
    BEFORE UPDATE ON business_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- EXTENSION 11: TAGS & CUSTOM FIELDS
-- Flexible categorization system
-- ============================================================================

CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6b7280',
    entity_type TEXT NOT NULL, -- 'customer', 'job', 'lead', 'inventory'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(owner_id, name, entity_type)
);

CREATE INDEX idx_tags_owner ON tags(owner_id, entity_type);

CREATE TABLE custom_field_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    entity_type TEXT NOT NULL, -- 'customer', 'job', 'lead', 'location'
    field_name TEXT NOT NULL,
    field_label TEXT NOT NULL,
    field_type TEXT NOT NULL, -- 'text', 'number', 'date', 'select', 'multiselect', 'checkbox'
    options JSONB, -- For select/multiselect
    is_required BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(owner_id, entity_type, field_name)
);

CREATE INDEX idx_custom_fields_owner ON custom_field_definitions(owner_id, entity_type);

-- ============================================================================
-- UPDATE JOB STATUS ENUM (Add more granular statuses)
-- ============================================================================

-- Note: In production, you'd need to migrate existing data
-- ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'lead';
-- ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'quoted';
-- ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'confirmed';
-- ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'en_route';
-- ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'invoiced';
-- ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'paid';

-- Add assignment to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES team_members(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0; -- Higher = more urgent
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER DEFAULT 120;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS actual_duration_minutes INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS drive_time_minutes INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_rating INTEGER CHECK (customer_rating >= 1 AND customer_rating <= 5);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_feedback TEXT;

-- ============================================================================
-- FUNCTIONS: Auto-update customer metrics
-- ============================================================================

CREATE OR REPLACE FUNCTION update_customer_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update customer lifetime value and job count
    UPDATE customers SET
        lifetime_value_cents = COALESCE((
            SELECT SUM(paid_cents) FROM jobs
            WHERE customer_id = COALESCE(NEW.customer_id, OLD.customer_id)
            AND deleted = FALSE
        ), 0),
        total_jobs = COALESCE((
            SELECT COUNT(*) FROM jobs
            WHERE customer_id = COALESCE(NEW.customer_id, OLD.customer_id)
            AND deleted = FALSE
            AND status NOT IN ('canceled')
        ), 0)
    WHERE id = COALESCE(NEW.customer_id, OLD.customer_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_customer_metrics
    AFTER INSERT OR UPDATE OR DELETE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_metrics();

-- ============================================================================
-- FUNCTIONS: Generate next recurring job
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_next_recurring_job(contract_id UUID)
RETURNS UUID AS $$
DECLARE
    contract maintenance_contracts%ROWTYPE;
    new_job_id UUID;
    next_date DATE;
BEGIN
    SELECT * INTO contract FROM maintenance_contracts WHERE id = contract_id;

    IF contract IS NULL OR NOT contract.is_active THEN
        RETURN NULL;
    END IF;

    -- Calculate next service date based on frequency
    next_date := contract.next_service_date;
    IF next_date IS NULL THEN
        next_date := contract.start_date;
    END IF;

    -- Create the job
    INSERT INTO jobs (
        owner_id, customer_id, location_id, title, service_type,
        scheduled_start, scheduled_end, contract_id, is_recurring,
        internal_notes
    ) VALUES (
        contract.owner_id,
        contract.customer_id,
        contract.location_id,
        contract.name,
        contract.service_type,
        next_date + contract.preferred_time_start,
        next_date + contract.preferred_time_end,
        contract.id,
        TRUE,
        'Auto-generated from maintenance contract'
    ) RETURNING id INTO new_job_id;

    -- Update contract with next service date
    UPDATE maintenance_contracts SET
        last_service_date = next_date,
        next_service_date = CASE frequency
            WHEN 'daily' THEN next_date + INTERVAL '1 day'
            WHEN 'weekly' THEN next_date + INTERVAL '1 week'
            WHEN 'biweekly' THEN next_date + INTERVAL '2 weeks'
            WHEN 'monthly' THEN next_date + INTERVAL '1 month'
            WHEN 'quarterly' THEN next_date + INTERVAL '3 months'
            WHEN 'biannual' THEN next_date + INTERVAL '6 months'
            WHEN 'annual' THEN next_date + INTERVAL '1 year'
        END,
        total_services_completed = total_services_completed + 1
    WHERE id = contract_id;

    RETURN new_job_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS: Useful aggregated views
-- ============================================================================

CREATE OR REPLACE VIEW v_job_summary AS
SELECT
    j.*,
    c.name AS customer_name,
    c.phone AS customer_phone,
    c.email AS customer_email,
    l.address1, l.city, l.state, l.postal_code,
    l.lat, l.lng,
    tm.full_name AS assigned_tech_name,
    tm.phone AS assigned_tech_phone,
    (SELECT COUNT(*) FROM job_photos WHERE job_id = j.id AND deleted = FALSE) AS photo_count,
    (SELECT COUNT(*) FROM line_items WHERE job_id = j.id AND kind = 'estimate' AND deleted = FALSE) AS estimate_item_count,
    (SELECT COUNT(*) FROM line_items WHERE job_id = j.id AND kind = 'invoice' AND deleted = FALSE) AS invoice_item_count
FROM jobs j
LEFT JOIN customers c ON j.customer_id = c.id
LEFT JOIN locations l ON j.location_id = l.id
LEFT JOIN team_members tm ON j.assigned_to = tm.id
WHERE j.deleted = FALSE;

CREATE OR REPLACE VIEW v_pipeline_summary AS
SELECT
    ps.id AS stage_id,
    ps.name AS stage_name,
    ps.color AS stage_color,
    ps.sort_order,
    ps.is_won,
    ps.is_lost,
    COUNT(l.id) AS lead_count,
    COALESCE(SUM(l.estimated_value_cents), 0) AS total_value_cents,
    COALESCE(SUM(l.weighted_value_cents), 0) AS weighted_value_cents
FROM pipeline_stages ps
LEFT JOIN leads l ON ps.id = l.stage_id AND l.deleted = FALSE
WHERE ps.deleted = FALSE
GROUP BY ps.id, ps.name, ps.color, ps.sort_order, ps.is_won, ps.is_lost
ORDER BY ps.sort_order;

CREATE OR REPLACE VIEW v_technician_schedule AS
SELECT
    tm.id AS technician_id,
    tm.full_name AS technician_name,
    tm.color AS technician_color,
    j.id AS job_id,
    j.title AS job_title,
    j.scheduled_start,
    j.scheduled_end,
    j.status AS job_status,
    c.name AS customer_name,
    l.address1,
    l.city,
    l.lat,
    l.lng
FROM team_members tm
LEFT JOIN jobs j ON tm.id = j.assigned_to AND j.deleted = FALSE
LEFT JOIN customers c ON j.customer_id = c.id
LEFT JOIN locations l ON j.location_id = l.id
WHERE tm.deleted = FALSE AND tm.is_active = TRUE
ORDER BY tm.full_name, j.scheduled_start;

-- ============================================================================
-- EXTENSION 12: PLUGINS & INTEGRATIONS
-- Third-party integrations and plugin management
-- ============================================================================

CREATE TABLE installed_plugins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    plugin_id TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    config JSONB DEFAULT '{}'::jsonb, -- Encrypted sensitive values
    installed_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    UNIQUE(owner_id, plugin_id)
);

CREATE INDEX idx_installed_plugins_owner ON installed_plugins(owner_id) WHERE deleted = FALSE;

-- ============================================================================
-- EXTENSION 13: WEBHOOKS
-- Outgoing webhook endpoints
-- ============================================================================

CREATE TABLE webhook_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    url TEXT NOT NULL,
    secret TEXT NOT NULL, -- Signing secret
    events TEXT[] NOT NULL, -- Array of event types
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    failure_count INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_webhook_endpoints_owner ON webhook_endpoints(owner_id) WHERE deleted = FALSE;
CREATE INDEX idx_webhook_endpoints_active ON webhook_endpoints(owner_id, is_active) WHERE deleted = FALSE;

CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    webhook_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    payload JSONB NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    delivered_at TIMESTAMPTZ,
    error TEXT,
    attempts INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id, created_at DESC);
CREATE INDEX idx_webhook_deliveries_recent ON webhook_deliveries(owner_id, created_at DESC);

-- ============================================================================
-- EXTENSION 14: API KEYS
-- API access management
-- ============================================================================

CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL, -- First 12 chars for display
    key_hash TEXT NOT NULL, -- SHA-256 hash of full key
    scopes TEXT[] NOT NULL, -- Array of permission scopes
    description TEXT,
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    rate_limit_per_minute INTEGER DEFAULT 100,
    allowed_ips TEXT[] DEFAULT '{}',
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_api_keys_owner ON api_keys(owner_id) WHERE deleted = FALSE;
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash) WHERE deleted = FALSE AND is_active = TRUE;
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix) WHERE deleted = FALSE;

CREATE TABLE api_key_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_key_usage_key ON api_key_usage(api_key_id, created_at DESC);
CREATE INDEX idx_api_key_usage_recent ON api_key_usage(owner_id, created_at DESC);

-- Partition api_key_usage by month for performance (optional, for high-volume)
-- CREATE TABLE api_key_usage_y2024m01 PARTITION OF api_key_usage
--     FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- ============================================================================
-- FUNCTIONS: API Key validation
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_api_key(key_hash_input TEXT)
RETURNS TABLE (
    api_key_id UUID,
    owner_id UUID,
    scopes TEXT[],
    rate_limit_per_minute INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ak.id,
        ak.owner_id,
        ak.scopes,
        ak.rate_limit_per_minute
    FROM api_keys ak
    WHERE ak.key_hash = key_hash_input
      AND ak.deleted = FALSE
      AND ak.is_active = TRUE
      AND (ak.expires_at IS NULL OR ak.expires_at > NOW());

    -- Update last_used_at
    UPDATE api_keys
    SET last_used_at = NOW()
    WHERE key_hash = key_hash_input
      AND deleted = FALSE
      AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTIONS: Trigger webhooks
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_webhook_event(
    p_owner_id UUID,
    p_event TEXT,
    p_payload JSONB
)
RETURNS INTEGER AS $$
DECLARE
    webhook_count INTEGER := 0;
BEGIN
    -- Queue webhooks for delivery (in production, use pg_notify or a job queue)
    INSERT INTO webhook_deliveries (owner_id, webhook_id, event, payload)
    SELECT
        p_owner_id,
        we.id,
        p_event,
        p_payload
    FROM webhook_endpoints we
    WHERE we.owner_id = p_owner_id
      AND we.deleted = FALSE
      AND we.is_active = TRUE
      AND p_event = ANY(we.events);

    GET DIAGNOSTICS webhook_count = ROW_COUNT;
    RETURN webhook_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- EXTENSION 15: MOBILE SYNC
-- Device sync tracking for offline-first mobile app
-- ============================================================================

CREATE TABLE device_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    device_id TEXT NOT NULL,
    device_name TEXT,
    device_platform TEXT, -- 'ios', 'android'
    app_version TEXT,
    sync_type TEXT NOT NULL, -- 'full', 'incremental'
    records_sent INTEGER DEFAULT 0,
    records_received INTEGER DEFAULT 0,
    duration_ms INTEGER,
    error TEXT,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_device_sync_owner ON device_sync_log(owner_id, synced_at DESC);
CREATE INDEX idx_device_sync_device ON device_sync_log(device_id, synced_at DESC);

-- ============================================================================
-- EXTENSION 16: ROUTE OPTIMIZATION CACHE
-- Cache optimized routes to avoid recalculation
-- ============================================================================

CREATE TABLE route_optimization_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    technician_id UUID REFERENCES team_members(id) ON DELETE CASCADE,
    route_date DATE NOT NULL,
    job_ids UUID[] NOT NULL,
    optimized_order UUID[] NOT NULL,
    total_distance_meters INTEGER,
    total_duration_minutes INTEGER,
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour',
    UNIQUE(owner_id, technician_id, route_date)
);

CREATE INDEX idx_route_cache_lookup ON route_optimization_cache(owner_id, route_date) WHERE expires_at > NOW();
