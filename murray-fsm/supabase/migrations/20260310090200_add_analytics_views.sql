-- ============================================================================
-- Migration: Add Analytics Materialized Views
-- ============================================================================
-- Materialized views for dashboard analytics. These pre-aggregate data from
-- jobs, invoices, payments, and technicians tables for fast dashboard queries.
--
-- IMPORTANT: Materialized views do NOT support Row Level Security (RLS).
-- All queries against these views MUST filter by owner_id in the application
-- layer (API route). Never expose these views to the client directly.
--
-- Refresh strategy: call refresh_analytics_views() on a cron schedule
-- (e.g. every 15 minutes via pg_cron or a Supabase Edge Function).
-- ============================================================================


-- ============================================================================
-- 1. mv_job_stats_daily — Daily job statistics per owner
-- ============================================================================
-- Tracks new, completed, and cancelled jobs per day in Eastern time.
-- The date column uses America/New_York to match business operations.

CREATE MATERIALIZED VIEW mv_job_stats_daily AS
SELECT
    j.owner_id,
    DATE(j.created_at AT TIME ZONE 'America/New_York') AS date,
    COUNT(*)::INTEGER                                   AS total_jobs,
    COUNT(*) FILTER (WHERE j.status = 'completed')::INTEGER AS completed_jobs,
    COUNT(*) FILTER (WHERE j.status = 'cancelled')::INTEGER AS cancelled_jobs,
    COUNT(*) FILTER (WHERE j.status = 'new')::INTEGER       AS new_jobs
FROM jobs j
WHERE j.deleted = FALSE
  AND j.is_spam = FALSE
GROUP BY j.owner_id, DATE(j.created_at AT TIME ZONE 'America/New_York')
ORDER BY j.owner_id, date DESC;

-- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX idx_mv_job_stats_daily_pk
    ON mv_job_stats_daily (owner_id, date);

COMMENT ON MATERIALIZED VIEW mv_job_stats_daily IS
    'Daily job counts (total, completed, cancelled, new) per owner. '
    'Dates are in America/New_York. Refresh via refresh_analytics_views().';


-- ============================================================================
-- 2. mv_revenue_monthly — Monthly revenue per owner
-- ============================================================================
-- Aggregates invoice and payment data per calendar month.
-- Invoiced totals come from the invoices table.
-- Paid totals come from succeeded payments.
-- Outstanding = invoiced - paid.

CREATE MATERIALIZED VIEW mv_revenue_monthly AS
SELECT
    sub.owner_id,
    sub.month,
    sub.total_invoiced_cents,
    sub.total_paid_cents,
    (sub.total_invoiced_cents - sub.total_paid_cents) AS total_outstanding_cents,
    sub.invoice_count,
    sub.payment_count
FROM (
    SELECT
        COALESCE(inv.owner_id, pay.owner_id) AS owner_id,
        COALESCE(inv.month, pay.month)        AS month,
        COALESCE(inv.total_invoiced_cents, 0) AS total_invoiced_cents,
        COALESCE(pay.total_paid_cents, 0)     AS total_paid_cents,
        COALESCE(inv.invoice_count, 0)        AS invoice_count,
        COALESCE(pay.payment_count, 0)        AS payment_count
    FROM (
        -- Invoice aggregates per month
        SELECT
            i.owner_id,
            DATE_TRUNC('month', i.issue_date)::DATE AS month,
            SUM(i.total_cents)::BIGINT               AS total_invoiced_cents,
            COUNT(*)::INTEGER                        AS invoice_count
        FROM invoices i
        WHERE i.deleted = FALSE
          AND i.status NOT IN ('void', 'written_off')
        GROUP BY i.owner_id, DATE_TRUNC('month', i.issue_date)::DATE
    ) inv
    FULL OUTER JOIN (
        -- Payment aggregates per month
        SELECT
            p.owner_id,
            DATE_TRUNC('month', p.paid_at)::DATE AS month,
            SUM(p.amount_cents)::BIGINT           AS total_paid_cents,
            COUNT(*)::INTEGER                     AS payment_count
        FROM payments p
        WHERE p.deleted = FALSE
          AND p.status = 'succeeded'
          AND p.paid_at IS NOT NULL
        GROUP BY p.owner_id, DATE_TRUNC('month', p.paid_at)::DATE
    ) pay ON inv.owner_id = pay.owner_id AND inv.month = pay.month
) sub
ORDER BY sub.owner_id, sub.month DESC;

-- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX idx_mv_revenue_monthly_pk
    ON mv_revenue_monthly (owner_id, month);

COMMENT ON MATERIALIZED VIEW mv_revenue_monthly IS
    'Monthly revenue summary per owner: invoiced, paid, and outstanding amounts in cents. '
    'Refresh via refresh_analytics_views().';


-- ============================================================================
-- 3. mv_technician_performance — Technician productivity metrics
-- ============================================================================
-- Measures completed jobs, average completion time, and revenue generated
-- per technician per month. Completion hours are calculated as the difference
-- between job creation and closed_at timestamp.

CREATE MATERIALIZED VIEW mv_technician_performance AS
SELECT
    j.owner_id,
    t.id                                              AS technician_id,
    t.name                                            AS technician_name,
    DATE_TRUNC('month', j.closed_at)::DATE            AS period_start,
    COUNT(*)::INTEGER                                 AS jobs_completed,
    ROUND(
        AVG(
            EXTRACT(EPOCH FROM (j.closed_at - j.created_at)) / 3600.0
        )::NUMERIC, 2
    )                                                 AS avg_completion_hours,
    COALESCE(SUM(inv.total_cents), 0)::BIGINT         AS total_revenue_cents
FROM jobs j
INNER JOIN technicians t ON t.id = j.assigned_technician_id
LEFT JOIN invoices inv ON inv.job_id = j.id
    AND inv.deleted = FALSE
    AND inv.status NOT IN ('void', 'written_off')
WHERE j.deleted = FALSE
  AND j.is_spam = FALSE
  AND j.status = 'completed'
  AND j.closed_at IS NOT NULL
  AND j.assigned_technician_id IS NOT NULL
GROUP BY j.owner_id, t.id, t.name, DATE_TRUNC('month', j.closed_at)::DATE
ORDER BY j.owner_id, period_start DESC, jobs_completed DESC;

-- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX idx_mv_technician_performance_pk
    ON mv_technician_performance (owner_id, technician_id, period_start);

COMMENT ON MATERIALIZED VIEW mv_technician_performance IS
    'Monthly technician productivity: completed jobs, avg completion hours, '
    'and revenue generated. Refresh via refresh_analytics_views().';


-- ============================================================================
-- 4. mv_service_category_breakdown — Service category distribution
-- ============================================================================
-- Shows how many jobs fall into each service_category, along with
-- total and average revenue per category.

CREATE MATERIALIZED VIEW mv_service_category_breakdown AS
SELECT
    j.owner_id,
    j.service_category::TEXT                           AS service_category,
    COUNT(*)::INTEGER                                  AS job_count,
    COALESCE(SUM(inv.total_cents), 0)::BIGINT          AS total_revenue_cents,
    COALESCE(
        ROUND(AVG(inv.total_cents))::BIGINT, 0
    )                                                  AS avg_job_value_cents
FROM jobs j
LEFT JOIN invoices inv ON inv.job_id = j.id
    AND inv.deleted = FALSE
    AND inv.status NOT IN ('void', 'written_off')
WHERE j.deleted = FALSE
  AND j.is_spam = FALSE
GROUP BY j.owner_id, j.service_category
ORDER BY j.owner_id, job_count DESC;

-- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX idx_mv_service_category_breakdown_pk
    ON mv_service_category_breakdown (owner_id, service_category);

COMMENT ON MATERIALIZED VIEW mv_service_category_breakdown IS
    'Service category job counts and revenue per owner. '
    'Refresh via refresh_analytics_views().';


-- ============================================================================
-- 5. refresh_analytics_views() — Refreshes all materialized views concurrently
-- ============================================================================
-- CONCURRENTLY allows reads while refreshing (requires unique indexes above).
-- Call this from pg_cron, a Supabase Edge Function, or an API endpoint.

CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_job_stats_daily;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_revenue_monthly;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_technician_performance;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_service_category_breakdown;
END;
$$;

COMMENT ON FUNCTION refresh_analytics_views() IS
    'Refreshes all analytics materialized views concurrently. '
    'Safe to call during live traffic. Recommended interval: every 15 minutes.';


-- ============================================================================
-- Initial population
-- ============================================================================
-- Materialized views are populated on CREATE, so no explicit refresh needed
-- after this migration. Subsequent refreshes should use the function above.
