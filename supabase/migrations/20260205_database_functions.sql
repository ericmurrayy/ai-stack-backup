-- Murray FSM - Database Functions
-- ================================
-- Utility functions for business logic

-- ============================================================================
-- JOB PROFITABILITY
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_job_profit(p_job_id UUID)
RETURNS TABLE (
  revenue_cents INTEGER,
  labor_cost_cents INTEGER,
  parts_cost_cents INTEGER,
  total_cost_cents INTEGER,
  profit_cents INTEGER,
  profit_margin NUMERIC
) AS $$
DECLARE
  v_revenue INTEGER;
  v_labor INTEGER;
  v_parts INTEGER;
BEGIN
  -- Get revenue from paid amount or invoice total
  SELECT COALESCE(j.paid_cents, j.total_invoice_cents, 0)
  INTO v_revenue
  FROM jobs j
  WHERE j.id = p_job_id;

  -- Get labor cost from time entries
  SELECT COALESCE(SUM(
    (te.total_minutes::NUMERIC / 60) * (tm.hourly_rate_cents::NUMERIC)
  )::INTEGER, 0)
  INTO v_labor
  FROM time_entries te
  JOIN team_members tm ON te.team_member_id = tm.id
  WHERE te.job_id = p_job_id
    AND te.deleted = FALSE;

  -- Get parts cost
  SELECT COALESCE(SUM(jp.total_cost_cents), 0)
  INTO v_parts
  FROM job_parts jp
  WHERE jp.job_id = p_job_id
    AND jp.deleted = FALSE;

  RETURN QUERY SELECT
    v_revenue AS revenue_cents,
    v_labor AS labor_cost_cents,
    v_parts AS parts_cost_cents,
    (v_labor + v_parts) AS total_cost_cents,
    (v_revenue - v_labor - v_parts) AS profit_cents,
    CASE WHEN v_revenue > 0 
      THEN ROUND(((v_revenue - v_labor - v_parts)::NUMERIC / v_revenue) * 100, 2)
      ELSE 0 
    END AS profit_margin;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- CUSTOMER LIFETIME VALUE
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_customer_ltv(p_customer_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(SUM(paid_cents), 0)::INTEGER
  FROM jobs
  WHERE customer_id = p_customer_id
    AND deleted = FALSE;
$$ LANGUAGE sql STABLE;

-- Trigger to update customer LTV on job payment
CREATE OR REPLACE FUNCTION update_customer_ltv()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE customers 
  SET 
    lifetime_value_cents = calculate_customer_ltv(COALESCE(NEW.customer_id, OLD.customer_id)),
    total_jobs = (
      SELECT COUNT(*) FROM jobs 
      WHERE customer_id = COALESCE(NEW.customer_id, OLD.customer_id)
        AND deleted = FALSE
        AND status NOT IN ('canceled')
    )
  WHERE id = COALESCE(NEW.customer_id, OLD.customer_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_customer_ltv ON jobs;
CREATE TRIGGER trigger_update_customer_ltv
  AFTER INSERT OR UPDATE OF paid_cents, status OR DELETE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_ltv();

-- ============================================================================
-- TECHNICIAN EFFICIENCY SCORE
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_technician_efficiency(
  p_member_id UUID,
  p_period_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  jobs_completed INTEGER,
  total_revenue_cents BIGINT,
  avg_job_duration_minutes NUMERIC,
  on_time_percentage NUMERIC,
  customer_rating_avg NUMERIC,
  efficiency_score NUMERIC
) AS $$
DECLARE
  v_jobs_completed INTEGER;
  v_revenue BIGINT;
  v_avg_duration NUMERIC;
  v_on_time_pct NUMERIC;
  v_avg_rating NUMERIC;
  v_score NUMERIC;
BEGIN
  -- Get completed jobs count and revenue
  SELECT 
    COUNT(*),
    COALESCE(SUM(paid_cents), 0)
  INTO v_jobs_completed, v_revenue
  FROM jobs
  WHERE assigned_to = p_member_id
    AND status = 'completed'
    AND completed_at >= NOW() - (p_period_days || ' days')::INTERVAL
    AND deleted = FALSE;

  -- Get average job duration
  SELECT COALESCE(AVG(actual_duration_minutes), 0)
  INTO v_avg_duration
  FROM jobs
  WHERE assigned_to = p_member_id
    AND status = 'completed'
    AND completed_at >= NOW() - (p_period_days || ' days')::INTERVAL
    AND deleted = FALSE
    AND actual_duration_minutes IS NOT NULL;

  -- Get on-time completion percentage
  SELECT COALESCE(
    (COUNT(*) FILTER (WHERE completed_at <= scheduled_end)::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
    0
  )
  INTO v_on_time_pct
  FROM jobs
  WHERE assigned_to = p_member_id
    AND status = 'completed'
    AND completed_at >= NOW() - (p_period_days || ' days')::INTERVAL
    AND deleted = FALSE
    AND scheduled_end IS NOT NULL;

  -- Get average customer rating
  SELECT COALESCE(AVG(customer_rating), 0)
  INTO v_avg_rating
  FROM jobs
  WHERE assigned_to = p_member_id
    AND status = 'completed'
    AND completed_at >= NOW() - (p_period_days || ' days')::INTERVAL
    AND deleted = FALSE
    AND customer_rating IS NOT NULL;

  -- Calculate efficiency score (weighted average)
  -- Revenue weight: 30%, On-time: 25%, Rating: 25%, Jobs completed: 20%
  v_score := (
    (v_revenue::NUMERIC / 100000 * 30) +  -- Normalized revenue
    (v_on_time_pct * 0.25) +
    (v_avg_rating * 5) +  -- Rating out of 5, scaled to 25
    (v_jobs_completed * 2)  -- 2 points per job
  );

  RETURN QUERY SELECT
    v_jobs_completed,
    v_revenue,
    v_avg_duration,
    v_on_time_pct,
    v_avg_rating,
    ROUND(v_score, 2);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- LEAD SCORING
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_lead_score(p_lead_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_lead leads%ROWTYPE;
  v_score INTEGER := 0;
  v_customer customers%ROWTYPE;
BEGIN
  SELECT * INTO v_lead FROM leads WHERE id = p_lead_id;
  
  IF v_lead IS NULL THEN
    RETURN 0;
  END IF;

  -- Base score from estimated value
  v_score := v_score + LEAST((v_lead.estimated_value_cents / 10000)::INTEGER, 30);

  -- Engagement score
  IF v_lead.last_contact_at IS NOT NULL THEN
    -- Recent contact = higher score
    IF v_lead.last_contact_at >= NOW() - INTERVAL '7 days' THEN
      v_score := v_score + 20;
    ELSIF v_lead.last_contact_at >= NOW() - INTERVAL '30 days' THEN
      v_score := v_score + 10;
    END IF;
  END IF;

  -- Source quality
  CASE v_lead.source
    WHEN 'referral' THEN v_score := v_score + 20;
    WHEN 'website' THEN v_score := v_score + 15;
    WHEN 'google' THEN v_score := v_score + 12;
    WHEN 'phone' THEN v_score := v_score + 10;
    ELSE v_score := v_score + 5;
  END CASE;

  -- Existing customer bonus
  IF v_lead.customer_id IS NOT NULL THEN
    SELECT * INTO v_customer FROM customers WHERE id = v_lead.customer_id;
    IF v_customer IS NOT NULL AND v_customer.lifetime_value_cents > 0 THEN
      v_score := v_score + 15;
    END IF;
  END IF;

  -- Urgency bonus (close date soon)
  IF v_lead.expected_close_date IS NOT NULL THEN
    IF v_lead.expected_close_date <= CURRENT_DATE + 7 THEN
      v_score := v_score + 15;
    ELSIF v_lead.expected_close_date <= CURRENT_DATE + 30 THEN
      v_score := v_score + 8;
    END IF;
  END IF;

  RETURN LEAST(v_score, 100);
END;
$$ LANGUAGE plpgsql STABLE;

-- Trigger to auto-update lead score
CREATE OR REPLACE FUNCTION update_lead_score()
RETURNS TRIGGER AS $$
BEGIN
  NEW.score := calculate_lead_score(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_lead_score ON leads;
CREATE TRIGGER trigger_update_lead_score
  BEFORE INSERT OR UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_score();

-- ============================================================================
-- DOUBLE BOOKING PREVENTION
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_double_booking()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check if job has an assigned technician and scheduled times
  IF NEW.assigned_to IS NOT NULL 
     AND NEW.scheduled_start IS NOT NULL 
     AND NEW.scheduled_end IS NOT NULL
     AND NEW.status NOT IN ('canceled', 'completed') THEN
    
    IF EXISTS (
      SELECT 1 FROM jobs
      WHERE assigned_to = NEW.assigned_to
        AND id != NEW.id
        AND status NOT IN ('canceled', 'completed')
        AND deleted = FALSE
        AND (
          (scheduled_start, scheduled_end) OVERLAPS 
          (NEW.scheduled_start, NEW.scheduled_end)
        )
    ) THEN
      RAISE EXCEPTION 'Technician is already scheduled during this time slot';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_double_booking ON jobs;
CREATE TRIGGER trigger_prevent_double_booking
  BEFORE INSERT OR UPDATE OF assigned_to, scheduled_start, scheduled_end, status ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_double_booking();

-- ============================================================================
-- INVENTORY AUTO-REDUCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION reduce_inventory_on_job_complete()
RETURNS TRIGGER AS $$
BEGIN
  -- Only reduce when job transitions to completed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE inventory_items ii
    SET 
      quantity_on_hand = quantity_on_hand - jp.quantity,
      updated_at = NOW()
    FROM job_parts jp
    WHERE jp.job_id = NEW.id
      AND jp.inventory_item_id = ii.id
      AND jp.deleted = FALSE;

    -- Log the transactions
    INSERT INTO inventory_transactions (
      owner_id,
      inventory_item_id,
      transaction_type,
      quantity,
      unit_cost_cents,
      reference_type,
      reference_id,
      notes,
      created_at
    )
    SELECT
      jp.owner_id,
      jp.inventory_item_id,
      'job_use',
      -jp.quantity,
      jp.cost_cents,
      'job',
      NEW.id,
      'Auto-deducted on job completion',
      NOW()
    FROM job_parts jp
    WHERE jp.job_id = NEW.id
      AND jp.inventory_item_id IS NOT NULL
      AND jp.deleted = FALSE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reduce_inventory ON jobs;
CREATE TRIGGER trigger_reduce_inventory
  AFTER UPDATE OF status ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION reduce_inventory_on_job_complete();

-- ============================================================================
-- INVOICE TOTAL CALCULATION
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_job_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Update estimate total
  UPDATE jobs 
  SET total_estimate_cents = COALESCE((
    SELECT SUM(total_cents) 
    FROM line_items
    WHERE job_id = COALESCE(NEW.job_id, OLD.job_id)
      AND kind = 'estimate'
      AND deleted = FALSE
  ), 0)
  WHERE id = COALESCE(NEW.job_id, OLD.job_id);

  -- Update invoice total
  UPDATE jobs 
  SET total_invoice_cents = COALESCE((
    SELECT SUM(total_cents) 
    FROM line_items
    WHERE job_id = COALESCE(NEW.job_id, OLD.job_id)
      AND kind = 'invoice'
      AND deleted = FALSE
  ), 0)
  WHERE id = COALESCE(NEW.job_id, OLD.job_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_recalculate_job_totals ON line_items;
CREATE TRIGGER trigger_recalculate_job_totals
  AFTER INSERT OR UPDATE OR DELETE ON line_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_job_totals();

-- ============================================================================
-- GENERATE NEXT RECURRING JOB
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_recurring_job(p_contract_id UUID)
RETURNS UUID AS $$
DECLARE
  v_contract maintenance_contracts%ROWTYPE;
  v_new_job_id UUID;
  v_next_date DATE;
BEGIN
  SELECT * INTO v_contract 
  FROM maintenance_contracts 
  WHERE id = p_contract_id AND deleted = FALSE;

  IF v_contract IS NULL OR NOT v_contract.is_active THEN
    RETURN NULL;
  END IF;

  -- Use next_service_date or calculate from start_date
  v_next_date := COALESCE(v_contract.next_service_date, v_contract.start_date);

  -- Don't generate if past end date
  IF v_contract.end_date IS NOT NULL AND v_next_date > v_contract.end_date THEN
    RETURN NULL;
  END IF;

  -- Create the job
  INSERT INTO jobs (
    owner_id,
    customer_id,
    location_id,
    title,
    service_type,
    scheduled_start,
    scheduled_end,
    contract_id,
    is_recurring,
    status,
    internal_notes,
    created_at,
    updated_at
  ) VALUES (
    v_contract.owner_id,
    v_contract.customer_id,
    v_contract.location_id,
    v_contract.name,
    v_contract.service_type,
    v_next_date + COALESCE(v_contract.preferred_time_start, '09:00'::TIME),
    v_next_date + COALESCE(v_contract.preferred_time_end, '10:00'::TIME),
    v_contract.id,
    TRUE,
    'scheduled',
    'Auto-generated from maintenance contract',
    NOW(),
    NOW()
  ) RETURNING id INTO v_new_job_id;

  -- Calculate next service date
  UPDATE maintenance_contracts SET
    last_service_date = v_next_date,
    next_service_date = CASE frequency
      WHEN 'daily' THEN v_next_date + 1
      WHEN 'weekly' THEN v_next_date + 7
      WHEN 'biweekly' THEN v_next_date + 14
      WHEN 'monthly' THEN v_next_date + INTERVAL '1 month'
      WHEN 'quarterly' THEN v_next_date + INTERVAL '3 months'
      WHEN 'biannual' THEN v_next_date + INTERVAL '6 months'
      WHEN 'annual' THEN v_next_date + INTERVAL '1 year'
    END,
    total_services_completed = total_services_completed + 1,
    updated_at = NOW()
  WHERE id = p_contract_id;

  RETURN v_new_job_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DAILY METRICS AGGREGATION
-- ============================================================================

CREATE OR REPLACE FUNCTION aggregate_daily_metrics(
  p_owner_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS VOID AS $$
DECLARE
  v_metrics RECORD;
BEGIN
  -- Calculate all metrics for the day
  SELECT
    -- Revenue
    COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status = 'succeeded'), 0) AS revenue,
    COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status = 'succeeded'), 0) AS collected,
    COALESCE(SUM(j.total_invoice_cents - j.paid_cents) FILTER (WHERE j.total_invoice_cents > j.paid_cents), 0) AS outstanding,
    -- Jobs
    COUNT(DISTINCT j.id) FILTER (WHERE j.created_at::DATE = p_date) AS jobs_created,
    COUNT(DISTINCT j.id) FILTER (WHERE j.completed_at::DATE = p_date) AS jobs_completed,
    COUNT(DISTINCT j.id) FILTER (WHERE j.status = 'canceled' AND j.updated_at::DATE = p_date) AS jobs_canceled,
    -- Customers
    COUNT(DISTINCT c.id) FILTER (WHERE c.created_at::DATE = p_date) AS new_customers,
    -- Time
    COALESCE(SUM(te.total_minutes), 0) AS labor_minutes,
    -- Calls
    COUNT(DISTINCT cl.id) FILTER (WHERE cl.direction = 'inbound') AS calls_in,
    COUNT(DISTINCT cl.id) FILTER (WHERE cl.direction = 'outbound') AS calls_out,
    -- Messages  
    COUNT(DISTINCT ml.id) FILTER (WHERE ml.direction = 'outbound') AS msgs_sent,
    COUNT(DISTINCT ml.id) FILTER (WHERE ml.direction = 'inbound') AS msgs_received,
    -- Reviews
    COUNT(DISTINCT r.id) AS reviews_count,
    COALESCE(AVG(r.rating), 0) AS avg_rating,
    -- Costs
    COALESCE(SUM(jp.total_cost_cents), 0) AS parts_cost
  INTO v_metrics
  FROM jobs j
  LEFT JOIN payments p ON p.job_id = j.id AND p.created_at::DATE = p_date AND p.deleted = FALSE
  LEFT JOIN customers c ON c.owner_id = p_owner_id AND c.created_at::DATE = p_date AND c.deleted = FALSE
  LEFT JOIN time_entries te ON te.owner_id = p_owner_id AND te.clock_in::DATE = p_date AND te.deleted = FALSE
  LEFT JOIN call_logs cl ON cl.owner_id = p_owner_id AND cl.created_at::DATE = p_date AND cl.deleted = FALSE
  LEFT JOIN message_logs ml ON ml.owner_id = p_owner_id AND ml.created_at::DATE = p_date AND ml.deleted = FALSE
  LEFT JOIN reviews r ON r.owner_id = p_owner_id AND r.review_date::DATE = p_date AND r.deleted = FALSE
  LEFT JOIN job_parts jp ON jp.job_id = j.id AND jp.created_at::DATE = p_date AND jp.deleted = FALSE
  WHERE j.owner_id = p_owner_id AND j.deleted = FALSE;

  -- Upsert the daily metrics
  INSERT INTO daily_metrics (
    owner_id,
    date,
    total_revenue_cents,
    total_collected_cents,
    total_outstanding_cents,
    jobs_created,
    jobs_completed,
    jobs_canceled,
    new_customers,
    total_labor_minutes,
    calls_inbound,
    calls_outbound,
    messages_sent,
    messages_received,
    reviews_received,
    average_rating,
    total_parts_cost_cents,
    created_at,
    updated_at
  ) VALUES (
    p_owner_id,
    p_date,
    v_metrics.revenue,
    v_metrics.collected,
    v_metrics.outstanding,
    v_metrics.jobs_created,
    v_metrics.jobs_completed,
    v_metrics.jobs_canceled,
    v_metrics.new_customers,
    v_metrics.labor_minutes,
    v_metrics.calls_in,
    v_metrics.calls_out,
    v_metrics.msgs_sent,
    v_metrics.msgs_received,
    v_metrics.reviews_count,
    v_metrics.avg_rating,
    v_metrics.parts_cost,
    NOW(),
    NOW()
  )
  ON CONFLICT (owner_id, date) DO UPDATE SET
    total_revenue_cents = EXCLUDED.total_revenue_cents,
    total_collected_cents = EXCLUDED.total_collected_cents,
    total_outstanding_cents = EXCLUDED.total_outstanding_cents,
    jobs_created = EXCLUDED.jobs_created,
    jobs_completed = EXCLUDED.jobs_completed,
    jobs_canceled = EXCLUDED.jobs_canceled,
    new_customers = EXCLUDED.new_customers,
    total_labor_minutes = EXCLUDED.total_labor_minutes,
    calls_inbound = EXCLUDED.calls_inbound,
    calls_outbound = EXCLUDED.calls_outbound,
    messages_sent = EXCLUDED.messages_sent,
    messages_received = EXCLUDED.messages_received,
    reviews_received = EXCLUDED.reviews_received,
    average_rating = EXCLUDED.average_rating,
    total_parts_cost_cents = EXCLUDED.total_parts_cost_cents,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- NPS CALCULATION
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_nps(p_owner_id UUID, p_days INTEGER DEFAULT 90)
RETURNS TABLE (
  promoters INTEGER,
  passives INTEGER,
  detractors INTEGER,
  total_responses INTEGER,
  nps_score INTEGER
) AS $$
DECLARE
  v_promoters INTEGER;
  v_passives INTEGER;
  v_detractors INTEGER;
  v_total INTEGER;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE nps_score >= 9),
    COUNT(*) FILTER (WHERE nps_score >= 7 AND nps_score < 9),
    COUNT(*) FILTER (WHERE nps_score < 7),
    COUNT(*)
  INTO v_promoters, v_passives, v_detractors, v_total
  FROM surveys
  WHERE owner_id = p_owner_id
    AND deleted = FALSE
    AND status = 'completed'
    AND nps_score IS NOT NULL
    AND completed_at >= NOW() - (p_days || ' days')::INTERVAL;

  RETURN QUERY SELECT
    v_promoters,
    v_passives,
    v_detractors,
    v_total,
    CASE WHEN v_total > 0 
      THEN ((v_promoters - v_detractors)::NUMERIC / v_total * 100)::INTEGER
      ELSE 0
    END;
END;
$$ LANGUAGE plpgsql STABLE;
