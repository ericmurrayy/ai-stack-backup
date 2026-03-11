-- ============================================================================
-- Migration: Add webhook_deliveries table
-- ============================================================================
-- The webhook system (apps/web/src/app/api/webhooks/[webhookId]/route.ts and
-- .../test/route.ts) reads and writes to a webhook_deliveries table that does
-- not yet exist in the schema.  This migration creates it as an immutable,
-- append-only delivery log tied to webhook_endpoints.
-- ============================================================================


-- 1. Create the webhook_deliveries table
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id       uuid        NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
    event            text        NOT NULL,
    payload          jsonb       NOT NULL DEFAULT '{}'::jsonb,
    response_status  integer,                          -- HTTP status code from the target
    response_body    text,                             -- truncated response for debugging
    error            text,                             -- error message on failure
    attempts         integer     NOT NULL DEFAULT 1,
    duration_ms      integer,                          -- round-trip time in milliseconds
    delivered_at     timestamptz,                      -- set on successful delivery
    created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.webhook_deliveries IS 'Immutable delivery log for outgoing webhooks. No UPDATE/DELETE policies.';
COMMENT ON COLUMN public.webhook_deliveries.response_body IS 'First ~4 KB of the response body, kept for debugging failed deliveries.';
COMMENT ON COLUMN public.webhook_deliveries.duration_ms IS 'Round-trip HTTP request duration in milliseconds.';


-- 2. Indexes for common query patterns
--    (a) List deliveries for a specific endpoint, newest first
CREATE INDEX idx_webhook_deliveries_webhook_created
    ON public.webhook_deliveries (webhook_id, created_at DESC);

--    (b) Filter deliveries by event type, newest first
CREATE INDEX idx_webhook_deliveries_event_created
    ON public.webhook_deliveries (event, created_at DESC);


-- 3. Row Level Security
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- SELECT: owners can read deliveries for their own webhook endpoints
CREATE POLICY "webhook_deliveries_owner_select"
    ON public.webhook_deliveries FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM webhook_endpoints we
            WHERE we.id = webhook_deliveries.webhook_id
              AND we.owner_id = auth.uid()
        )
    );

-- INSERT: authenticated users can record deliveries (server-side via service role
-- or the owner recording a test delivery)
CREATE POLICY "webhook_deliveries_authenticated_insert"
    ON public.webhook_deliveries FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- No UPDATE or DELETE policies: the delivery log is immutable.
-- With RLS enabled and no matching policy, UPDATE and DELETE are denied by default.


-- 4. Cleanup guidance
-- ============================================================================
-- Old webhook deliveries should be purged periodically to keep the table lean.
-- Run the following on a schedule (e.g. pg_cron daily or a Supabase edge
-- function cron) to remove deliveries older than 30 days:
--
--   DELETE FROM public.webhook_deliveries
--   WHERE created_at < now() - interval '30 days';
--
-- If pg_cron is available, register the job:
--
--   SELECT cron.schedule(
--       'purge-old-webhook-deliveries',
--       '0 3 * * *',   -- daily at 03:00 UTC
--       $$DELETE FROM public.webhook_deliveries
--         WHERE created_at < now() - interval '30 days'$$
--   );
-- ============================================================================
