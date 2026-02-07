-- Murray FSM - Performance Indexes
-- =================================
-- Optimized indexes for common query patterns

-- ============================================================================
-- JOBS TABLE INDEXES
-- ============================================================================

-- Jobs by scheduled time (calendar/dispatch views)
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_range 
  ON jobs(owner_id, scheduled_start, scheduled_end) 
  WHERE deleted = FALSE;

-- Jobs by status (dashboard filters)
CREATE INDEX IF NOT EXISTS idx_jobs_owner_status 
  ON jobs(owner_id, status) 
  WHERE deleted = FALSE;

-- Jobs by assigned technician (tech schedule view)
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_scheduled 
  ON jobs(assigned_to, scheduled_start) 
  WHERE deleted = FALSE AND assigned_to IS NOT NULL;

-- Jobs by customer (customer history)
CREATE INDEX IF NOT EXISTS idx_jobs_customer_created 
  ON jobs(customer_id, created_at DESC) 
  WHERE deleted = FALSE;

-- Jobs by completion date (reporting)
CREATE INDEX IF NOT EXISTS idx_jobs_completed 
  ON jobs(owner_id, completed_at DESC) 
  WHERE deleted = FALSE AND status = 'completed';

-- Jobs by contract (maintenance tracking)
CREATE INDEX IF NOT EXISTS idx_jobs_contract 
  ON jobs(contract_id) 
  WHERE contract_id IS NOT NULL AND deleted = FALSE;

-- ============================================================================
-- CUSTOMERS TABLE INDEXES
-- ============================================================================

-- Customer search by name
CREATE INDEX IF NOT EXISTS idx_customers_name_search 
  ON customers(owner_id, name) 
  WHERE deleted = FALSE;

-- Customer search by phone
CREATE INDEX IF NOT EXISTS idx_customers_phone_search 
  ON customers(owner_id, phone) 
  WHERE deleted = FALSE AND phone IS NOT NULL;

-- Customer search by email
CREATE INDEX IF NOT EXISTS idx_customers_email_search 
  ON customers(owner_id, email) 
  WHERE deleted = FALSE AND email IS NOT NULL;

-- Customers by lifetime value (high-value customer targeting)
CREATE INDEX IF NOT EXISTS idx_customers_ltv 
  ON customers(owner_id, lifetime_value_cents DESC) 
  WHERE deleted = FALSE;

-- ============================================================================
-- PAYMENTS TABLE INDEXES
-- ============================================================================

-- Payments by status (payment tracking)
CREATE INDEX IF NOT EXISTS idx_payments_owner_status 
  ON payments(owner_id, status) 
  WHERE deleted = FALSE;

-- Payments by job (job payment lookup)
CREATE INDEX IF NOT EXISTS idx_payments_job_status 
  ON payments(job_id, status) 
  WHERE deleted = FALSE;

-- Successful payments by date (revenue reporting)
CREATE INDEX IF NOT EXISTS idx_payments_succeeded_date 
  ON payments(owner_id, created_at DESC) 
  WHERE deleted = FALSE AND status = 'succeeded';

-- ============================================================================
-- LINE ITEMS TABLE INDEXES
-- ============================================================================

-- Line items by job and kind (quote/invoice lookup)
CREATE INDEX IF NOT EXISTS idx_line_items_job_kind 
  ON line_items(job_id, kind) 
  WHERE deleted = FALSE;

-- ============================================================================
-- LEADS TABLE INDEXES
-- ============================================================================

-- Leads by stage (pipeline view)
CREATE INDEX IF NOT EXISTS idx_leads_stage_score 
  ON leads(owner_id, stage_id, score DESC) 
  WHERE deleted = FALSE;

-- Leads by follow-up date (follow-up queue)
CREATE INDEX IF NOT EXISTS idx_leads_follow_up 
  ON leads(owner_id, next_follow_up_at) 
  WHERE deleted = FALSE AND next_follow_up_at IS NOT NULL;

