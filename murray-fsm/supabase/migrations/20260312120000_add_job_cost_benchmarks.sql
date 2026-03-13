-- ============================================================================
-- Migration: Add job cost benchmarks and profitability view
-- ============================================================================
-- Date: 2026-03-12
-- Ticket: MUR-10
--
-- Adds infrastructure for tracking profitability per job type:
--   1. job_cost_benchmarks  — configurable labor + parts cost targets per
--                             service_type, scoped per owner with a company-
--                             wide default row (owner_id = all-zeros UUID).
--   2. v_job_profitability  — live view joining jobs + invoices + benchmarks
--                             to produce monthly margin % per service_type.
--
-- Alert threshold: margin_pct < 40 % signals a below-target job type.
-- ============================================================================

BEGIN;

-- ============================================================================
-- TABLE: job_cost_benchmarks
-- ============================================================================
-- Stores expected (benchmark) labor and parts costs in cents for each
-- service_type. Owners may override the company defaults by inserting rows
-- with their own owner_id. The view uses COALESCE to fall back to the default
-- row (owner_id = '00000000-0000-0000-0000-000000000000') when no owner-
-- specific row exists.

CREATE TABLE job_cost_benchmarks (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id            UUID        NOT NULL,
    service_type        TEXT        NOT NULL,
    labor_cost_cents    INTEGER     NOT NULL CHECK (labor_cost_cents >= 0),
    parts_cost_cents    INTEGER     NOT NULL CHECK (parts_cost_cents >= 0),
    -- Derived total — stored so it can be indexed and queried efficiently
    total_cost_cents    INTEGER     GENERATED ALWAYS AS (labor_cost_cents + parts_cost_cents) STORED,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT job_cost_benchmarks_owner_service_unique
        UNIQUE (owner_id, service_type)
);

-- Keep updated_at current on every write
CREATE OR REPLACE FUNCTION update_job_cost_benchmarks_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_job_cost_benchmarks_updated_at
    BEFORE UPDATE ON job_cost_benchmarks
    FOR EACH ROW EXECUTE FUNCTION update_job_cost_benchmarks_updated_at();

-- Index for the COALESCE fallback lookup pattern used in the view
CREATE INDEX idx_job_cost_benchmarks_owner_type
    ON job_cost_benchmarks (owner_id, service_type);

COMMENT ON TABLE job_cost_benchmarks IS
    'Expected labor + parts costs (cents) per service_type. '
    'owner_id = ''00000000-0000-0000-0000-000000000000'' is the company-wide default. '
    'Owners may override defaults with their own rows. '
    'Alert: raise a flag when margin_pct (from v_job_profitability) drops below 40%.';

COMMENT ON COLUMN job_cost_benchmarks.total_cost_cents IS
    'Generated always as labor_cost_cents + parts_cost_cents (stored).';


-- ============================================================================
-- SEED: company-wide default benchmarks
-- ============================================================================
-- The all-zeros UUID acts as a sentinel "default owner" that is never a real
-- auth.users row. The view falls back to this row when no owner-specific
-- benchmark exists for a given service_type.
--
-- Values are based on Murray's Garage Door Services typical job economics:
--   emergency_repair : labor $150   + parts $50    = $200   total
--   standard_repair  : labor $112.50 + parts $75   = $187.50 total
--   installation     : labor $225   + parts $400   = $625   total
--   maintenance      : labor $75    + parts $10    = $85    total

INSERT INTO job_cost_benchmarks (owner_id, service_type, labor_cost_cents, parts_cost_cents)
VALUES
    ('00000000-0000-0000-0000-000000000000', 'emergency_repair', 15000,  5000),
    ('00000000-0000-0000-0000-000000000000', 'standard_repair',  11250,  7500),
    ('00000000-0000-0000-0000-000000000000', 'installation',     22500, 40000),
    ('00000000-0000-0000-0000-000000000000', 'maintenance',       7500,  1000);


-- ============================================================================
-- RLS: job_cost_benchmarks
-- ============================================================================
-- Authenticated users can read benchmarks for their own owner_id or the
-- company default. Only their own rows can be mutated.

ALTER TABLE job_cost_benchmarks ENABLE ROW LEVEL SECURITY;

-- SELECT: own rows + company defaults
CREATE POLICY "benchmarks_owner_select"
    ON job_cost_benchmarks FOR SELECT TO authenticated
    USING (
        owner_id = auth.uid()
        OR owner_id = '00000000-0000-0000-0000-000000000000'
    );

