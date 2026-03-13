-- ============================================================================
-- Migration: Add portal-related columns to estimates table
-- ============================================================================
-- The customer portal needs to:
--   1. Look up estimates by job_id (currently no FK from estimates → jobs)
--   2. Record decline details (declined_at, decline_reason)
--
-- This migration adds those columns without breaking existing functionality.
-- ============================================================================


-- 1. Add job_id column to estimates
-- ============================================================================
-- Allows associating an estimate with a specific job. This is distinct from
-- converted_job_id (which tracks the job created FROM an approved estimate).
-- job_id tracks the job the estimate was created FOR.
ALTER TABLE public.estimates
    ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.estimates.job_id
    IS 'The job this estimate was created for. Distinct from converted_job_id which tracks the job created from an approved estimate.';

CREATE INDEX IF NOT EXISTS idx_estimates_job_id
    ON public.estimates (job_id);


-- 2. Add decline tracking columns
-- ============================================================================
ALTER TABLE public.estimates
    ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ;

ALTER TABLE public.estimates
    ADD COLUMN IF NOT EXISTS decline_reason TEXT;

COMMENT ON COLUMN public.estimates.declined_at
    IS 'Timestamp when the customer declined this estimate via the portal.';
COMMENT ON COLUMN public.estimates.decline_reason
    IS 'Optional reason provided by the customer when declining the estimate.';


-- 3. Backfill job_id from jobs.estimate_id where possible
-- ============================================================================
-- If jobs already reference estimates via jobs.estimate_id, backfill the
-- reverse relationship so existing data is queryable via estimates.job_id.
UPDATE public.estimates e
SET job_id = j.id
FROM public.jobs j
WHERE j.estimate_id = e.id
  AND e.job_id IS NULL;
