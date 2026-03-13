-- ============================================================================
-- Migration: Tighten anon INSERT RLS on jobs table
-- ============================================================================
-- PROBLEM: The jobs_anon_insert policy uses WITH CHECK (true), which means
-- any unauthenticated request can insert ANY data into any column.
-- An attacker could set status='completed', is_spam=false, or inject
-- malicious data into any text field.
--
-- FIX: Restrict anon INSERT to only the columns the booking widget needs,
-- and force safe defaults for everything else via a CHECK expression.
-- ============================================================================

-- Drop the wide-open policy
DROP POLICY IF EXISTS "jobs_anon_insert" ON jobs;

-- Create a restrictive policy for booking widget inserts.
-- The booking widget should only be able to set:
--   phone_number, phone_e164, customer_name, email,
--   city, address, zip_code, service_category, urgency,
--   issue_description, preferred_time, source
--
-- Everything else MUST be the default value:
--   status = 'new', is_spam = false, assigned_technician_id = NULL,
--   scheduled_at = NULL, priority = 'normal'
CREATE POLICY "jobs_anon_insert_restricted"
    ON jobs FOR INSERT
    TO anon
    WITH CHECK (
        -- Must have a phone number (required field)
        phone_number IS NOT NULL
        AND phone_e164 IS NOT NULL
        -- Status must be 'new' — can't skip the queue
        AND status = 'new'
        -- Can't self-assign a technician
        AND assigned_technician_id IS NULL
        -- Can't pre-set schedule
        AND scheduled_at IS NULL
        -- Can't mark as non-spam
        AND is_spam = FALSE
        -- Priority must be normal default
        AND priority = 'normal'
        -- Can't close the job
        AND closed_at IS NULL
        -- Can't link to events, estimates, or recurring jobs
        AND source_event_id IS NULL
        AND estimate_id IS NULL
        AND recurring_job_id IS NULL
    );
