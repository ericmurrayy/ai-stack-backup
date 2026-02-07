-- Revenue Features Migration
-- ==========================
-- Tables for Phone AI, Invoicing, and Reviews

-- ============================================
-- AI CALLS (Retell AI Phone Integration)
-- ============================================

CREATE TABLE IF NOT EXISTS ai_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id TEXT UNIQUE NOT NULL,
  phone_number TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status TEXT NOT NULL DEFAULT 'ringing',
  duration_seconds INTEGER,
  transcript TEXT,
  summary TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  action_required BOOLEAN DEFAULT false,
  transferred BOOLEAN DEFAULT false,
  transfer_reason TEXT,
  analysis JSONB,
  customer_id UUID REFERENCES customers(id),
  job_id UUID REFERENCES jobs(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX idx_ai_calls_phone ON ai_calls(phone_number);
CREATE INDEX idx_ai_calls_status ON ai_calls(status);
CREATE INDEX idx_ai_calls_created ON ai_calls(created_at DESC);

-- ============================================
-- INVOICES
-- ============================================

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id) NOT NULL,
  job_id UUID REFERENCES jobs(id),
  items JSONB NOT NULL DEFAULT '[]',
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled')
  ),
  due_date TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  payment_link TEXT,
  sent_via TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_job ON invoices(job_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due ON invoices(due_date);

-- ============================================
-- REVIEW REQUESTS
-- ============================================

CREATE TABLE IF NOT EXISTS review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) NOT NULL,
  customer_id UUID REFERENCES customers(id) NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'sent', 'clicked', 'reviewed', 'declined')
  ),
  sent_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  follow_up_count INTEGER DEFAULT 0,
  last_follow_up_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_review_requests_job ON review_requests(job_id);
CREATE INDEX idx_review_requests_status ON review_requests(status);
CREATE INDEX idx_review_requests_customer ON review_requests(customer_id);

-- ============================================
-- AI REVENUE TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS ai_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL, -- 'phone_booking', 'invoice_payment', 'google_review'
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  job_id UUID REFERENCES jobs(id),
  invoice_id UUID REFERENCES invoices(id),
  call_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_revenue_source ON ai_revenue(source);
CREATE INDEX idx_ai_revenue_created ON ai_revenue(created_at DESC);

-- ============================================
-- AI TASKS (Follow-ups, Actions)
-- ============================================

CREATE TABLE IF NOT EXISTS ai_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- 'follow_up', 'callback', 'quote'
  reference_type TEXT, -- 'call', 'job', 'customer'
  reference_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  assigned_to UUID,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_tasks_status ON ai_tasks(status);