-- Leads by assigned user
CREATE INDEX IF NOT EXISTS idx_leads_assigned 
  ON leads(assigned_to, created_at DESC) 
  WHERE deleted = FALSE AND assigned_to IS NOT NULL;

-- ============================================================================
-- TEAM MEMBERS TABLE INDEXES
-- ============================================================================

-- Active team members
CREATE INDEX IF NOT EXISTS idx_team_members_active 
  ON team_members(owner_id, role) 
  WHERE deleted = FALSE AND is_active = TRUE;

-- Team members by user (auth lookup)
CREATE INDEX IF NOT EXISTS idx_team_members_user 
  ON team_members(user_id) 
  WHERE user_id IS NOT NULL AND deleted = FALSE;

-- ============================================================================
-- TECHNICIAN LOCATIONS TABLE INDEXES
-- ============================================================================

-- Latest location per technician
CREATE INDEX IF NOT EXISTS idx_tech_locations_latest 
  ON technician_locations(team_member_id, recorded_at DESC);

-- ============================================================================
-- TIME ENTRIES TABLE INDEXES
-- ============================================================================

-- Time entries by member and date (timesheet)
CREATE INDEX IF NOT EXISTS idx_time_entries_member_date 
  ON time_entries(team_member_id, clock_in DESC) 
  WHERE deleted = FALSE;

-- Unapproved time entries (approval queue)
CREATE INDEX IF NOT EXISTS idx_time_entries_unapproved 
  ON time_entries(owner_id, clock_in) 
  WHERE deleted = FALSE AND approved = FALSE;

-- ============================================================================
-- INVENTORY TABLE INDEXES
-- ============================================================================

-- Low stock items (reorder alerts)
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock 
  ON inventory_items(owner_id) 
  WHERE deleted = FALSE AND is_active = TRUE AND quantity_on_hand <= reorder_point;

-- Inventory search by SKU
CREATE INDEX IF NOT EXISTS idx_inventory_sku 
  ON inventory_items(owner_id, sku) 
  WHERE deleted = FALSE AND sku IS NOT NULL;

-- Inventory by category
CREATE INDEX IF NOT EXISTS idx_inventory_category 
  ON inventory_items(owner_id, category) 
  WHERE deleted = FALSE;

-- ============================================================================
-- MAINTENANCE CONTRACTS TABLE INDEXES
-- ============================================================================

-- Active contracts
CREATE INDEX IF NOT EXISTS idx_contracts_active 
  ON maintenance_contracts(owner_id, next_service_date) 
  WHERE deleted = FALSE AND is_active = TRUE;

-- Contracts by customer
CREATE INDEX IF NOT EXISTS idx_contracts_customer 
  ON maintenance_contracts(customer_id) 
  WHERE deleted = FALSE;

-- Expiring contracts
CREATE INDEX IF NOT EXISTS idx_contracts_expiring 
  ON maintenance_contracts(owner_id, end_date) 
  WHERE deleted = FALSE AND is_active = TRUE AND end_date IS NOT NULL;

-- ============================================================================
-- REVIEWS TABLE INDEXES
-- ============================================================================

-- Reviews by rating (reputation monitoring)
CREATE INDEX IF NOT EXISTS idx_reviews_rating 
  ON reviews(owner_id, rating, review_date DESC) 
  WHERE deleted = FALSE;

-- Reviews by platform
CREATE INDEX IF NOT EXISTS idx_reviews_platform 
  ON reviews(owner_id, platform) 
  WHERE deleted = FALSE;

-- Reviews needing response
CREATE INDEX IF NOT EXISTS idx_reviews_unresponded 
  ON reviews(owner_id, review_date DESC) 
  WHERE deleted = FALSE AND response IS NULL;

-- ============================================================================
-- MARKETING CAMPAIGNS TABLE INDEXES
-- ============================================================================

-- Active campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_active 
  ON marketing_campaigns(owner_id, status) 
  WHERE deleted = FALSE;

