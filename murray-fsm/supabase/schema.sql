-- Murray's FSM - Supabase Schema
-- =================================
-- Offline-first Field Service Management System

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- HELPER FUNCTION: Auto-update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TABLE 1: profiles
-- User profiles linked to auth.users
-- ============================================================================
CREATE TABLE profiles (
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

CREATE INDEX idx_profiles_owner_updated ON profiles(owner_id, updated_at);

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 2: customers
-- Customer records
-- ============================================================================
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_customers_owner_updated ON customers(owner_id, updated_at);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_email ON customers(email);

CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 3: locations
-- Customer service locations
-- ============================================================================
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
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

CREATE INDEX idx_locations_owner_updated ON locations(owner_id, updated_at);
CREATE INDEX idx_locations_customer ON locations(customer_id);

CREATE TRIGGER update_locations_updated_at
    BEFORE UPDATE ON locations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 4: jobs
-- Service jobs / work orders
-- ============================================================================
CREATE TYPE job_status AS ENUM ('scheduled', 'in_progress', 'completed', 'canceled');

CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
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
    diagnostics JSONB DEFAULT '{}'::jsonb,
    total_estimate_cents INTEGER DEFAULT 0,
    total_invoice_cents INTEGER DEFAULT 0,
    paid_cents INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_jobs_owner_updated ON jobs(owner_id, updated_at);
CREATE INDEX idx_jobs_customer ON jobs(customer_id);
CREATE INDEX idx_jobs_location ON jobs(location_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_scheduled ON jobs(scheduled_start, scheduled_end);
CREATE INDEX idx_jobs_owner_scheduled ON jobs(owner_id, scheduled_start);

CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 5: job_events
-- Event log for job state changes and activities
-- ============================================================================
CREATE TABLE job_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_job_events_owner_updated ON job_events(owner_id, updated_at);
CREATE INDEX idx_job_events_job ON job_events(job_id);
CREATE INDEX idx_job_events_type ON job_events(event_type);

CREATE TRIGGER update_job_events_updated_at
    BEFORE UPDATE ON job_events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 6: job_photos
-- Photos attached to jobs
-- ============================================================================
CREATE TYPE photo_kind AS ENUM ('before', 'after', 'other');

CREATE TABLE job_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    kind photo_kind DEFAULT 'other',
    storage_bucket TEXT NOT NULL DEFAULT 'job-photos',
    storage_path TEXT NOT NULL,
    mime_type TEXT,
    captured_at TIMESTAMPTZ DEFAULT NOW(),
    caption TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_job_photos_owner_updated ON job_photos(owner_id, updated_at);
CREATE INDEX idx_job_photos_job ON job_photos(job_id);

CREATE TRIGGER update_job_photos_updated_at
    BEFORE UPDATE ON job_photos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 7: job_signatures
-- Customer signatures for jobs
-- ============================================================================
CREATE TABLE job_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    signer_name TEXT NOT NULL,
    signed_at TIMESTAMPTZ DEFAULT NOW(),
    storage_bucket TEXT NOT NULL DEFAULT 'job-signatures',
    storage_path TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_job_signatures_owner_updated ON job_signatures(owner_id, updated_at);
CREATE INDEX idx_job_signatures_job ON job_signatures(job_id);

CREATE TRIGGER update_job_signatures_updated_at
    BEFORE UPDATE ON job_signatures
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 8: line_items
-- Estimate and invoice line items
-- ============================================================================
CREATE TYPE line_item_kind AS ENUM ('estimate', 'invoice');

CREATE TABLE line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    kind line_item_kind NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    qty NUMERIC(10, 2) DEFAULT 1,
    unit_price_cents INTEGER NOT NULL,
    total_cents INTEGER GENERATED ALWAYS AS (ROUND(qty * unit_price_cents)::INTEGER) STORED,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_line_items_owner_updated ON line_items(owner_id, updated_at);
CREATE INDEX idx_line_items_job ON line_items(job_id);
CREATE INDEX idx_line_items_kind ON line_items(kind);

CREATE TRIGGER update_line_items_updated_at
    BEFORE UPDATE ON line_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 9: payments
-- Payment records
-- ============================================================================
CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'canceled', 'refunded');

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
    provider TEXT DEFAULT 'stripe',
    stripe_payment_intent_id TEXT,
    amount_cents INTEGER NOT NULL,
    status payment_status DEFAULT 'pending',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_payments_owner_updated ON payments(owner_id, updated_at);
CREATE INDEX idx_payments_job ON payments(job_id);
CREATE INDEX idx_payments_stripe_pi ON payments(stripe_payment_intent_id);
CREATE INDEX idx_payments_status ON payments(status);

CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 10: comm_threads
-- Communication threads (calls + texts grouped by contact)
-- ============================================================================
CREATE TABLE comm_threads (
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

CREATE INDEX idx_comm_threads_owner_updated ON comm_threads(owner_id, updated_at);
CREATE INDEX idx_comm_threads_contact ON comm_threads(contact_phone);
CREATE INDEX idx_comm_threads_customer ON comm_threads(customer_id);
CREATE UNIQUE INDEX idx_comm_threads_unique ON comm_threads(owner_id, contact_phone, external_phone_number_id) WHERE deleted = FALSE;

CREATE TRIGGER update_comm_threads_updated_at
    BEFORE UPDATE ON comm_threads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 11: call_logs
-- Call records from Quo/OpenPhone
-- ============================================================================
CREATE TYPE call_direction AS ENUM ('inbound', 'outbound');

CREATE TABLE call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    external_call_id TEXT UNIQUE NOT NULL,
    thread_id UUID REFERENCES comm_threads(id) ON DELETE SET NULL,
    direction call_direction NOT NULL,
    from_phone TEXT NOT NULL,
    to_phone TEXT NOT NULL,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    answered_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    recording_url TEXT,
    transcript TEXT,
    summary TEXT,
    action_items JSONB DEFAULT '[]'::jsonb,
    ai_extraction JSONB DEFAULT '{}'::jsonb,
    related_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    raw_event JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_call_logs_owner_updated ON call_logs(owner_id, updated_at);
CREATE INDEX idx_call_logs_thread ON call_logs(thread_id);
CREATE INDEX idx_call_logs_external ON call_logs(external_call_id);
CREATE INDEX idx_call_logs_direction ON call_logs(direction);
CREATE INDEX idx_call_logs_related_job ON call_logs(related_job_id);

CREATE TRIGGER update_call_logs_updated_at
    BEFORE UPDATE ON call_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 12: message_logs
-- SMS/MMS messages from Quo/OpenPhone
-- ============================================================================
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');

CREATE TABLE message_logs (
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
    delivered_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    ai_extraction JSONB DEFAULT '{}'::jsonb,
    related_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    raw_event JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_message_logs_owner_updated ON message_logs(owner_id, updated_at);
CREATE INDEX idx_message_logs_thread ON message_logs(thread_id);
CREATE INDEX idx_message_logs_external ON message_logs(external_message_id);
CREATE INDEX idx_message_logs_direction ON message_logs(direction);
CREATE INDEX idx_message_logs_related_job ON message_logs(related_job_id);

CREATE TRIGGER update_message_logs_updated_at
    BEFORE UPDATE ON message_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 13: action_queue
-- Approval queue for automated actions
-- ============================================================================
CREATE TYPE action_status AS ENUM ('pending', 'approved', 'rejected', 'executed', 'failed');

CREATE TABLE action_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    source_type TEXT NOT NULL, -- 'call', 'message', 'manual'
    source_id TEXT,
    kind TEXT NOT NULL, -- 'create_job', 'schedule_job', 'reschedule_job', 'create_estimate', 'send_estimate', 'send_sms'
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

CREATE INDEX idx_action_queue_owner_updated ON action_queue(owner_id, updated_at);
CREATE INDEX idx_action_queue_status ON action_queue(status);
CREATE INDEX idx_action_queue_kind ON action_queue(kind);
CREATE INDEX idx_action_queue_pending ON action_queue(owner_id, status) WHERE status = 'pending';

CREATE TRIGGER update_action_queue_updated_at
    BEFORE UPDATE ON action_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 14: automation_events
-- Idempotency tracking for webhook events
-- ============================================================================
CREATE TABLE automation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    source TEXT NOT NULL, -- 'quo_webhook', 'stripe_webhook', 'n8n', 'web', 'mobile'
    event_type TEXT NOT NULL,
    idempotency_key TEXT UNIQUE NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_automation_events_owner_updated ON automation_events(owner_id, updated_at);
CREATE INDEX idx_automation_events_idempotency ON automation_events(idempotency_key);
CREATE INDEX idx_automation_events_source ON automation_events(source);

CREATE TRIGGER update_automation_events_updated_at
    BEFORE UPDATE ON automation_events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 15: calendar_events
-- External calendar event links
-- ============================================================================
CREATE TYPE calendar_provider AS ENUM ('google', 'outlook', 'icloud');
CREATE TYPE calendar_event_status AS ENUM ('created', 'updated', 'deleted');

CREATE TABLE calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    provider calendar_provider NOT NULL,
    external_event_id TEXT,
    calendar_id TEXT,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    status calendar_event_status DEFAULT 'created',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    UNIQUE(job_id, provider)
);

CREATE INDEX idx_calendar_events_owner_updated ON calendar_events(owner_id, updated_at);
CREATE INDEX idx_calendar_events_job ON calendar_events(job_id);
CREATE INDEX idx_calendar_events_external ON calendar_events(external_event_id);

CREATE TRIGGER update_calendar_events_updated_at
    BEFORE UPDATE ON calendar_events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to normalize phone numbers to E.164 format
CREATE OR REPLACE FUNCTION normalize_phone(phone TEXT)
RETURNS TEXT AS $$
DECLARE
    cleaned TEXT;
BEGIN
    -- Remove all non-digit characters
    cleaned := regexp_replace(phone, '[^0-9]', '', 'g');

    -- Handle US numbers
    IF length(cleaned) = 10 THEN
        RETURN '+1' || cleaned;
    ELSIF length(cleaned) = 11 AND substring(cleaned, 1, 1) = '1' THEN
        RETURN '+' || cleaned;
    ELSIF length(cleaned) > 10 AND substring(cleaned, 1, 1) != '+' THEN
        RETURN '+' || cleaned;
    END IF;

    RETURN phone; -- Return original if can't normalize
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate job totals from line items
CREATE OR REPLACE FUNCTION update_job_totals()
RETURNS TRIGGER AS $$
BEGIN
    -- Update estimate totals
    UPDATE jobs SET total_estimate_cents = COALESCE((
        SELECT SUM(total_cents) FROM line_items
        WHERE job_id = COALESCE(NEW.job_id, OLD.job_id)
        AND kind = 'estimate'
        AND deleted = FALSE
    ), 0)
    WHERE id = COALESCE(NEW.job_id, OLD.job_id);

    -- Update invoice totals
    UPDATE jobs SET total_invoice_cents = COALESCE((
        SELECT SUM(total_cents) FROM line_items
        WHERE job_id = COALESCE(NEW.job_id, OLD.job_id)
        AND kind = 'invoice'
        AND deleted = FALSE
    ), 0)
    WHERE id = COALESCE(NEW.job_id, OLD.job_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_job_totals
    AFTER INSERT OR UPDATE OR DELETE ON line_items
    FOR EACH ROW
    EXECUTE FUNCTION update_job_totals();

-- Function to update job paid_cents from payments
CREATE OR REPLACE FUNCTION update_job_paid_cents()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE jobs SET paid_cents = COALESCE((
        SELECT SUM(amount_cents) FROM payments
        WHERE job_id = COALESCE(NEW.job_id, OLD.job_id)
        AND status = 'succeeded'
        AND deleted = FALSE
    ), 0)
    WHERE id = COALESCE(NEW.job_id, OLD.job_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_job_paid_cents
    AFTER INSERT OR UPDATE OR DELETE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_job_paid_cents();

-- ============================================================================
-- STORAGE BUCKETS (Run these after creating the schema)
-- ============================================================================
-- Note: Run these commands in the Supabase dashboard or via the CLI:
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('job-photos', 'job-photos', false);
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('job-signatures', 'job-signatures', false);

-- ============================================================================
-- PROFILE AUTO-CREATION ON USER SIGNUP
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
