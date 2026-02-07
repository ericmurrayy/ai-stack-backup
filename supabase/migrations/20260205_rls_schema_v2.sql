-- Murray FSM - RLS Policies for Schema V2 Tables
-- ==============================================
-- Ensures multi-tenant data isolation

-- Helper function to get current user's owner_id
CREATE OR REPLACE FUNCTION auth.owner_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    auth.uid(),
    (current_setting('request.jwt.claims', true)::json->>'sub')::uuid
  );
$$ LANGUAGE sql STABLE;

-- ============================================================================
-- TEAM MEMBERS
-- ============================================================================

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_members_select_own"
  ON team_members FOR SELECT
  USING (owner_id = auth.owner_id() OR user_id = auth.uid());

CREATE POLICY "team_members_insert_own"
  ON team_members FOR INSERT
  WITH CHECK (owner_id = auth.owner_id());

CREATE POLICY "team_members_update_own"
  ON team_members FOR UPDATE
  USING (owner_id = auth.owner_id());

CREATE POLICY "team_members_delete_own"
  ON team_members FOR DELETE
  USING (owner_id = auth.owner_id());

-- ============================================================================
-- TECHNICIAN LOCATIONS
-- ============================================================================

ALTER TABLE technician_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tech_locations_select_own"
  ON technician_locations FOR SELECT
  USING (owner_id = auth.owner_id());

CREATE POLICY "tech_locations_insert_own"
  ON technician_locations FOR INSERT
  WITH CHECK (owner_id = auth.owner_id());

-- ============================================================================
-- TIME ENTRIES
-- ============================================================================

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_entries_select_own"
  ON time_entries FOR SELECT
  USING (owner_id = auth.owner_id());

CREATE POLICY "time_entries_insert_own"
  ON time_entries FOR INSERT
  WITH CHECK (owner_id = auth.owner_id());

CREATE POLICY "time_entries_update_own"
  ON time_entries FOR UPDATE
  USING (owner_id = auth.owner_id());

CREATE POLICY "time_entries_delete_own"
  ON time_entries FOR DELETE
  USING (owner_id = auth.owner_id());

-- ============================================================================
-- PIPELINE STAGES
-- ============================================================================

ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pipeline_stages_select_own"
  ON pipeline_stages FOR SELECT
  USING (owner_id = auth.owner_id());

CREATE POLICY "pipeline_stages_insert_own"
  ON pipeline_stages FOR INSERT
  WITH CHECK (owner_id = auth.owner_id());

CREATE POLICY "pipeline_stages_update_own"
  ON pipeline_stages FOR UPDATE
  USING (owner_id = auth.owner_id());

CREATE POLICY "pipeline_stages_delete_own"
  ON pipeline_stages FOR DELETE
  USING (owner_id = auth.owner_id());

-- ============================================================================
-- LEADS
-- ============================================================================

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_select_own"
  ON leads FOR SELECT
  USING (owner_id = auth.owner_id());

CREATE POLICY "leads_insert_own"
  ON leads FOR INSERT
  WITH CHECK (owner_id = auth.owner_id());

CREATE POLICY "leads_update_own"
  ON leads FOR UPDATE
  USING (owner_id = auth.owner_id());

CREATE POLICY "leads_delete_own"
  ON leads FOR DELETE
  USING (owner_id = auth.owner_id());

-- ============================================================================
-- LEAD ACTIVITIES
-- ============================================================================

ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_activities_select_own"
  ON lead_activities FOR SELECT
  USING (owner_id = auth.owner_id());

CREATE POLICY "lead_activities_insert_own"
  ON lead_activities FOR INSERT
  WITH CHECK (owner_id = auth.owner_id());

CREATE POLICY "lead_activities_delete_own"
  ON lead_activities FOR DELETE
  USING (owner_id = auth.owner_id());

-- ============================================================================
-- MAINTENANCE CONTRACTS
-- ============================================================================

ALTER TABLE maintenance_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "maintenance_contracts_select_own"
  ON maintenance_contracts FOR SELECT
  USING (owner_id = auth.owner_id());

CREATE POLICY "maintenance_contracts_insert_own"
  ON maintenance_contracts FOR INSERT
  WITH CHECK (owner_id = auth.owner_id());

