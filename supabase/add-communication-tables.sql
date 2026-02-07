-- Murray's FSM - Add Communication Tables
-- ========================================
-- Tables for call logs, message logs, and action queue (needed for Zapier integration)

-- CALL DIRECTION ENUM
DO $$ BEGIN
    CREATE TYPE call_direction AS ENUM ('inbound', 'outbound');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CALL LOGS TABLE
CREATE TABLE IF NOT EXISTS call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    external_call_id TEXT UNIQUE NOT NULL,
    thread_id UUID,
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
    related_job_id UUID,
    raw_event JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_call_logs_owner_updated ON call_logs(owner_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_call_logs_external ON call_logs(external_call_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_direction ON call_logs(direction);

-- MESSAGE DIRECTION ENUM
DO $$ BEGIN
    CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- MESSAGE LOGS TABLE
CREATE TABLE IF NOT EXISTS message_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    external_message_id TEXT UNIQUE NOT NULL,
    thread_id UUID,
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
    related_job_id UUID,
    raw_event JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_message_logs_owner_updated ON message_logs(owner_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_message_logs_external ON message_logs(external_message_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_direction ON message_logs(direction);

-- ACTION STATUS ENUM
DO $$ BEGIN
    CREATE TYPE action_status AS ENUM ('pending', 'approved', 'rejected', 'executed', 'failed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ACTION QUEUE TABLE
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

CREATE INDEX IF NOT EXISTS idx_action_queue_owner_updated ON action_queue(owner_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_action_queue_status ON action_queue(status);
CREATE INDEX IF NOT EXISTS idx_action_queue_kind ON action_queue(kind);
CREATE INDEX IF NOT EXISTS idx_action_queue_pending ON action_queue(owner_id, status) WHERE status = 'pending';

-- ENABLE RLS
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_queue ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES FOR CALL_LOGS
DO $$ BEGIN
    CREATE POLICY "Users can view own call_logs" ON call_logs FOR SELECT USING (owner_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can insert own call_logs" ON call_logs FOR INSERT WITH CHECK (owner_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update own call_logs" ON call_logs FOR UPDATE USING (owner_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Service role can manage all call_logs" ON call_logs FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- RLS POLICIES FOR MESSAGE_LOGS
DO $$ BEGIN
    CREATE POLICY "Users can view own message_logs" ON message_logs FOR SELECT USING (owner_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can insert own message_logs" ON message_logs FOR INSERT WITH CHECK (owner_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update own message_logs" ON message_logs FOR UPDATE USING (owner_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Service role can manage all message_logs" ON message_logs FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- RLS POLICIES FOR ACTION_QUEUE
DO $$ BEGIN
    CREATE POLICY "Users can view own action_queue" ON action_queue FOR SELECT USING (owner_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can insert own action_queue" ON action_queue FOR INSERT WITH CHECK (owner_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update own action_queue" ON action_queue FOR UPDATE USING (owner_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Service role can manage all action_queue" ON action_queue FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- TRIGGERS FOR updated_at
DROP TRIGGER IF EXISTS update_call_logs_updated_at ON call_logs;
CREATE TRIGGER update_call_logs_updated_at
    BEFORE UPDATE ON call_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_message_logs_updated_at ON message_logs;
CREATE TRIGGER update_message_logs_updated_at
    BEFORE UPDATE ON message_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_action_queue_updated_at ON action_queue;
CREATE TRIGGER update_action_queue_updated_at
    BEFORE UPDATE ON action_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

SELECT 'Communication tables created successfully!' as message;
