-- ============================================================================
-- Migration: Add indexes to schema-v2
-- ============================================================================
-- Zero indexes existed. This adds indexes for every common query pattern.
-- All CREATE INDEX IF NOT EXISTS for idempotency.
-- ============================================================================

-- ============================================================================
-- SECTION 1: CORE TABLES
-- ============================================================================

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_owner_id ON profiles (owner_id);

-- customers
CREATE INDEX IF NOT EXISTS idx_customers_owner_id ON customers (owner_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers (phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers (email);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (name);

-- locations
CREATE INDEX IF NOT EXISTS idx_locations_owner_id ON locations (owner_id);
CREATE INDEX IF NOT EXISTS idx_locations_customer_id ON locations (customer_id);

-- technicians
CREATE INDEX IF NOT EXISTS idx_technicians_owner_id ON technicians (owner_id);
CREATE INDEX IF NOT EXISTS idx_technicians_profile_id ON technicians (profile_id);
CREATE INDEX IF NOT EXISTS idx_technicians_is_active ON technicians (is_active) WHERE is_active = TRUE;

-- ============================================================================
-- SECTION 2: EVENT INGESTION
-- ============================================================================

-- raw_events
CREATE INDEX IF NOT EXISTS idx_raw_events_external_id ON raw_events (external_id);
CREATE INDEX IF NOT EXISTS idx_raw_events_phone_number ON raw_events (phone_number);
CREATE INDEX IF NOT EXISTS idx_raw_events_phone_e164 ON raw_events (phone_e164);
CREATE INDEX IF NOT EXISTS idx_raw_events_processing_status ON raw_events (processing_status) WHERE processing_status IN ('pending', 'awaiting_transcript', 'processing');
CREATE INDEX IF NOT EXISTS idx_raw_events_job_id ON raw_events (job_id);
CREATE INDEX IF NOT EXISTS idx_raw_events_event_timestamp ON raw_events (event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_raw_events_created_at ON raw_events (created_at DESC);

-- ============================================================================
-- SECTION 3: JOBS (most queried table)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs (status);
CREATE INDEX IF NOT EXISTS idx_jobs_phone_number ON jobs (phone_number);
CREATE INDEX IF NOT EXISTS idx_jobs_phone_e164 ON jobs (phone_e164);
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_technician_id ON jobs (assigned_technician_id);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_at ON jobs (scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_updated_at ON jobs (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_is_spam ON jobs (is_spam) WHERE is_spam = TRUE;
CREATE INDEX IF NOT EXISTS idx_jobs_source_event_id ON jobs (source_event_id);
CREATE INDEX IF NOT EXISTS idx_jobs_service_category ON jobs (service_category);
CREATE INDEX IF NOT EXISTS idx_jobs_urgency ON jobs (urgency);
-- Composite: dashboard "active jobs" query
CREATE INDEX IF NOT EXISTS idx_jobs_status_scheduled ON jobs (status, scheduled_at DESC)
    WHERE status NOT IN ('completed', 'cancelled', 'spam');
-- Composite: technician schedule view
CREATE INDEX IF NOT EXISTS idx_jobs_tech_status_scheduled ON jobs (assigned_technician_id, status, scheduled_at)
    WHERE status NOT IN ('completed', 'cancelled', 'spam');

-- interactions
CREATE INDEX IF NOT EXISTS idx_interactions_job_id ON interactions (job_id);
CREATE INDEX IF NOT EXISTS idx_interactions_raw_event_id ON interactions (raw_event_id);
CREATE INDEX IF NOT EXISTS idx_interactions_occurred_at ON interactions (occurred_at DESC);

-- follow_ups
CREATE INDEX IF NOT EXISTS idx_follow_ups_job_id ON follow_ups (job_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_status_scheduled ON follow_ups (status, scheduled_for)
    WHERE status = 'pending';

-- ============================================================================
-- SECTION 4: ESTIMATES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_estimates_owner_id ON estimates (owner_id);
CREATE INDEX IF NOT EXISTS idx_estimates_customer_id ON estimates (customer_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates (status);
CREATE INDEX IF NOT EXISTS idx_estimates_created_at ON estimates (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_estimate_items_estimate_id ON estimate_items (estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimate_items_owner_id ON estimate_items (owner_id);

-- ============================================================================
-- SECTION 5: RECURRING JOBS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_recurring_jobs_owner_id ON recurring_jobs (owner_id);
CREATE INDEX IF NOT EXISTS idx_recurring_jobs_customer_id ON recurring_jobs (customer_id);
CREATE INDEX IF NOT EXISTS idx_recurring_jobs_next_occurrence ON recurring_jobs (next_occurrence_at)
    WHERE is_active = TRUE;

-- ============================================================================
-- SECTION 6: TIME TRACKING
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_time_entries_owner_id ON time_entries (owner_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_technician_id ON time_entries (technician_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_job_id ON time_entries (job_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_started_at ON time_entries (started_at DESC);

-- ============================================================================
-- SECTION 7: COMMUNICATIONS
-- ============================================================================

-- call_logs
CREATE INDEX IF NOT EXISTS idx_call_logs_owner_id ON call_logs (owner_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_external_call_id ON call_logs (external_call_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_from_phone ON call_logs (from_phone);
CREATE INDEX IF NOT EXISTS idx_call_logs_to_phone ON call_logs (to_phone);
CREATE INDEX IF NOT EXISTS idx_call_logs_started_at ON call_logs (started_at DESC);

-- message_logs
CREATE INDEX IF NOT EXISTS idx_message_logs_owner_id ON message_logs (owner_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_external_message_id ON message_logs (external_message_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_from_phone ON message_logs (from_phone);
CREATE INDEX IF NOT EXISTS idx_message_logs_to_phone ON message_logs (to_phone);
CREATE INDEX IF NOT EXISTS idx_message_logs_created_at ON message_logs (created_at DESC);

-- ============================================================================
-- SECTION 8: PIPELINE & LEADS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_owner_id ON pipeline_stages (owner_id);

CREATE INDEX IF NOT EXISTS idx_leads_owner_id ON leads (owner_id);
CREATE INDEX IF NOT EXISTS idx_leads_customer_id ON leads (customer_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage_id ON leads (stage_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_technician_id ON leads (assigned_technician_id);

-- ============================================================================
-- SECTION 9: NOTIFICATIONS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_notifications_owner_id ON notifications (owner_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications (is_read, created_at DESC)
    WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications (entity_type, entity_id);

-- ============================================================================
-- SECTION 10: REVIEWS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_reviews_owner_id ON reviews (owner_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer_id ON reviews (customer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_job_id ON reviews (job_id);

-- ============================================================================
-- SECTION 11: SERVICE AGREEMENTS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_service_agreements_owner_id ON service_agreements (owner_id);
CREATE INDEX IF NOT EXISTS idx_service_agreements_customer_id ON service_agreements (customer_id);
CREATE INDEX IF NOT EXISTS idx_service_agreements_status ON service_agreements (status)
    WHERE status = 'active';

-- ============================================================================
-- SECTION 12: CAMPAIGNS & MARKETING
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_campaigns_owner_id ON campaigns (owner_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns (status);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_id ON campaign_recipients (campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_customer_id ON campaign_recipients (customer_id);

CREATE INDEX IF NOT EXISTS idx_referrals_owner_id ON referrals (owner_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_customer_id ON referrals (referrer_customer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referral_code ON referrals (referral_code);

-- ============================================================================
-- SECTION 13: INVENTORY
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_inventory_items_owner_id ON inventory_items (owner_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_sku ON inventory_items (sku);
CREATE INDEX IF NOT EXISTS idx_inventory_items_low_stock ON inventory_items (qty_on_hand, reorder_point)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item_id ON inventory_transactions (item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_job_id ON inventory_transactions (job_id);

-- ============================================================================
-- SECTION 14: AUTOMATION & ACTION QUEUE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_action_queue_owner_id ON action_queue (owner_id);
CREATE INDEX IF NOT EXISTS idx_action_queue_status ON action_queue (status)
    WHERE status = 'pending';

-- ============================================================================
-- SECTION 15: BUSINESS SETTINGS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_business_settings_owner_id ON business_settings (owner_id);

-- ============================================================================
-- SECTION 16: TAGS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tags_owner_id ON tags (owner_id);
CREATE INDEX IF NOT EXISTS idx_tags_entity ON tags (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags (tag);

-- ============================================================================
-- SECTION 17: INTEGRATIONS & API
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_api_keys_owner_id ON api_keys (owner_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys (key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON api_keys (key_prefix);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_owner_id ON webhook_endpoints (owner_id);

CREATE INDEX IF NOT EXISTS idx_installed_plugins_owner_id ON installed_plugins (owner_id);
CREATE INDEX IF NOT EXISTS idx_installed_plugins_plugin_id ON installed_plugins (plugin_id);