CREATE POLICY "maintenance_contracts_update_own"
  ON maintenance_contracts FOR UPDATE
  USING (owner_id = auth.owner_id());

CREATE POLICY "maintenance_contracts_delete_own"
  ON maintenance_contracts FOR DELETE
  USING (owner_id = auth.owner_id());

-- ============================================================================
-- INVENTORY ITEMS
-- ============================================================================

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_items_select_own"
  ON inventory_items FOR SELECT
  USING (owner_id = auth.owner_id());

CREATE POLICY "inventory_items_insert_own"
  ON inventory_items FOR INSERT
  WITH CHECK (owner_id = auth.owner_id());

CREATE POLICY "inventory_items_update_own"
  ON inventory_items FOR UPDATE
  USING (owner_id = auth.owner_id());

CREATE POLICY "inventory_items_delete_own"
  ON inventory_items FOR DELETE
  USING (owner_id = auth.owner_id());

-- ============================================================================
-- JOB PARTS
-- ============================================================================

ALTER TABLE job_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_parts_select_own"
  ON job_parts FOR SELECT
  USING (owner_id = auth.owner_id());

CREATE POLICY "job_parts_insert_own"
  ON job_parts FOR INSERT
  WITH CHECK (owner_id = auth.owner_id());

CREATE POLICY "job_parts_update_own"
  ON job_parts FOR UPDATE
  USING (owner_id = auth.owner_id());

CREATE POLICY "job_parts_delete_own"
  ON job_parts FOR DELETE
  USING (owner_id = auth.owner_id());

-- ============================================================================
-- INVENTORY TRANSACTIONS
-- ============================================================================

ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_tx_select_own"
  ON inventory_transactions FOR SELECT
  USING (owner_id = auth.owner_id());

CREATE POLICY "inventory_tx_insert_own"
  ON inventory_transactions FOR INSERT
  WITH CHECK (owner_id = auth.owner_id());

-- ============================================================================
-- REVIEWS
-- ============================================================================

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_select_own"
  ON reviews FOR SELECT
  USING (owner_id = auth.owner_id());

CREATE POLICY "reviews_insert_own"
  ON reviews FOR INSERT
  WITH CHECK (owner_id = auth.owner_id());

CREATE POLICY "reviews_update_own"
  ON reviews FOR UPDATE
  USING (owner_id = auth.owner_id());

CREATE POLICY "reviews_delete_own"
  ON reviews FOR DELETE
  USING (owner_id = auth.owner_id());

-- ============================================================================
-- REVIEW REQUESTS
-- ============================================================================

ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_requests_select_own"
  ON review_requests FOR SELECT
  USING (owner_id = auth.owner_id());

CREATE POLICY "review_requests_insert_own"
  ON review_requests FOR INSERT
  WITH CHECK (owner_id = auth.owner_id());

-- ============================================================================
-- MARKETING CAMPAIGNS
-- ============================================================================

ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing_campaigns_select_own"
  ON marketing_campaigns FOR SELECT
  USING (owner_id = auth.owner_id());

CREATE POLICY "marketing_campaigns_insert_own"
  ON marketing_campaigns FOR INSERT
  WITH CHECK (owner_id = auth.owner_id());

CREATE POLICY "marketing_campaigns_update_own"
  ON marketing_campaigns FOR UPDATE
  USING (owner_id = auth.owner_id());

CREATE POLICY "marketing_campaigns_delete_own"
  ON marketing_campaigns FOR DELETE
  USING (owner_id = auth.owner_id());

-- ============================================================================
-- CAMPAIGN RECIPIENTS
-- ============================================================================

ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_recipients_select_own"
  ON campaign_recipients FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM marketing_campaigns mc
    WHERE mc.id = campaign_recipients.campaign_id
    AND mc.owner_id = auth.owner_id()
  ));

CREATE POLICY "campaign_recipients_insert_own"
  ON campaign_recipients FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM marketing_campaigns mc
    WHERE mc.id = campaign_recipients.campaign_id
    AND mc.owner_id = auth.owner_id()
  ));

-- ============================================================================
-- REFERRALS
-- ============================================================================

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrals_select_own"
  ON referrals FOR SELECT
  USING (owner_id = auth.owner_id());