-- Scheduled campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled 
  ON marketing_campaigns(scheduled_at) 
  WHERE deleted = FALSE AND status = 'scheduled';

-- ============================================================================
-- REFERRALS TABLE INDEXES
-- ============================================================================

-- Referrals by status
CREATE INDEX IF NOT EXISTS idx_referrals_status 
  ON referrals(owner_id, status) 
  WHERE deleted = FALSE;

-- Referral code lookup
CREATE INDEX IF NOT EXISTS idx_referrals_code 
  ON referrals(referral_code) 
  WHERE deleted = FALSE;

-- ============================================================================
-- CALL LOGS TABLE INDEXES
-- ============================================================================

-- Calls by customer (communication history)
CREATE INDEX IF NOT EXISTS idx_call_logs_customer 
  ON call_logs(thread_id, created_at DESC) 
  WHERE deleted = FALSE;

-- Recent calls (dashboard)
CREATE INDEX IF NOT EXISTS idx_call_logs_recent 
  ON call_logs(owner_id, created_at DESC) 
  WHERE deleted = FALSE;

-- Calls related to jobs
CREATE INDEX IF NOT EXISTS idx_call_logs_job 
  ON call_logs(related_job_id) 
  WHERE deleted = FALSE AND related_job_id IS NOT NULL;

-- ============================================================================
-- MESSAGE LOGS TABLE INDEXES
-- ============================================================================

-- Messages by thread (conversation view)
CREATE INDEX IF NOT EXISTS idx_message_logs_thread 
  ON message_logs(thread_id, created_at DESC) 
  WHERE deleted = FALSE;

-- Recent messages (inbox)
CREATE INDEX IF NOT EXISTS idx_message_logs_recent 
  ON message_logs(owner_id, created_at DESC) 
  WHERE deleted = FALSE;

-- ============================================================================
-- ACTION QUEUE TABLE INDEXES
-- ============================================================================

-- Pending actions (approval queue)
CREATE INDEX IF NOT EXISTS idx_action_queue_pending 
  ON action_queue(owner_id, created_at DESC) 
  WHERE deleted = FALSE AND status = 'pending';

-- Actions by kind
CREATE INDEX IF NOT EXISTS idx_action_queue_kind 
  ON action_queue(owner_id, kind, status) 
  WHERE deleted = FALSE;

-- ============================================================================
-- DAILY METRICS TABLE INDEXES
-- ============================================================================

-- Metrics by date range (analytics)
CREATE INDEX IF NOT EXISTS idx_daily_metrics_date_range 
  ON daily_metrics(owner_id, date DESC);

-- ============================================================================
-- WEBHOOK DELIVERIES TABLE INDEXES
-- ============================================================================

-- Failed deliveries (retry queue)
CREATE INDEX IF NOT EXISTS idx_webhook_failed 
  ON webhook_deliveries(webhook_id, created_at) 
  WHERE delivered_at IS NULL AND error IS NOT NULL;

-- ============================================================================
-- API KEY USAGE TABLE INDEXES
-- ============================================================================

-- Usage by key (rate limiting)
CREATE INDEX IF NOT EXISTS idx_api_usage_key_time 
  ON api_key_usage(api_key_id, created_at DESC);

-- Recent usage (monitoring)
CREATE INDEX IF NOT EXISTS idx_api_usage_recent 
  ON api_key_usage(owner_id, created_at DESC);

-- ============================================================================
-- FULL TEXT SEARCH INDEXES
-- ============================================================================

-- Customer full-text search
CREATE INDEX IF NOT EXISTS idx_customers_fts 
  ON customers 
  USING gin(to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(email, '') || ' ' || COALESCE(phone, '') || ' ' || COALESCE(notes, '')));

-- Job full-text search
CREATE INDEX IF NOT EXISTS idx_jobs_fts 
  ON jobs 
  USING gin(to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(problem_description, '') || ' ' || COALESCE(internal_notes, '')));