CREATE INDEX idx_ai_tasks_priority ON ai_tasks(priority);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get call statistics
CREATE OR REPLACE FUNCTION get_call_stats(today_date DATE)
RETURNS TABLE (
  "totalCalls" BIGINT,
  "todayCalls" BIGINT,
  "avgDuration" NUMERIC,
  "appointmentsBooked" BIGINT,
  "transferRate" NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as "totalCalls",
    COUNT(*) FILTER (WHERE DATE(created_at) = today_date)::BIGINT as "todayCalls",
    COALESCE(AVG(duration_seconds), 0)::NUMERIC as "avgDuration",
    COUNT(*) FILTER (WHERE job_id IS NOT NULL)::BIGINT as "appointmentsBooked",
    CASE
      WHEN COUNT(*) > 0
      THEN (COUNT(*) FILTER (WHERE transferred = true)::NUMERIC / COUNT(*)::NUMERIC * 100)
      ELSE 0
    END as "transferRate"
  FROM ai_calls;
END;
$$ LANGUAGE plpgsql;

-- Get invoice statistics
CREATE OR REPLACE FUNCTION get_invoice_stats(month_start TIMESTAMPTZ)
RETURNS TABLE (
  "totalRevenue" NUMERIC,
  "pendingAmount" NUMERIC,
  "overdueAmount" NUMERIC,
  "paidThisMonth" NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(total) FILTER (WHERE status = 'paid'), 0)::NUMERIC as "totalRevenue",
    COALESCE(SUM(total) FILTER (WHERE status IN ('sent', 'viewed')), 0)::NUMERIC as "pendingAmount",
    COALESCE(SUM(total) FILTER (WHERE status = 'overdue'), 0)::NUMERIC as "overdueAmount",
    COALESCE(SUM(total) FILTER (WHERE status = 'paid' AND paid_at >= month_start), 0)::NUMERIC as "paidThisMonth"
  FROM invoices;
END;
$$ LANGUAGE plpgsql;

-- Add review_request_id to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS review_request_id UUID REFERENCES review_requests(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ai_call_id TEXT;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE ai_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tasks ENABLE ROW LEVEL SECURITY;

-- Policies (assuming owner_id column exists or using service role)
-- Adjust based on your auth setup

CREATE POLICY "Service role full access to ai_calls"
  ON ai_calls FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to invoices"
  ON invoices FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to review_requests"
  ON review_requests FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to ai_revenue"
  ON ai_revenue FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to ai_tasks"
  ON ai_tasks FOR ALL
  USING (auth.role() = 'service_role');

-- Grant usage to authenticated users (read-only for most)
CREATE POLICY "Authenticated users can view ai_calls"
  ON ai_calls FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view invoices"
  ON invoices FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view review_requests"
  ON review_requests FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================
-- QUOTES
-- ============================================

CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  labor_hours DECIMAL(5,2),
  labor_rate DECIMAL(10,2),
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired')
  ),
  valid_until TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  job_id UUID REFERENCES jobs(id),
  notes TEXT,
  ai_generated BOOLEAN DEFAULT false,
  job_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quotes_customer ON quotes(customer_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_valid_until ON quotes(valid_until);
CREATE INDEX idx_quotes_created ON quotes(created_at DESC);

-- Add quote_id to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES quotes(id);

-- RLS for quotes
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to quotes"
  ON quotes FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can view quotes"
  ON quotes FOR SELECT
  USING (auth.role() = 'authenticated');

-- Public access for customer quote viewing (by ID)
CREATE POLICY "Public quote access by ID"
  ON quotes FOR SELECT
  USING (true);

-- ============================================
-- SERVICE CATALOG
-- ============================================

CREATE TABLE IF NOT EXISTS service_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  base_price DECIMAL(10,2) NOT NULL,
  price_unit TEXT NOT NULL DEFAULT 'fixed' CHECK (
    price_unit IN ('fixed', 'per_hour', 'per_sqft', 'per_unit')
  ),
  estimated_hours DECIMAL(5,2),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_service_catalog_category ON service_catalog(category);
CREATE INDEX idx_service_catalog_active ON service_catalog(active);

-- Seed default service catalog
INSERT INTO service_catalog (name, description, category, base_price, price_unit, estimated_hours) VALUES
  -- HVAC
  ('AC Tune-Up', 'Annual AC maintenance', 'HVAC', 129.00, 'fixed', 1.5),
  ('Furnace Tune-Up', 'Annual furnace maintenance', 'HVAC', 99.00, 'fixed', 1.0),
  ('AC Repair - Minor', 'Minor AC repair', 'HVAC', 250.00, 'fixed', 2.0),
  ('AC Repair - Major', 'Major AC repair', 'HVAC', 500.00, 'fixed', 4.0),
  ('AC Installation', 'New AC system installation', 'HVAC', 3500.00, 'fixed', 8.0),
  -- Plumbing
  ('Drain Cleaning', 'Clear clogged drain', 'Plumbing', 150.00, 'fixed', 1.0),
  ('Water Heater Repair', 'Water heater repair', 'Plumbing', 200.00, 'fixed', 2.0),
  ('Pipe Repair', 'Fix leaking pipe', 'Plumbing', 175.00, 'fixed', 1.5),
  ('Faucet Installation', 'Install new faucet', 'Plumbing', 125.00, 'fixed', 1.0),
  ('Toilet Repair', 'Fix toilet issues', 'Plumbing', 100.00, 'fixed', 1.0),
  -- Electrical
  ('Outlet Installation', 'Install new outlet', 'Electrical', 150.00, 'fixed', 1.0),
  ('Light Fixture Installation', 'Install light fixture', 'Electrical', 125.00, 'fixed', 1.0),
  ('Panel Upgrade', 'Electrical panel upgrade', 'Electrical', 2000.00, 'fixed', 6.0),
  ('Ceiling Fan Installation', 'Install ceiling fan', 'Electrical', 175.00, 'fixed', 1.5),
  -- General
  ('Service Call', 'Diagnostic service call', 'General', 89.00, 'fixed', 0.5),
  ('Emergency Service', 'After-hours emergency', 'General', 150.00, 'per_hour', 1.0)
ON CONFLICT DO NOTHING;

-- RLS for service catalog
ALTER TABLE service_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access to service_catalog"
  ON service_catalog FOR SELECT
  USING (true);

CREATE POLICY "Service role full access to service_catalog"
  ON service_catalog FOR ALL
  USING (auth.role() = 'service_role');

-- Get quote statistics
CREATE OR REPLACE FUNCTION get_quote_stats()
RETURNS TABLE (
  "totalQuotes" BIGINT,
  "sentQuotes" BIGINT,
  "acceptedQuotes" BIGINT,
  "conversionRate" NUMERIC,
  "totalValue" NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as "totalQuotes",
    COUNT(*) FILTER (WHERE status IN ('sent', 'viewed', 'accepted'))::BIGINT as "sentQuotes",
    COUNT(*) FILTER (WHERE status = 'accepted')::BIGINT as "acceptedQuotes",
    CASE
      WHEN COUNT(*) FILTER (WHERE status IN ('sent', 'viewed', 'accepted')) > 0
      THEN (COUNT(*) FILTER (WHERE status = 'accepted')::NUMERIC /
            COUNT(*) FILTER (WHERE status IN ('sent', 'viewed', 'accepted'))::NUMERIC * 100)
      ELSE 0
    END as "conversionRate",
    COALESCE(SUM(total) FILTER (WHERE status = 'accepted'), 0)::NUMERIC as "totalValue"
  FROM quotes;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SETTINGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  business_settings JSONB DEFAULT '{}',
  pricing_settings JSONB DEFAULT '{}',
  ai_settings JSONB DEFAULT '{}',
  notification_settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_settings CHECK (id = 1)
);

-- Insert default settings
INSERT INTO settings (id, business_settings, pricing_settings, ai_settings, notification_settings)
VALUES (
  1,
  '{"companyName": "Murray''s Field Service", "phone": "(555) 123-4567", "email": "contact@murrayfsm.com"}',
  '{"defaultLaborRate": 85, "defaultTaxRate": 8.25, "quoteValidityDays": 30, "invoiceDueDays": 14}',
  '{"phoneAiEnabled": true, "aiQuoteGeneration": true, "autoInvoice": true, "autoReviewRequest": true}',
  '{"emailNotifications": true, "smsNotifications": true, "whatsappNotifications": true}'
)
ON CONFLICT (id) DO NOTHING;

-- RLS for settings
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to settings"
  ON settings FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can view settings"
  ON settings FOR SELECT
  USING (auth.role() = 'authenticated');
