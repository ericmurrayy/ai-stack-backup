-- PR3: Hard Enforce Invariants in Database
-- ==========================================
-- Migration: 20260208_pr3_hard_invariants.sql
--
-- What this does:
-- 1. Adds execution_key UNIQUE constraint to action_queue (idempotent execution)
-- 2. Adds atomic execution helper function (UPDATE...WHERE + executed_at IS NULL)
-- 3. Creates append-only job_events event log table
-- 4. Creates append-only action_events event log table
-- 5. Adds supporting indexes
--
-- Rollback: See bottom of file for rollback SQL

-- ============================================================================
-- 1. IDEMPOTENT EXECUTION CONSTRAINT
-- ============================================================================
-- Prevents the same source_type+source_id+kind combo from being queued twice.
-- Example: two call webhooks for the same call_id cannot create two "create_job" actions.

ALTER TABLE action_queue
  ADD COLUMN IF NOT EXISTS execution_key TEXT;

-- Backfill execution_key for existing rows
UPDATE action_queue
  SET execution_key = source_type || ':' || COALESCE(source_id, '') || ':' || kind
  WHERE execution_key IS NULL;

-- Now add the unique constraint (partial: only non-deleted rows)
CREATE UNIQUE INDEX IF NOT EXISTS uq_action_queue_execution_key
  ON action_queue(execution_key)
  WHERE deleted = FALSE;

-- ============================================================================
-- 2. ATOMIC EXECUTION FUNCTION
-- ============================================================================
-- Called by n8n (or any executor) to atomically mark an action as executed.
-- Returns the action row ONLY if it was approved AND not yet executed.
-- This prevents double-execution even under concurrent webhook retries.

CREATE OR REPLACE FUNCTION execute_approved_action(
  p_action_id UUID,
  p_executed_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS SETOF action_queue
LANGUAGE sql
VOLATILE
AS $$
  UPDATE action_queue
  SET
    status = 'executed',
    executed_at = p_executed_at
  WHERE id = p_action_id
    AND status = 'approved'
    AND executed_at IS NULL
  RETURNING *;
$$;

COMMENT ON FUNCTION execute_approved_action IS
  'Atomically marks an approved action as executed. Returns empty set if already executed or not approved. Used by n8n executor webhook.';

-- ============================================================================
-- 3. APPEND-ONLY EVENT LOG: job_events
-- ============================================================================
-- Immutable audit trail for all job lifecycle events.
-- No UPDATE or DELETE should ever be run against this table (enforced by RLS + convention).

CREATE TABLE IF NOT EXISTS job_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL,
    event_type TEXT NOT NULL,        -- 'created', 'status_changed', 'assigned', 'field_updated', 'photo_added', 'synced'
    actor_type TEXT NOT NULL DEFAULT 'system',  -- 'user', 'system', 'webhook', 'n8n', 'mobile'
    actor_id TEXT,                    -- user UUID or system identifier
    old_value JSONB,                 -- previous state (for changes)
    new_value JSONB,                 -- new state (for changes)
    metadata JSONB DEFAULT '{}'::jsonb,  -- extra context (correlation_id, source, etc.)
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- No updated_at column: events are immutable
-- No deleted column: events are never soft-deleted

CREATE INDEX IF NOT EXISTS idx_job_events_job_created
  ON job_events(job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_events_owner_type
  ON job_events(owner_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_events_created
  ON job_events(created_at DESC);

COMMENT ON TABLE job_events IS
  'Append-only event log for job lifecycle. Never update or delete rows.';

-- ============================================================================
-- 4. APPEND-ONLY EVENT LOG: action_events
-- ============================================================================
-- Immutable audit trail for all action queue state transitions.

CREATE TABLE IF NOT EXISTS action_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_id UUID NOT NULL REFERENCES action_queue(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL,
    event_type TEXT NOT NULL,        -- 'created', 'approved', 'rejected', 'executed', 'failed', 'webhook_sent', 'webhook_failed'
    actor_type TEXT NOT NULL DEFAULT 'system',  -- 'user', 'system', 'webhook', 'n8n'
    actor_id TEXT,                    -- user UUID or system identifier
    old_status TEXT,                  -- previous action_status
    new_status TEXT,                  -- new action_status
    metadata JSONB DEFAULT '{}'::jsonb,  -- extra context (error message, retry count, etc.)
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_action_events_action_created
  ON action_events(action_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_action_events_owner_type
  ON action_events(owner_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_action_events_created
  ON action_events(created_at DESC);

COMMENT ON TABLE action_events IS
  'Append-only event log for action queue state transitions. Never update or delete rows.';

-- ============================================================================
-- 5. ADDITIONAL PERFORMANCE INDEXES
-- ============================================================================

-- Approved-but-not-executed actions (executor queue)
CREATE INDEX IF NOT EXISTS idx_action_queue_approved_unexecuted
  ON action_queue(owner_id, approved_at)
  WHERE status = 'approved' AND executed_at IS NULL AND deleted = FALSE;

-- Failed actions (retry/investigation queue)
CREATE INDEX IF NOT EXISTS idx_action_queue_failed
  ON action_queue(owner_id, updated_at DESC)
  WHERE status = 'failed' AND deleted = FALSE;

-- ============================================================================
-- ROLLBACK NOTES
-- ============================================================================
-- To reverse this migration, run:
--
-- DROP INDEX IF EXISTS idx_action_queue_failed;
-- DROP INDEX IF EXISTS idx_action_queue_approved_unexecuted;
-- DROP TABLE IF EXISTS action_events;
-- DROP TABLE IF EXISTS job_events;
-- DROP FUNCTION IF EXISTS execute_approved_action;
-- DROP INDEX IF EXISTS uq_action_queue_execution_key;
-- ALTER TABLE action_queue DROP COLUMN IF EXISTS execution_key;
