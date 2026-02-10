-- Job Execution Loop v1 Migration
-- Adds audit_log table and enhances action_queue for full execution lifecycle

-- ============================================================================
-- AUDIT LOG
-- Tracks every mutation in the system for debugging and compliance
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    actor TEXT NOT NULL,               -- user UUID, 'system', 'n8n', 'mcp'
    action TEXT NOT NULL,              -- 'create', 'update', 'delete', 'approve', 'reject', 'execute'
    entity_type TEXT NOT NULL,         -- 'job', 'customer', 'lead', 'action', 'invoice', 'payment'
    entity_id UUID,
    diff JSONB DEFAULT '{}'::jsonb,    -- { before: {...}, after: {...} }
    metadata JSONB DEFAULT '{}'::jsonb,-- extra context (ip, device, source)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_owner ON audit_log(owner_id, created_at DESC);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_actor ON audit_log(actor, created_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log(action);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit logs"
    ON audit_log FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own audit logs"
    ON audit_log FOR INSERT
    WITH CHECK (owner_id = auth.uid());

-- Service role bypass for server-side writes
CREATE POLICY "Service role full access to audit_log"
    ON audit_log
    USING (auth.role() = 'service_role');

-- ============================================================================
-- ACTION QUEUE ENHANCEMENTS
-- Add result column, idempotency_key, and retry tracking
-- ============================================================================
ALTER TABLE action_queue ADD COLUMN IF NOT EXISTS result JSONB DEFAULT '{}'::jsonb;
ALTER TABLE action_queue ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE action_queue ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE action_queue ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3;
ALTER TABLE action_queue ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE action_queue ADD COLUMN IF NOT EXISTS lead_id UUID;
ALTER TABLE action_queue ADD COLUMN IF NOT EXISTS job_id UUID;

-- Idempotency: prevent duplicate action execution
CREATE UNIQUE INDEX IF NOT EXISTS idx_action_queue_idempotency
    ON action_queue(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Index for finding retryable failed actions
CREATE INDEX IF NOT EXISTS idx_action_queue_retry
    ON action_queue(owner_id, status, next_retry_at)
    WHERE status = 'failed' AND retry_count < max_retries;

-- Index for lead-linked actions
CREATE INDEX IF NOT EXISTS idx_action_queue_lead ON action_queue(lead_id) WHERE lead_id IS NOT NULL;

-- Index for job-linked actions
CREATE INDEX IF NOT EXISTS idx_action_queue_job ON action_queue(job_id) WHERE job_id IS NOT NULL;

-- ============================================================================
-- LEADS TABLE ENHANCEMENTS
-- Add fields needed for the job execution loop
-- ============================================================================
ALTER TABLE leads ADD COLUMN IF NOT EXISTS issue_summary TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS service_area TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS preferred_times JSONB DEFAULT '[]'::jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT 'normal'; -- 'emergency', 'urgent', 'normal', 'flexible'
ALTER TABLE leads ADD COLUMN IF NOT EXISTS inbound_channel TEXT; -- 'phone', 'sms', 'web', 'referral'

-- ============================================================================
-- DEFAULT PIPELINE STAGES
-- Insert standard stages if they don't exist
-- ============================================================================
INSERT INTO pipeline_stages (owner_id, name, color, sort_order, is_won, is_lost)
SELECT
    p.id,
    stage.name,
    stage.color,
    stage.sort_order,
    stage.is_won,
    stage.is_lost
FROM profiles p
CROSS JOIN (VALUES
    ('New Lead', '#3b82f6', 1, false, false),
    ('Contacted', '#8b5cf6', 2, false, false),
    ('Quote Sent', '#f59e0b', 3, false, false),
    ('Negotiating', '#ef4444', 4, false, false),
    ('Won', '#22c55e', 5, true, false),
    ('Lost', '#6b7280', 6, false, true)
) AS stage(name, color, sort_order, is_won, is_lost)
WHERE NOT EXISTS (
    SELECT 1 FROM pipeline_stages ps WHERE ps.owner_id = p.id
);

-- ============================================================================
-- SERVICE ROLE POLICIES
-- Allow server-side operations on action_queue and audit_log
-- ============================================================================

-- action_queue: service role needs to insert/update for automation
CREATE POLICY "Service role full access to action_queue"
    ON action_queue
    USING (auth.role() = 'service_role');

-- leads: service role needs to create leads from webhooks
CREATE POLICY "Service role full access to leads"
    ON leads
    USING (auth.role() = 'service_role');

-- customers: service role needs to upsert from webhooks
CREATE POLICY "Service role full access to customers"
    ON customers
    USING (auth.role() = 'service_role');

-- jobs: service role needs to create from approved actions
CREATE POLICY "Service role full access to jobs"
    ON jobs
    USING (auth.role() = 'service_role');