CREATE POLICY "referrals_insert_own"
  ON referrals FOR INSERT
  WITH CHECK (owner_id = auth.owner_id());

CREATE POLICY "referrals_update_own"
  ON referrals FOR UPDATE
  USING (owner_id = auth.owner_id());

CREATE POLICY "referrals_delete_own"
  ON referrals FOR DELETE
  USING (owner_id = auth.owner_id());

-- ============================================================================
-- CUSTOMER PORTAL TOKENS
-- ============================================================================

ALTER TABLE customer_portal_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal_tokens_select_own"
  ON customer_portal_tokens FOR SELECT
  USING (owner_id = auth.owner_id());

CREATE POLICY "portal_tokens_insert_own"
  ON customer_portal_tokens FOR INSERT
  WITH CHECK (owner_id = auth.owner_id());

CREATE POLICY "portal_tokens_update_own"
  ON customer_portal_tokens FOR UPDATE
  USING (owner_id = auth.owner_id());

-- Public access by token for portal users
CREATE POLICY "portal_tokens_public_select"
  ON customer_portal_tokens FOR SELECT
  USING (token = current_setting('app.portal_token', true) AND is_active = TRUE);

-- ============================================================================
-- SERVICE AREAS
-- ============================================================================

ALTER TABLE service_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_areas_select_own"
  ON service_areas FOR SELECT
  USING (owner_id = auth.owner_id());

CREATE POLICY "service_areas_insert_own"
  ON service_areas FOR INSERT
  WITH CHECK (owner_id = auth.owner_id());

CREATE POLICY "service_areas_update_own"
  ON service_areas FOR UPDATE
  USING (owner_id = auth.owner_id());

CREATE POLICY "service_areas_delete_own"
  ON service_areas FOR DELETE
  USING (owner_id = auth.owner_id());

-- ============================================================================
-- ROUTE CACHE
-- ============================================================================

ALTER TABLE route_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "route_cache_select_own"
  ON route_cache FOR SELECT
  USING (owner_id = auth.owner_id());

CREATE POLICY "route_cache_insert_own"
  ON route_cache FOR INSERT
  WITH CHECK (owner_id = auth.owner_id());

CREATE POLICY "route_cache_update_own"
  ON route_cache FOR UPDATE
  USING (owner_id = auth.owner_id());

CREATE POLICY "route_cache_delete_own"
  ON route_cache FOR DELETE
  USING (owner_id = auth.owner_id());

-- ============================================================================
-- DAILY METRICS
-- ============================================================================

ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_metrics_select_own"
  ON daily_metrics FOR SELECT
  USING (owner_id = auth.owner_id());

CREATE POLICY "daily_metrics_insert_own"
  ON daily_metrics FOR INSERT
  WITH CHECK (owner_id = auth.owner_id());

CREATE POLICY "daily_metrics_update_own"
  ON daily_metrics FOR UPDATE
  USING (owner_id = auth.owner_id());

-- ============================================================================
-- BUSINESS SETTINGS
-- ============================================================================

ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_settings_select_own"
  ON business_settings FOR SELECT
  USING (owner_id = auth.owner_id());

CREATE POLICY "business_settings_insert_own"
  ON business_settings FOR INSERT
  WITH CHECK (owner_id = auth.owner_id());

CREATE POLICY "business_settings_update_own"
  ON business_settings FOR UPDATE
  USING (owner_id = auth.owner_id());

-- ============================================================================
-- TAGS
-- ============================================================================

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags_select_own"
  ON tags FOR SELECT
  USING (owner_id = auth.owner_id());

CREATE POLICY "tags_insert_own"
  ON tags FOR INSERT
  WITH CHECK (owner_id = auth.owner_id());

CREATE POLICY "tags_delete_own"
  ON tags FOR DELETE
  USING (owner_id = auth.owner_id());

-- ============================================================================
-- CUSTOM FIELD DEFINITIONS
-- ============================================================================

ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_fields_select_own"
  ON custom_field_definitions FOR SELECT
  USING (owner_id = auth.owner_id());

CREATE POLICY "custom_fields_insert_own"
  ON custom_field_definitions FOR INSERT
  WITH CHECK (owner_id = auth.owner_id());