-- INSERT / UPDATE / DELETE: only own rows (not the shared default row)
CREATE POLICY "benchmarks_owner_insert"
    ON job_cost_benchmarks FOR INSERT TO authenticated
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "benchmarks_owner_update"
    ON job_cost_benchmarks FOR UPDATE TO authenticated
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "benchmarks_owner_delete"
    ON job_cost_benchmarks FOR DELETE TO authenticated
    USING (owner_id = auth.uid());


-- ============================================================================
-- VIEW: v_job_profitability
-- ============================================================================
-- Produces one row per (owner_id, service_type, month) showing:
--   avg_revenue_cents  — average invoice total for non-void invoices
--   total_cost_cents   — benchmark cost for the service type (owner override
--                        if present, otherwise company default)
--   margin_pct         — (avg_revenue - total_cost) / avg_revenue * 100
--                        NULL when avg_revenue_cents is 0 or no invoices
--   invoice_count      — number of qualifying invoices in the period
--
-- NOTE: This is a regular (non-materialized) view so it always reflects live
-- data. For dashboard performance, consider wrapping in a function or
-- refreshing a materialized copy via refresh_analytics_views().

CREATE OR REPLACE VIEW v_job_profitability AS
WITH invoice_agg AS (
    -- Aggregate invoices per owner, service_type, calendar month
    SELECT
        i.owner_id,
        j.service_type,
        DATE_TRUNC('month', i.issue_date::TIMESTAMPTZ)::DATE AS month,
        COUNT(*)::INTEGER                                     AS invoice_count,
        ROUND(AVG(i.total_cents))::BIGINT                    AS avg_revenue_cents
    FROM invoices i
    INNER JOIN jobs j
        ON j.id = i.job_id
        AND j.deleted = FALSE
        AND j.is_spam  = FALSE
    WHERE i.deleted = FALSE
      AND i.status NOT IN ('void', 'written_off')
      AND j.service_type IS NOT NULL
    GROUP BY
        i.owner_id,
        j.service_type,
        DATE_TRUNC('month', i.issue_date::TIMESTAMPTZ)::DATE
),
benchmark_resolved AS (
    -- For each (owner_id, service_type) in invoice_agg, pick the owner-
    -- specific benchmark if available, otherwise fall back to the company
    -- default (owner_id = all-zeros UUID).
    SELECT DISTINCT ON (ia.owner_id, ia.service_type)
        ia.owner_id,
        ia.service_type,
        COALESCE(own_b.total_cost_cents, def_b.total_cost_cents) AS total_cost_cents,
        COALESCE(own_b.labor_cost_cents, def_b.labor_cost_cents) AS labor_cost_cents,
        COALESCE(own_b.parts_cost_cents, def_b.parts_cost_cents) AS parts_cost_cents
    FROM invoice_agg ia
    LEFT JOIN job_cost_benchmarks own_b
        ON own_b.owner_id    = ia.owner_id
       AND own_b.service_type = ia.service_type
    LEFT JOIN job_cost_benchmarks def_b
        ON def_b.owner_id    = '00000000-0000-0000-0000-000000000000'
       AND def_b.service_type = ia.service_type
)
SELECT
    ia.owner_id,
    ia.service_type,
    ia.month,
    ia.invoice_count,
    ia.avg_revenue_cents,
    br.total_cost_cents,
    br.labor_cost_cents,
    br.parts_cost_cents,
    CASE
        WHEN ia.avg_revenue_cents IS NULL OR ia.avg_revenue_cents = 0 THEN NULL
        ELSE ROUND(
            (ia.avg_revenue_cents - br.total_cost_cents)::NUMERIC
            / ia.avg_revenue_cents::NUMERIC
            * 100,
            2
        )
    END AS margin_pct,
    CASE
        WHEN ia.avg_revenue_cents IS NULL OR ia.avg_revenue_cents = 0 THEN FALSE
        WHEN br.total_cost_cents IS NULL THEN FALSE
        ELSE (
            (ia.avg_revenue_cents - br.total_cost_cents)::NUMERIC
            / ia.avg_revenue_cents::NUMERIC
            * 100
        ) < 40
    END AS below_threshold
FROM invoice_agg ia
LEFT JOIN benchmark_resolved br
    ON br.owner_id    = ia.owner_id
   AND br.service_type = ia.service_type
ORDER BY
    ia.owner_id,
    ia.month DESC,
    ia.service_type;

COMMENT ON VIEW v_job_profitability IS
    'Live profitability view per (owner, service_type, month). '
    'margin_pct = (avg_revenue - benchmark_cost) / avg_revenue * 100. '
    'below_threshold = TRUE when margin_pct < 40%. '
    'Uses owner-specific benchmark when available, falls back to company default. '
    'Refresh: no action needed (live view). For materialized copy call refresh_analytics_views().';

COMMIT;
