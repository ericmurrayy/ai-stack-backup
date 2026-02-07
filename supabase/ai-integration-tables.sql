-- Murray's FSM - AI Integration Tables
-- =====================================
-- Tables for Jarvis AI Assistant, BOSS Agent, and clawd memory sync

-- ============================================================================
-- AI MEMORY SYNC
-- Synchronize with ~/clawd/ files for persistent AI identity/memory
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    category TEXT NOT NULL, -- 'soul', 'identity', 'user', 'capabilities', 'memory', 'tools'
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    source TEXT DEFAULT 'manual', -- 'manual', 'clawd_sync', 'jarvis', 'boss'
    synced_from_file TEXT, -- e.g., 'SOUL.md', 'memory/2025-01-28.md'
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    UNIQUE(owner_id, category, key)
);

CREATE INDEX idx_ai_memory_owner ON ai_memory(owner_id, category);
CREATE INDEX idx_ai_memory_sync ON ai_memory(owner_id, last_synced_at);

-- Trigger for updated_at
CREATE TRIGGER update_ai_memory_updated_at
    BEFORE UPDATE ON ai_memory
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- AI ACTIONS LOG
-- Track all actions taken by BOSS agent and other AI agents
-- ============================================================================

CREATE TYPE ai_action_status AS ENUM ('pending', 'approved', 'rejected', 'executing', 'completed', 'failed');

CREATE TABLE IF NOT EXISTS ai_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    agent TEXT NOT NULL, -- 'boss', 'jarvis', 'fsm-agent', 'browser-agent', etc.
    action_type TEXT NOT NULL, -- 'create_job', 'send_message', 'follow_up', 'create_invoice', etc.
    target TEXT, -- Customer name, phone, job ID, etc.
    payload JSONB DEFAULT '{}'::jsonb,
    status ai_action_status DEFAULT 'pending',
    priority INTEGER DEFAULT 5, -- 1=highest, 10=lowest
    requires_approval BOOLEAN DEFAULT TRUE,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    rejected_reason TEXT,
    result TEXT,
    error TEXT,
    reasoning TEXT, -- AI's reasoning for this action
    context JSONB DEFAULT '{}'::jsonb, -- Relevant context at time of decision
    executed_at TIMESTAMPTZ,
    scheduled_for TIMESTAMPTZ, -- For delayed actions
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_ai_actions_owner ON ai_actions(owner_id, created_at DESC);
CREATE INDEX idx_ai_actions_status ON ai_actions(owner_id, status) WHERE deleted = FALSE;
CREATE INDEX idx_ai_actions_pending ON ai_actions(owner_id, priority ASC, created_at ASC)
    WHERE status = 'pending' AND deleted = FALSE;
CREATE INDEX idx_ai_actions_scheduled ON ai_actions(scheduled_for)
    WHERE status = 'pending' AND scheduled_for IS NOT NULL AND deleted = FALSE;

CREATE TRIGGER update_ai_actions_updated_at
    BEFORE UPDATE ON ai_actions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- AI DECISIONS LOG
-- Track AI decision-making for learning and auditing
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    agent TEXT NOT NULL,
    decision_type TEXT NOT NULL, -- 'lead_qualification', 'scheduling', 'pricing', 'follow_up_channel'
    context TEXT NOT NULL, -- What was being decided
    options JSONB NOT NULL, -- Available options that were considered
    chosen_option TEXT NOT NULL,
    reasoning TEXT NOT NULL, -- Why this option was chosen
    confidence NUMERIC(3,2), -- 0.00 to 1.00
    outcome TEXT, -- Actual outcome after decision was implemented
    outcome_rating INTEGER CHECK (outcome_rating >= 1 AND outcome_rating <= 5), -- 1=bad, 5=great
    feedback TEXT, -- Human feedback on decision quality
    model_used TEXT, -- 'claude-opus-4-5', 'dolphin-mistral', etc.
    tokens_used INTEGER,
    latency_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_ai_decisions_owner ON ai_decisions(owner_id, created_at DESC);
CREATE INDEX idx_ai_decisions_type ON ai_decisions(owner_id, decision_type);
CREATE INDEX idx_ai_decisions_agent ON ai_decisions(owner_id, agent);

