-- Full Schema Expansion Part 2: RLS Policies & Triggers
-- Applied: 2026-03-10

-- ============================================================
-- 1. Trigger functions
-- ============================================================

-- Auto-update inventory stock on transaction insert
CREATE OR REPLACE FUNCTION update_inventory_stock()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE inventory_items
    SET qty_on_hand = qty_on_hand + NEW.qty_change
    WHERE id = NEW.item_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inventory_stock
    AFTER INSERT ON inventory_transactions
    FOR EACH ROW EXECUTE FUNCTION update_inventory_stock();

-- Auto-update estimate totals when items change
CREATE OR REPLACE FUNCTION update_estimate_totals()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE estimates
    SET total_cents = COALESCE((
        SELECT SUM(total_cents) FROM estimate_items
        WHERE estimate_id = COALESCE(NEW.estimate_id, OLD.estimate_id)
        AND deleted = FALSE
    ), 0)
    WHERE id = COALESCE(NEW.estimate_id, OLD.estimate_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_estimate_totals
    AFTER INSERT OR UPDATE OR DELETE ON estimate_items
    FOR EACH ROW EXECUTE FUNCTION update_estimate_totals();

-- Auto-create default pipeline stages on new profile
CREATE OR REPLACE FUNCTION create_default_pipeline_stages()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO pipeline_stages (owner_id, name, color, sort_order, is_won, is_lost) VALUES
        (NEW.id, 'New Lead', '#3B82F6', 0, FALSE, FALSE),
        (NEW.id, 'Contacted', '#F59E0B', 1, FALSE, FALSE),
        (NEW.id, 'Quoted', '#8B5CF6', 2, FALSE, FALSE),
        (NEW.id, 'Negotiation', '#EC4899', 3, FALSE, FALSE),
        (NEW.id, 'Won', '#10B981', 4, TRUE, FALSE),
        (NEW.id, 'Lost', '#EF4444', 5, FALSE, TRUE);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_profile_created_pipeline
    AFTER INSERT ON profiles
    FOR EACH ROW EXECUTE FUNCTION create_default_pipeline_stages();

-- ============================================================
-- 2. Enable RLS on all new tables
-- ============================================================
ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. RLS Policies (owner_id = auth.uid() pattern)
-- ============================================================

-- technicians
CREATE POLICY "technicians_select" ON technicians FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "technicians_insert" ON technicians FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "technicians_update" ON technicians FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "technicians_delete" ON technicians FOR DELETE USING (owner_id = auth.uid());

-- recurring_jobs
CREATE POLICY "recurring_jobs_select" ON recurring_jobs FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "recurring_jobs_insert" ON recurring_jobs FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "recurring_jobs_update" ON recurring_jobs FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "recurring_jobs_delete" ON recurring_jobs FOR DELETE USING (owner_id = auth.uid());

-- estimates
CREATE POLICY "estimates_select" ON estimates FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "estimates_insert" ON estimates FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "estimates_update" ON estimates FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "estimates_delete" ON estimates FOR DELETE USING (owner_id = auth.uid());

-- estimate_items
CREATE POLICY "estimate_items_select" ON estimate_items FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "estimate_items_insert" ON estimate_items FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "estimate_items_update" ON estimate_items FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "estimate_items_delete" ON estimate_items FOR DELETE USING (owner_id = auth.uid());

-- reviews
CREATE POLICY "reviews_select" ON reviews FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "reviews_insert" ON reviews FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "reviews_update" ON reviews FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "reviews_delete" ON reviews FOR DELETE USING (owner_id = auth.uid());

-- campaigns
CREATE POLICY "campaigns_select" ON campaigns FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "campaigns_insert" ON campaigns FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "campaigns_update" ON campaigns FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "campaigns_delete" ON campaigns FOR DELETE USING (owner_id = auth.uid());

-- campaign_recipients
CREATE POLICY "campaign_recipients_select" ON campaign_recipients FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "campaign_recipients_insert" ON campaign_recipients FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "campaign_recipients_update" ON campaign_recipients FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "campaign_recipients_delete" ON campaign_recipients FOR DELETE USING (owner_id = auth.uid());

-- leads
CREATE POLICY "leads_select" ON leads FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "leads_insert" ON leads FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "leads_update" ON leads FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "leads_delete" ON leads FOR DELETE USING (owner_id = auth.uid());

-- time_entries
CREATE POLICY "time_entries_select" ON time_entries FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "time_entries_insert" ON time_entries FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "time_entries_update" ON time_entries FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "time_entries_delete" ON time_entries FOR DELETE USING (owner_id = auth.uid());

-- tags
CREATE POLICY "tags_select" ON tags FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "tags_insert" ON tags FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "tags_update" ON tags FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "tags_delete" ON tags FOR DELETE USING (owner_id = auth.uid());

-- notifications
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "notifications_insert" ON notifications FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "notifications_delete" ON notifications FOR DELETE USING (owner_id = auth.uid());

-- service_agreements
CREATE POLICY "service_agreements_select" ON service_agreements FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "service_agreements_insert" ON service_agreements FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "service_agreements_update" ON service_agreements FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "service_agreements_delete" ON service_agreements FOR DELETE USING (owner_id = auth.uid());

-- inventory_transactions
CREATE POLICY "inventory_transactions_select" ON inventory_transactions FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "inventory_transactions_insert" ON inventory_transactions FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "inventory_transactions_update" ON inventory_transactions FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "inventory_transactions_delete" ON inventory_transactions FOR DELETE USING (owner_id = auth.uid());
