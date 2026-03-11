-- Murray's FSM - Audit Log Table (S6 Compliance)
-- ================================================
-- Immutable, append-only audit trail for security-sensitive actions.
-- Covers: auth events, data mutations on critical tables, API key usage,
-- permission changes, and admin actions.

-- 1. Create the audit_log table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id      uuid REFERENCES auth.users(id),         -- who performed the action (null = system)
  actor_email   text,                                     -- denormalized for quick reads
  action        text NOT NULL,                            -- e.g. 'job.created', 'invoice.sent', 'auth.login'
  resource_type text NOT NULL,                            -- e.g. 'job', 'customer', 'api_key', 'auth'
  resource_id   uuid,                                     -- FK to the affected record (nullable for auth events)
  metadata      jsonb DEFAULT '{}'::jsonb,                -- additional context (old/new values, IP, user-agent)
  ip_address    inet,                                     -- client IP
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes for common query patterns
CREATE INDEX idx_audit_log_owner_created ON public.audit_log (owner_id, created_at DESC);
CREATE INDEX idx_audit_log_resource      ON public.audit_log (resource_type, resource_id) WHERE resource_id IS NOT NULL;
CREATE INDEX idx_audit_log_actor         ON public.audit_log (actor_id, created_at DESC) WHERE actor_id IS NOT NULL;
CREATE INDEX idx_audit_log_action        ON public.audit_log (action);

-- 3. RLS: owners can SELECT their own logs. No UPDATE or DELETE allowed.
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs"
  ON public.audit_log FOR SELECT
  USING (owner_id = auth.uid());

-- INSERT is allowed only via service role (server-side) or the owner themselves
CREATE POLICY "Authenticated users can insert audit logs for their org"
  ON public.audit_log FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- Explicitly deny UPDATE and DELETE to make the log immutable
-- (No policies = denied by default when RLS is enabled)

-- 4. Comment for documentation
COMMENT ON TABLE public.audit_log IS 'Immutable audit trail for compliance. No UPDATE/DELETE policies.';
COMMENT ON COLUMN public.audit_log.action IS 'Dot-notation action: auth.login, job.created, invoice.sent, api_key.created, settings.updated';
COMMENT ON COLUMN public.audit_log.metadata IS 'JSON context: { old: {...}, new: {...}, userAgent: "...", reason: "..." }';