CREATE POLICY "custom_fields_update_own"
  ON custom_field_definitions FOR UPDATE
  USING (owner_id = auth.owner_id());

CREATE POLICY "custom_fields_delete_own"
  ON custom_field_definitions FOR DELETE
  USING (owner_id = auth.owner_id());

-- ============================================================================
-- INSTALLED PLUGINS
-- ============================================================================

ALTER TABLE installed_plugins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "installed_plugins_select_own"
  ON installed_plugins FOR SELECT
  USING (owner_id = auth.owner_id());

CREATE POLICY "installed_plugins_insert_own"
  ON installed_plugins FOR INSERT
  WITH CHECK (owner_id = auth.owner_id());

CREATE POLICY "installed_plugins_update_own"
  ON installed_plugins FOR UPDATE
  USING (owner_id = auth.owner_id());

CREATE POLICY "installed_plugins_delete_own"
  ON installed_plugins FOR DELETE
  USING (owner_id = auth.owner_id());

-- ============================================================================
-- WEBHOOK ENDPOINTS
-- ============================================================================

ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_endpoints_select_own"
  ON webhook_endpoints FOR SELECT
  USING (owner_id = auth.owner_id());

CREATE POLICY "webhook_endpoints_insert_own"
  ON webhook_endpoints FOR INSERT
  WITH CHECK (owner_id = auth.owner_id());

CREATE POLICY "webhook_endpoints_update_own"
  ON webhook_endpoints FOR UPDATE
  USING (owner_id = auth.owner_id());

CREATE POLICY "webhook_endpoints_delete_own"
  ON webhook_endpoints FOR DELETE
  USING (owner_id = auth.owner_id());

-- ============================================================================
-- WEBHOOK DELIVERIES
-- ============================================================================

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_deliveries_select_own"
  ON webhook_deliveries FOR SELECT
  USING (owner_id = auth.owner_id());

CREATE POLICY "webhook_deliveries_insert_own"
  ON webhook_deliveries FOR INSERT
  WITH CHECK (owner_id = auth.owner_id());

-- ============================================================================
-- API KEYS
-- ============================================================================

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_keys_select_own"
  ON api_keys FOR SELECT
  USING (owner_id = auth.owner_id());

CREATE POLICY "api_keys_insert_own"
  ON api_keys FOR INSERT
  WITH CHECK (owner_id = auth.owner_id());

CREATE POLICY "api_keys_update_own"
  ON api_keys FOR UPDATE
  USING (owner_id = auth.owner_id());

CREATE POLICY "api_keys_delete_own"
  ON api_keys FOR DELETE
  USING (owner_id = auth.owner_id());

-- ============================================================================
-- API KEY USAGE
-- ============================================================================

ALTER TABLE api_key_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_key_usage_select_own"
  ON api_key_usage FOR SELECT
  USING (owner_id = auth.owner_id());

CREATE POLICY "api_key_usage_insert_own"
  ON api_key_usage FOR INSERT
  WITH CHECK (owner_id = auth.owner_id());

-- ============================================================================
-- DEVICE SYNC LOG
-- ============================================================================

ALTER TABLE device_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "device_sync_log_select_own"
  ON device_sync_log FOR SELECT
  USING (owner_id = auth.owner_id());

CREATE POLICY "device_sync_log_insert_own"
  ON device_sync_log FOR INSERT
  WITH CHECK (owner_id = auth.owner_id());

-- ============================================================================
-- ROUTE OPTIMIZATION CACHE
-- ============================================================================

ALTER TABLE route_optimization_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "route_opt_cache_select_own"
  ON route_optimization_cache FOR SELECT
  USING (owner_id = auth.owner_id());

CREATE POLICY "route_opt_cache_insert_own"
  ON route_optimization_cache FOR INSERT
  WITH CHECK (owner_id = auth.owner_id());

CREATE POLICY "route_opt_cache_update_own"
  ON route_optimization_cache FOR UPDATE
  USING (owner_id = auth.owner_id());

CREATE POLICY "route_opt_cache_delete_own"
  ON route_optimization_cache FOR DELETE
  USING (owner_id = auth.owner_id());

-- ============================================================================
-- GRANT SERVICE ROLE BYPASS
-- ============================================================================
-- The service role should bypass RLS for admin operations

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