-- ============================================================================
-- AI CONVERSATIONS
-- Store conversation history with AI assistant
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    session_id TEXT NOT NULL, -- Group messages in a session
    role TEXT NOT NULL, -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    model_used TEXT,
    source TEXT DEFAULT 'web', -- 'web', 'mobile', 'api', 'tui', 'aionui'
    tokens_input INTEGER,
    tokens_output INTEGER,
    latency_ms INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb, -- Tool calls, sources, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_ai_conversations_session ON ai_conversations(owner_id, session_id, created_at);
CREATE INDEX idx_ai_conversations_recent ON ai_conversations(owner_id, created_at DESC);

-- ============================================================================
-- AI REVENUE TRACKING
-- Track revenue metrics for BOSS agent goal ($1M/year)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_revenue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    source TEXT NOT NULL, -- Customer name, job type, etc.
    category TEXT NOT NULL, -- 'job_completed', 'recurring_contract', 'referral', 'upsell'
    amount_cents INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'income', 'expense'
    related_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    related_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    related_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    attributed_to TEXT, -- 'human', 'boss', 'jarvis', 'automation'
    notes TEXT,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_ai_revenue_owner ON ai_revenue(owner_id, date DESC);
CREATE INDEX idx_ai_revenue_type ON ai_revenue(owner_id, type, date DESC);
CREATE INDEX idx_ai_revenue_attributed ON ai_revenue(owner_id, attributed_to, date DESC);

-- ============================================================================
-- AI AGENT STATUS
-- Track status of running AI agents
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_agent_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    agent_name TEXT NOT NULL,
    status TEXT DEFAULT 'stopped', -- 'running', 'stopped', 'error', 'idle'
    model TEXT,
    role TEXT,
    current_task TEXT,
    last_heartbeat TIMESTAMPTZ,
    last_action_at TIMESTAMPTZ,
    actions_today INTEGER DEFAULT 0,
    errors_today INTEGER DEFAULT 0,
    config JSONB DEFAULT '{}'::jsonb,
    metrics JSONB DEFAULT '{}'::jsonb, -- Custom metrics per agent
    started_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(owner_id, agent_name)
);

CREATE INDEX idx_ai_agent_status_owner ON ai_agent_status(owner_id);
CREATE INDEX idx_ai_agent_status_running ON ai_agent_status(owner_id) WHERE status = 'running';

CREATE TRIGGER update_ai_agent_status_updated_at
    BEFORE UPDATE ON ai_agent_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- AI SCHEDULED TASKS (cron-like)
-- Tasks that AI agents should run on schedule
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_scheduled_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    agent TEXT NOT NULL, -- Which agent handles this
    task_type TEXT NOT NULL, -- 'health_check', 'follow_up_scan', 'revenue_report', etc.
    schedule TEXT NOT NULL, -- Cron expression: '0 9 * * *' (daily 9am)
    timezone TEXT DEFAULT 'America/New_York',
    payload JSONB DEFAULT '{}'::jsonb,
    is_enabled BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMPTZ,
    last_run_status TEXT,
    last_run_result TEXT,
    next_run_at TIMESTAMPTZ,
    run_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    UNIQUE(owner_id, name)
);

CREATE INDEX idx_ai_scheduled_tasks_owner ON ai_scheduled_tasks(owner_id) WHERE deleted = FALSE;
CREATE INDEX idx_ai_scheduled_tasks_next_run ON ai_scheduled_tasks(next_run_at)
    WHERE is_enabled = TRUE AND deleted = FALSE;

CREATE TRIGGER update_ai_scheduled_tasks_updated_at
    BEFORE UPDATE ON ai_scheduled_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTIONS: AI Revenue Summary
-- ============================================================================

CREATE OR REPLACE FUNCTION get_ai_revenue_summary(
    p_owner_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    total_income_cents BIGINT,
    total_expense_cents BIGINT,
    profit_cents BIGINT,
    boss_attributed_cents BIGINT,
    human_attributed_cents BIGINT,
    automation_attributed_cents BIGINT,
    goal_progress_percent NUMERIC(5,2)
) AS $$
DECLARE
    monthly_goal_cents BIGINT := 8333300; -- $83,333/month for $1M/year
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount_cents ELSE 0 END), 0)::BIGINT,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_cents ELSE 0 END), 0)::BIGINT,
        (COALESCE(SUM(CASE WHEN type = 'income' THEN amount_cents ELSE 0 END), 0) -
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_cents ELSE 0 END), 0))::BIGINT,
        COALESCE(SUM(CASE WHEN attributed_to = 'boss' AND type = 'income' THEN amount_cents ELSE 0 END), 0)::BIGINT,
        COALESCE(SUM(CASE WHEN attributed_to = 'human' AND type = 'income' THEN amount_cents ELSE 0 END), 0)::BIGINT,
        COALESCE(SUM(CASE WHEN attributed_to IN ('jarvis', 'automation') AND type = 'income' THEN amount_cents ELSE 0 END), 0)::BIGINT,
        ROUND(
            (COALESCE(SUM(CASE WHEN type = 'income' THEN amount_cents ELSE 0 END), 0) -
             COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_cents ELSE 0 END), 0))::NUMERIC /
            monthly_goal_cents * 100,
            2
        )
    FROM ai_revenue
    WHERE owner_id = p_owner_id
      AND deleted = FALSE
      AND date >= CURRENT_DATE - p_days;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTIONS: Get Pending AI Actions
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pending_ai_actions(
    p_owner_id UUID,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    agent TEXT,
    action_type TEXT,
    target TEXT,
    payload JSONB,
    priority INTEGER,
    reasoning TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.agent,
        a.action_type,
        a.target,
        a.payload,
        a.priority,
        a.reasoning,
        a.created_at
    FROM ai_actions a
    WHERE a.owner_id = p_owner_id
      AND a.status = 'pending'
      AND a.deleted = FALSE
      AND (a.scheduled_for IS NULL OR a.scheduled_for <= NOW())
    ORDER BY a.priority ASC, a.created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTIONS: Approve/Reject AI Action
-- ============================================================================

CREATE OR REPLACE FUNCTION approve_ai_action(
    p_action_id UUID,
    p_approved_by UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE ai_actions
    SET
        status = 'approved',
        approved_by = p_approved_by,
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_action_id
      AND status = 'pending';

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reject_ai_action(
    p_action_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE ai_actions
    SET
        status = 'rejected',
        rejected_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_action_id
      AND status = 'pending';

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTIONS: Log AI Action Completion
-- ============================================================================

CREATE OR REPLACE FUNCTION complete_ai_action(
    p_action_id UUID,
    p_result TEXT,
    p_error TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE ai_actions
    SET
        status = CASE WHEN p_error IS NULL THEN 'completed' ELSE 'failed' END,
        result = p_result,
        error = p_error,
        executed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_action_id
      AND status IN ('approved', 'executing');

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE ai_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_scheduled_tasks ENABLE ROW LEVEL SECURITY;

-- Policies (same pattern as other tables)
CREATE POLICY "Users can view own ai_memory" ON ai_memory
    FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own ai_memory" ON ai_memory
    FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own ai_memory" ON ai_memory
    FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can view own ai_actions" ON ai_actions
    FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own ai_actions" ON ai_actions
    FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own ai_actions" ON ai_actions
    FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can view own ai_decisions" ON ai_decisions
    FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own ai_decisions" ON ai_decisions
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can view own ai_conversations" ON ai_conversations
    FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own ai_conversations" ON ai_conversations
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can view own ai_revenue" ON ai_revenue
    FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own ai_revenue" ON ai_revenue
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can view own ai_agent_status" ON ai_agent_status
    FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can manage own ai_agent_status" ON ai_agent_status
    FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "Users can view own ai_scheduled_tasks" ON ai_scheduled_tasks
    FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can manage own ai_scheduled_tasks" ON ai_scheduled_tasks
    FOR ALL USING (auth.uid() = owner_id);

-- ============================================================================
-- DEFAULT DATA: Insert default scheduled tasks
-- ============================================================================

-- These will be inserted for each owner when they enable AI features
-- Example insert (run per-owner):
-- INSERT INTO ai_scheduled_tasks (owner_id, name, description, agent, task_type, schedule) VALUES
-- (owner_uuid, 'Morning Briefing', 'Generate daily briefing', 'jarvis', 'morning_briefing', '0 7 * * *'),
-- (owner_uuid, 'Health Check', 'System health check', 'jarvis', 'health_check', '*/5 * * * *'),
-- (owner_uuid, 'Lead Follow-up Scan', 'Check for leads needing follow-up', 'boss', 'follow_up_scan', '0 9,14 * * *'),
-- (owner_uuid, 'Revenue Report', 'Daily revenue summary', 'boss', 'revenue_report', '0 18 * * *'),
-- (owner_uuid, 'Memory Consolidation', 'Consolidate daily memories', 'jarvis', 'memory_consolidation', '0 23 * * 0');
