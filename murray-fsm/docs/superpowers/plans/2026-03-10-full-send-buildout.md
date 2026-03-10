# Murray's FSM Full-Send Build-Out Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Murray's FSM from a solid MVP into a full ServiceTitan/Jobber/HubSpot competitor with 15 new database tables, 12 services, wired-up UI pages, automation, and test coverage.

**Architecture:** Schema-first approach. All new tables in Supabase with RLS policies. Business logic in `packages/services/src/`. Server components fetch data directly. Existing patterns preserved (dark sidebar, status configs, date-fns, barrel exports).

**Tech Stack:** Next.js 14, TypeScript, Supabase (PostgreSQL + RLS + Realtime), Expo/React Native, Vitest, date-fns, Tailwind CSS, n8n, Stripe.

**Base Path:** `D:\murrayfsm\murray-fsm-repo\murray-fsm`

---

## Chunk 1: Database Schema Expansion (Migration)

### Task 1: Create schema migration SQL

**Files:**
- Create: `supabase/migrations/20260310000001_schema_expansion.sql`

- [ ] **Step 1: Write the new enums**

```sql
-- New enum types
CREATE TYPE technician_role AS ENUM ('technician', 'dispatcher', 'admin');
CREATE TYPE inventory_tx_type AS ENUM ('purchase', 'use', 'adjustment', 'return');
CREATE TYPE review_platform AS ENUM ('google', 'yelp', 'facebook', 'direct', 'other');
CREATE TYPE campaign_type AS ENUM ('email', 'sms', 'both');
CREATE TYPE campaign_status AS ENUM ('draft', 'scheduled', 'active', 'paused', 'completed');
CREATE TYPE campaign_recipient_status AS ENUM ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed');
CREATE TYPE campaign_channel AS ENUM ('email', 'sms');
CREATE TYPE time_entry_type AS ENUM ('travel', 'work', 'break');
CREATE TYPE estimate_status AS ENUM ('draft', 'sent', 'viewed', 'approved', 'rejected', 'expired');
CREATE TYPE agreement_type AS ENUM ('maintenance', 'warranty', 'membership');
CREATE TYPE agreement_status AS ENUM ('active', 'expired', 'canceled');
CREATE TYPE billing_cycle AS ENUM ('monthly', 'quarterly', 'annual');
CREATE TYPE job_priority AS ENUM ('low', 'normal', 'high', 'emergency');
```

- [ ] **Step 2: Write technicians table**

```sql
CREATE TABLE technicians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role technician_role DEFAULT 'technician',
    skills TEXT[] DEFAULT '{}',
    hourly_rate_cents INTEGER DEFAULT 0,
    color TEXT DEFAULT '#3B82F6',
    is_active BOOLEAN DEFAULT TRUE,
    availability JSONB DEFAULT '{"mon":{"start":"08:00","end":"17:00"},"tue":{"start":"08:00","end":"17:00"},"wed":{"start":"08:00","end":"17:00"},"thu":{"start":"08:00","end":"17:00"},"fri":{"start":"08:00","end":"17:00"},"sat":null,"sun":null}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_technicians_owner_updated ON technicians(owner_id, updated_at);
CREATE INDEX idx_technicians_active ON technicians(owner_id, is_active) WHERE deleted = FALSE;
CREATE TRIGGER update_technicians_updated_at BEFORE UPDATE ON technicians FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

- [ ] **Step 3: Write inventory tables**

```sql
CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    name TEXT NOT NULL,
    sku TEXT,
    description TEXT,
    category TEXT,
    unit_of_measure TEXT DEFAULT 'each',
    cost_cents INTEGER DEFAULT 0,
    price_cents INTEGER DEFAULT 0,
    qty_on_hand NUMERIC(10,2) DEFAULT 0,
    qty_reserved NUMERIC(10,2) DEFAULT 0,
    reorder_point NUMERIC(10,2) DEFAULT 0,
    reorder_qty NUMERIC(10,2) DEFAULT 0,
    vendor TEXT,
    vendor_part_number TEXT,
    location_in_shop TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
CREATE UNIQUE INDEX idx_inventory_items_sku ON inventory_items(owner_id, sku) WHERE sku IS NOT NULL AND deleted = FALSE;
CREATE INDEX idx_inventory_items_owner_updated ON inventory_items(owner_id, updated_at);
CREATE INDEX idx_inventory_items_category ON inventory_items(owner_id, category) WHERE deleted = FALSE;
CREATE INDEX idx_inventory_items_low_stock ON inventory_items(owner_id) WHERE qty_on_hand <= reorder_point AND deleted = FALSE;
CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    transaction_type inventory_tx_type NOT NULL,
    qty_change NUMERIC(10,2) NOT NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_inventory_tx_owner ON inventory_transactions(owner_id);
CREATE INDEX idx_inventory_tx_item ON inventory_transactions(item_id);
CREATE INDEX idx_inventory_tx_job ON inventory_transactions(job_id);
```

- [ ] **Step 4: Write inventory stock trigger**

```sql
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
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_stock();
```

- [ ] **Step 5: Write recurring_jobs table**

```sql
CREATE TABLE recurring_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    service_type TEXT,
    description TEXT,
    rrule TEXT NOT NULL,
    duration_minutes INTEGER DEFAULT 120,
    assigned_technician_id UUID REFERENCES technicians(id) ON DELETE SET NULL,
    line_items_template JSONB DEFAULT '[]'::jsonb,
    next_occurrence_at TIMESTAMPTZ,
    last_generated_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_recurring_jobs_owner_updated ON recurring_jobs(owner_id, updated_at);
CREATE INDEX idx_recurring_jobs_next ON recurring_jobs(owner_id, next_occurrence_at) WHERE is_active = TRUE AND deleted = FALSE;
CREATE TRIGGER update_recurring_jobs_updated_at BEFORE UPDATE ON recurring_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

- [ ] **Step 6: Write reviews table**

```sql
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    platform review_platform DEFAULT 'direct',
    reviewer_name TEXT,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    response_text TEXT,
    responded_at TIMESTAMPTZ,
    external_review_id TEXT,
    review_url TEXT,
    reviewed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_reviews_owner_updated ON reviews(owner_id, updated_at);
CREATE INDEX idx_reviews_customer ON reviews(customer_id);
CREATE INDEX idx_reviews_job ON reviews(job_id);
CREATE INDEX idx_reviews_rating ON reviews(owner_id, rating) WHERE deleted = FALSE;
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

- [ ] **Step 7: Write campaign tables**

```sql
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    type campaign_type DEFAULT 'email',
    status campaign_status DEFAULT 'draft',
    template_subject TEXT,
    template_body TEXT,
    target_filter JSONB DEFAULT '{}'::jsonb,
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    stats JSONB DEFAULT '{"sent":0,"delivered":0,"opened":0,"clicked":0,"converted":0}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_campaigns_owner_updated ON campaigns(owner_id, updated_at);
CREATE INDEX idx_campaigns_status ON campaigns(owner_id, status) WHERE deleted = FALSE;
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE campaign_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    channel campaign_channel NOT NULL,
    destination TEXT NOT NULL,
    status campaign_recipient_status DEFAULT 'pending',
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_campaign_recipients_campaign ON campaign_recipients(campaign_id);
CREATE INDEX idx_campaign_recipients_customer ON campaign_recipients(customer_id);
CREATE INDEX idx_campaign_recipients_status ON campaign_recipients(campaign_id, status);
```

- [ ] **Step 8: Write pipeline tables**

```sql
CREATE TABLE pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6B7280',
    sort_order INTEGER DEFAULT 0,
    is_won BOOLEAN DEFAULT FALSE,
    is_lost BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_pipeline_stages_owner ON pipeline_stages(owner_id, sort_order) WHERE deleted = FALSE;
CREATE TRIGGER update_pipeline_stages_updated_at BEFORE UPDATE ON pipeline_stages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    description TEXT,
    source TEXT,
    estimated_value_cents INTEGER DEFAULT 0,
    probability INTEGER DEFAULT 50 CHECK (probability >= 0 AND probability <= 100),
    assigned_technician_id UUID REFERENCES technicians(id) ON DELETE SET NULL,
    expected_close_date DATE,
    won_at TIMESTAMPTZ,
    lost_at TIMESTAMPTZ,
    lost_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_leads_owner_updated ON leads(owner_id, updated_at);
CREATE INDEX idx_leads_stage ON leads(stage_id) WHERE deleted = FALSE;
CREATE INDEX idx_leads_customer ON leads(customer_id);
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

- [ ] **Step 9: Write time_entries table**

```sql
CREATE TABLE time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    technician_id UUID NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    entry_type time_entry_type DEFAULT 'work',
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_time_entries_owner_updated ON time_entries(owner_id, updated_at);
CREATE INDEX idx_time_entries_technician ON time_entries(technician_id);
CREATE INDEX idx_time_entries_job ON time_entries(job_id);
CREATE INDEX idx_time_entries_date ON time_entries(owner_id, started_at) WHERE deleted = FALSE;
CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON time_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

- [ ] **Step 10: Write estimates tables**

```sql
CREATE TABLE estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    estimate_number TEXT,
    status estimate_status DEFAULT 'draft',
    title TEXT NOT NULL,
    notes TEXT,
    valid_until DATE,
    total_cents INTEGER DEFAULT 0,
    sent_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    converted_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_estimates_owner_updated ON estimates(owner_id, updated_at);
CREATE INDEX idx_estimates_customer ON estimates(customer_id);
CREATE INDEX idx_estimates_status ON estimates(owner_id, status) WHERE deleted = FALSE;
CREATE TRIGGER update_estimates_updated_at BEFORE UPDATE ON estimates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE estimate_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    qty NUMERIC(10,2) DEFAULT 1,
    unit_price_cents INTEGER NOT NULL,
    total_cents INTEGER GENERATED ALWAYS AS (ROUND(qty * unit_price_cents)::INTEGER) STORED,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_estimate_items_estimate ON estimate_items(estimate_id);
CREATE TRIGGER update_estimate_items_updated_at BEFORE UPDATE ON estimate_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

- [ ] **Step 11: Write estimate totals trigger**

```sql
CREATE OR REPLACE FUNCTION update_estimate_totals()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE estimates SET total_cents = COALESCE((
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
    FOR EACH ROW
    EXECUTE FUNCTION update_estimate_totals();
```

- [ ] **Step 12: Write tags and notifications tables**

```sql
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    tag TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(owner_id, entity_type, entity_id, tag)
);
CREATE INDEX idx_tags_entity ON tags(owner_id, entity_type, entity_id);
CREATE INDEX idx_tags_tag ON tags(owner_id, tag);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    type TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notifications_owner_unread ON notifications(owner_id, created_at DESC) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_owner ON notifications(owner_id, created_at DESC);
```

- [ ] **Step 13: Write service_agreements table**

```sql
CREATE TABLE service_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    type agreement_type DEFAULT 'maintenance',
    status agreement_status DEFAULT 'active',
    start_date DATE NOT NULL,
    end_date DATE,
    recurring_job_id UUID REFERENCES recurring_jobs(id) ON DELETE SET NULL,
    price_cents INTEGER DEFAULT 0,
    billing_cycle billing_cycle DEFAULT 'monthly',
    terms TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_agreements_owner_updated ON service_agreements(owner_id, updated_at);
CREATE INDEX idx_agreements_customer ON service_agreements(customer_id);
CREATE INDEX idx_agreements_status ON service_agreements(owner_id, status) WHERE deleted = FALSE;
CREATE TRIGGER update_agreements_updated_at BEFORE UPDATE ON service_agreements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

- [ ] **Step 14: Alter existing tables**

```sql
-- Add technician assignment, priority, source, recurring link to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_technician_id UUID REFERENCES technicians(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS priority job_priority DEFAULT 'normal';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recurring_job_id UUID REFERENCES recurring_jobs(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS estimate_id UUID REFERENCES estimates(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_technician ON jobs(assigned_technician_id) WHERE deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_jobs_priority ON jobs(owner_id, priority) WHERE deleted = FALSE;

-- Link line items to inventory
ALTER TABLE line_items ADD COLUMN IF NOT EXISTS inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL;
```

- [ ] **Step 15: Write RLS policies for all new tables**

```sql
-- Enable RLS on all new tables
ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_agreements ENABLE ROW LEVEL SECURITY;

-- Apply standard owner_id = auth.uid() policies to each table
-- (same pattern for all: select, insert, update, delete)
```

For each table (technicians, inventory_items, inventory_transactions, recurring_jobs, reviews, campaigns, campaign_recipients, pipeline_stages, leads, time_entries, estimates, estimate_items, tags, notifications, service_agreements), create 4 policies:

```sql
CREATE POLICY "[table]_select" ON [table] FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "[table]_insert" ON [table] FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "[table]_update" ON [table] FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "[table]_delete" ON [table] FOR DELETE USING (owner_id = auth.uid());
```

- [ ] **Step 16: Insert default pipeline stages**

```sql
-- Default pipeline stages (inserted per-user via a function or seed)
CREATE OR REPLACE FUNCTION create_default_pipeline_stages()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO pipeline_stages (owner_id, name, color, sort_order, is_won, is_lost) VALUES
        (NEW.id, 'New Lead', '#6366F1', 0, FALSE, FALSE),
        (NEW.id, 'Contacted', '#8B5CF6', 1, FALSE, FALSE),
        (NEW.id, 'Quote Sent', '#F59E0B', 2, FALSE, FALSE),
        (NEW.id, 'Negotiating', '#F97316', 3, FALSE, FALSE),
        (NEW.id, 'Won', '#10B981', 4, TRUE, FALSE),
        (NEW.id, 'Lost', '#EF4444', 5, FALSE, TRUE);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_profile_created_pipeline
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION create_default_pipeline_stages();
```

- [ ] **Step 17: Apply migration to live Supabase**

Run via Supabase MCP `apply_migration` tool against the live project.

- [ ] **Step 18: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add 15 new tables for full competitor parity (technicians, inventory, recurring jobs, reviews, campaigns, pipeline, leads, time entries, estimates, tags, notifications, service agreements)"
```

---

## Chunk 2: Shared Types & Constants

### Task 2: Add new types and constants to shared package

**Files:**
- Modify: `packages/shared/src/constants.ts`
- Create: `packages/shared/src/types.ts`

- [ ] **Step 1: Create types.ts with all new interfaces**

```typescript
// packages/shared/src/types.ts

// === Technicians ===
export type TechnicianRole = 'technician' | 'dispatcher' | 'admin';

export interface Technician {
  id: string;
  owner_id: string;
  profile_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  role: TechnicianRole;
  skills: string[];
  hourly_rate_cents: number;
  color: string;
  is_active: boolean;
  availability: Record<string, { start: string; end: string } | null>;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

// === Inventory ===
export type InventoryTxType = 'purchase' | 'use' | 'adjustment' | 'return';

export interface InventoryItem {
  id: string;
  owner_id: string;
  name: string;
  sku: string | null;
  description: string | null;
  category: string | null;
  unit_of_measure: string;
  cost_cents: number;
  price_cents: number;
  qty_on_hand: number;
  qty_reserved: number;
  reorder_point: number;
  reorder_qty: number;
  vendor: string | null;
  vendor_part_number: string | null;
  location_in_shop: string | null;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

export interface InventoryTransaction {
  id: string;
  owner_id: string;
  item_id: string;
  transaction_type: InventoryTxType;
  qty_change: number;
  job_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

// === Recurring Jobs ===
export interface RecurringJob {
  id: string;
  owner_id: string;
  customer_id: string;
  location_id: string | null;
  title: string;
  service_type: string | null;
  description: string | null;
  rrule: string;
  duration_minutes: number;
  assigned_technician_id: string | null;
  line_items_template: Array<{ name: string; qty: number; unit_price_cents: number }>;
  next_occurrence_at: string | null;
  last_generated_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

// === Reviews ===
export type ReviewPlatform = 'google' | 'yelp' | 'facebook' | 'direct' | 'other';

export interface Review {
  id: string;
  owner_id: string;
  customer_id: string | null;
  job_id: string | null;
  platform: ReviewPlatform;
  reviewer_name: string | null;
  rating: number;
  review_text: string | null;
  response_text: string | null;
  responded_at: string | null;
  external_review_id: string | null;
  review_url: string | null;
  reviewed_at: string;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

// === Campaigns ===
export type CampaignType = 'email' | 'sms' | 'both';
export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed';
export type CampaignRecipientStatus = 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';

export interface Campaign {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  type: CampaignType;
  status: CampaignStatus;
  template_subject: string | null;
  template_body: string | null;
  target_filter: Record<string, unknown>;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  stats: { sent: number; delivered: number; opened: number; clicked: number; converted: number };
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

// === Pipeline ===
export interface PipelineStage {
  id: string;
  owner_id: string;
  name: string;
  color: string;
  sort_order: number;
  is_won: boolean;
  is_lost: boolean;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

export interface Lead {
  id: string;
  owner_id: string;
  customer_id: string | null;
  stage_id: string;
  title: string;
  description: string | null;
  source: string | null;
  estimated_value_cents: number;
  probability: number;
  assigned_technician_id: string | null;
  expected_close_date: string | null;
  won_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

// === Time Entries ===
export type TimeEntryType = 'travel' | 'work' | 'break';

export interface TimeEntry {
  id: string;
  owner_id: string;
  technician_id: string;
  job_id: string | null;
  entry_type: TimeEntryType;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

// === Estimates ===
export type EstimateStatus = 'draft' | 'sent' | 'viewed' | 'approved' | 'rejected' | 'expired';

export interface Estimate {
  id: string;
  owner_id: string;
  customer_id: string;
  location_id: string | null;
  estimate_number: string | null;
  status: EstimateStatus;
  title: string;
  notes: string | null;
  valid_until: string | null;
  total_cents: number;
  sent_at: string | null;
  approved_at: string | null;
  converted_job_id: string | null;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

// === Notifications ===
export interface Notification {
  id: string;
  owner_id: string;
  title: string;
  body: string | null;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

// === Service Agreements ===
export type AgreementType = 'maintenance' | 'warranty' | 'membership';
export type AgreementStatus = 'active' | 'expired' | 'canceled';
export type BillingCycle = 'monthly' | 'quarterly' | 'annual';

export interface ServiceAgreement {
  id: string;
  owner_id: string;
  customer_id: string;
  location_id: string | null;
  name: string;
  description: string | null;
  type: AgreementType;
  status: AgreementStatus;
  start_date: string;
  end_date: string | null;
  recurring_job_id: string | null;
  price_cents: number;
  billing_cycle: BillingCycle;
  terms: string | null;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

// === Tags ===
export interface Tag {
  id: string;
  owner_id: string;
  entity_type: string;
  entity_id: string;
  tag: string;
  created_at: string;
}

// === Job Priority ===
export type JobPriority = 'low' | 'normal' | 'high' | 'emergency';
```

- [ ] **Step 2: Add new status configs to constants.ts**

Add to `packages/shared/src/constants.ts`:

```typescript
// --- Priority Config ---
export const JOB_PRIORITY_CONFIG = {
  low: { label: 'Low', color: '#6B7280', bgColor: 'bg-gray-100', textColor: 'text-gray-800' },
  normal: { label: 'Normal', color: '#3B82F6', bgColor: 'bg-blue-100', textColor: 'text-blue-800' },
  high: { label: 'High', color: '#F59E0B', bgColor: 'bg-amber-100', textColor: 'text-amber-800' },
  emergency: { label: 'Emergency', color: '#EF4444', bgColor: 'bg-red-100', textColor: 'text-red-800' },
} as const;

// --- Review Platform Config ---
export const REVIEW_PLATFORM_CONFIG = {
  google: { label: 'Google', color: '#4285F4' },
  yelp: { label: 'Yelp', color: '#D32323' },
  facebook: { label: 'Facebook', color: '#1877F2' },
  direct: { label: 'Direct', color: '#10B981' },
  other: { label: 'Other', color: '#6B7280' },
} as const;

// --- Campaign Status Config ---
export const CAMPAIGN_STATUS_CONFIG = {
  draft: { label: 'Draft', bgColor: 'bg-gray-100', textColor: 'text-gray-800' },
  scheduled: { label: 'Scheduled', bgColor: 'bg-blue-100', textColor: 'text-blue-800' },
  active: { label: 'Active', bgColor: 'bg-green-100', textColor: 'text-green-800' },
  paused: { label: 'Paused', bgColor: 'bg-amber-100', textColor: 'text-amber-800' },
  completed: { label: 'Completed', bgColor: 'bg-slate-100', textColor: 'text-slate-800' },
} as const;

// --- Estimate Status Config ---
export const ESTIMATE_STATUS_CONFIG = {
  draft: { label: 'Draft', bgColor: 'bg-gray-100', textColor: 'text-gray-800' },
  sent: { label: 'Sent', bgColor: 'bg-blue-100', textColor: 'text-blue-800' },
  viewed: { label: 'Viewed', bgColor: 'bg-indigo-100', textColor: 'text-indigo-800' },
  approved: { label: 'Approved', bgColor: 'bg-green-100', textColor: 'text-green-800' },
  rejected: { label: 'Rejected', bgColor: 'bg-red-100', textColor: 'text-red-800' },
  expired: { label: 'Expired', bgColor: 'bg-slate-100', textColor: 'text-slate-800' },
} as const;

// --- Agreement Status Config ---
export const AGREEMENT_STATUS_CONFIG = {
  active: { label: 'Active', bgColor: 'bg-green-100', textColor: 'text-green-800' },
  expired: { label: 'Expired', bgColor: 'bg-slate-100', textColor: 'text-slate-800' },
  canceled: { label: 'Canceled', bgColor: 'bg-red-100', textColor: 'text-red-800' },
} as const;

// --- Technician Skills (garage door services) ---
export const TECHNICIAN_SKILLS = [
  'installation', 'repair', 'maintenance', 'springs', 'openers',
  'panels', 'weatherstripping', 'commercial', 'residential',
  'emergency', 'electrical', 'framing',
] as const;

// --- Inventory Categories ---
export const INVENTORY_CATEGORIES = [
  'Springs', 'Panels', 'Openers', 'Hardware', 'Weatherstripping',
  'Tracks & Rollers', 'Cables & Drums', 'Keypads & Remotes',
  'Safety Equipment', 'Miscellaneous',
] as const;
```

- [ ] **Step 3: Update barrel export**

Add to `packages/shared/src/index.ts`:
```typescript
export * from './types';
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared/
git commit -m "feat: add types and constants for all new entities (technicians, inventory, reviews, campaigns, pipeline, estimates, agreements, notifications)"
```

---

## Chunk 3: Services Layer

### Task 3: Build all new service modules

**Files:**
- Create: `packages/services/src/technicians.ts`
- Create: `packages/services/src/inventory.ts`
- Create: `packages/services/src/recurring-jobs.ts`
- Create: `packages/services/src/reviews.ts`
- Create: `packages/services/src/campaigns.ts`
- Create: `packages/services/src/leads.ts`
- Create: `packages/services/src/estimates.ts`
- Create: `packages/services/src/time-entries.ts`
- Create: `packages/services/src/notifications.ts`
- Create: `packages/services/src/agreements.ts`
- Create: `packages/services/src/analytics.ts`
- Create: `packages/services/src/dispatch.ts`
- Modify: `packages/services/src/index.ts`

Each service follows the same pattern:
1. Import types from `@murray-fsm/shared`
2. Export pure functions for business logic (validation, calculation, formatting)
3. No direct Supabase calls — services are used by page components and API routes that have their own Supabase clients

Key services to build (each is its own step):

- [ ] **Step 1: technicians.ts** — `scoreTechnicianForJob()`, `findAvailableTechnicians()`, `calculateUtilization()`
- [ ] **Step 2: inventory.ts** — `calculateMargin()`, `isLowStock()`, `getLowStockItems()`, `calculateInventoryValue()`
- [ ] **Step 3: recurring-jobs.ts** — `parseRRule()`, `getNextOccurrence()`, `generateJobFromRecurring()`, `buildRRule()`
- [ ] **Step 4: reviews.ts** — `calculateAverageRating()`, `getRatingDistribution()`, `calculateResponseRate()`
- [ ] **Step 5: campaigns.ts** — `buildRecipientList()`, `calculateCampaignStats()`, `formatCampaignMetrics()`
- [ ] **Step 6: leads.ts** — `calculatePipelineValue()`, `scoreLeadPriority()`, `getPipelineStats()`
- [ ] **Step 7: estimates.ts** — `generateEstimateNumber()`, `calculateEstimateTotals()`, `isEstimateExpired()`
- [ ] **Step 8: time-entries.ts** — `calculateDuration()`, `getTechnicianHours()`, `formatTimeEntry()`
- [ ] **Step 9: notifications.ts** — `createNotification()`, `getUnreadCount()`, notification type constants
- [ ] **Step 10: agreements.ts** — `isAgreementExpiring()`, `calculateRecurringRevenue()`, `getExpiringAgreements()`
- [ ] **Step 11: analytics.ts** — `calculateRevenueTrend()`, `calculateJobProfitability()`, `calculateCustomerLTV()`, `getKPIs()`
- [ ] **Step 12: dispatch.ts** — `rankTechniciansForJob()`, `autoAssignTechnician()` combining skills + proximity + workload
- [ ] **Step 13: Update barrel export** — Add all new exports to `packages/services/src/index.ts`
- [ ] **Step 14: Commit**

```bash
git add packages/services/
git commit -m "feat: add 12 service modules (technicians, inventory, recurring-jobs, reviews, campaigns, leads, estimates, time-entries, notifications, agreements, analytics, dispatch)"
```

---

## Chunk 4: Wire Mock Pages to Real Data

### Task 4: Inventory page — replace mock data with Supabase

**Files:**
- Modify: `apps/web/src/app/(dashboard)/inventory/page.tsx`

- [ ] **Step 1: Replace mock inventory array with Supabase query**
- [ ] **Step 2: Add stats from real data (total items, value, low stock count)**
- [ ] **Step 3: Wire category filter to query params**
- [ ] **Step 4: Add create item form (client component modal)**
- [ ] **Step 5: Add stock adjustment action**
- [ ] **Step 6: Commit**

### Task 5: Team page — replace demo data with Supabase

**Files:**
- Modify: `apps/web/src/app/(dashboard)/team/page.tsx`

- [ ] **Step 1: Replace demo technicians with Supabase query on technicians table**
- [ ] **Step 2: Wire performance stats from jobs + time_entries**
- [ ] **Step 3: Add technician create/edit form**
- [ ] **Step 4: Commit**

### Task 6: Reviews page — replace sample reviews with Supabase

**Files:**
- Modify: `apps/web/src/app/(dashboard)/reviews/page.tsx`

- [ ] **Step 1: Replace sample reviews with Supabase query on reviews table**
- [ ] **Step 2: Wire rating stats from real data**
- [ ] **Step 3: Add response form that updates reviews.response_text**
- [ ] **Step 4: Add review request sending flow**
- [ ] **Step 5: Commit**

### Task 7: Marketing page — replace mock campaigns with Supabase

**Files:**
- Modify: `apps/web/src/app/(dashboard)/marketing/page.tsx`

- [ ] **Step 1: Replace mock campaigns with Supabase query**
- [ ] **Step 2: Add campaign creation form**
- [ ] **Step 3: Wire recipient tracking**
- [ ] **Step 4: Commit**

### Task 8: Pipeline page — ensure real DB integration

**Files:**
- Modify: `apps/web/src/app/(dashboard)/pipeline/page.tsx`

- [ ] **Step 1: Verify pipeline_stages and leads queries work against new schema**
- [ ] **Step 2: Add lead creation form**
- [ ] **Step 3: Add drag-and-drop stage transitions**
- [ ] **Step 4: Commit**

---

## Chunk 5: New Features — Estimates, Recurring Jobs, Notifications

### Task 9: Standalone estimates page and flow

**Files:**
- Create: `apps/web/src/app/(dashboard)/estimates/page.tsx`
- Create: `apps/web/src/app/(dashboard)/estimates/new/page.tsx`
- Create: `apps/web/src/app/(dashboard)/estimates/[id]/page.tsx`
- Modify: `apps/web/src/components/layout/Sidebar.tsx` (add Estimates nav item)

- [ ] **Step 1: Create estimates list page**
- [ ] **Step 2: Create new estimate form page**
- [ ] **Step 3: Create estimate detail page with line items**
- [ ] **Step 4: Add "Convert to Job" action**
- [ ] **Step 5: Add Estimates to sidebar under Business section**
- [ ] **Step 6: Commit**

### Task 10: Recurring jobs management

**Files:**
- Create: `apps/web/src/app/(dashboard)/recurring/page.tsx`
- Create: `apps/web/src/app/(dashboard)/recurring/new/page.tsx`
- Modify: `apps/web/src/components/layout/Sidebar.tsx` (add Recurring nav item)

- [ ] **Step 1: Create recurring jobs list page**
- [ ] **Step 2: Create new recurring job form with RRULE builder UI**
- [ ] **Step 3: Add activate/deactivate toggles**
- [ ] **Step 4: Add to sidebar under Operations**
- [ ] **Step 5: Commit**

### Task 11: Notification center

**Files:**
- Create: `apps/web/src/components/NotificationBell.tsx`
- Modify: `apps/web/src/app/(dashboard)/layout.tsx` (add bell to header)

- [ ] **Step 1: Create NotificationBell client component with dropdown**
- [ ] **Step 2: Query unread notifications count**
- [ ] **Step 3: Show recent notifications in dropdown**
- [ ] **Step 4: Mark as read on click**
- [ ] **Step 5: Add to dashboard layout header**
- [ ] **Step 6: Commit**

### Task 12: Service agreements page

**Files:**
- Create: `apps/web/src/app/(dashboard)/agreements/page.tsx`
- Modify: `apps/web/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Create agreements list page**
- [ ] **Step 2: Add create agreement form**
- [ ] **Step 3: Link to recurring jobs**
- [ ] **Step 4: Add to sidebar**
- [ ] **Step 5: Commit**

---

## Chunk 6: Enhanced Analytics

### Task 13: Upgrade analytics dashboard with real intelligence

**Files:**
- Modify: `apps/web/src/app/(dashboard)/analytics/page.tsx`

- [ ] **Step 1: Add revenue by technician breakdown**
- [ ] **Step 2: Add revenue by service type**
- [ ] **Step 3: Add customer lifetime value top 10**
- [ ] **Step 4: Add job profitability analysis (revenue - parts - labor)**
- [ ] **Step 5: Add pipeline forecast (leads * probability)**
- [ ] **Step 6: Add recurring revenue from service agreements**
- [ ] **Step 7: Commit**

---

## Chunk 7: Job Assignment & Dispatch

### Task 14: Add technician assignment to job workflow

**Files:**
- Modify: `apps/web/src/app/(dashboard)/jobs/page.tsx` (add technician column)
- Modify: job detail/edit pages (add technician selector)
- Modify: `apps/web/src/app/(dashboard)/calendar/page.tsx` (color by technician)

- [ ] **Step 1: Add assigned_technician display to jobs list**
- [ ] **Step 2: Add technician selector to job creation/edit**
- [ ] **Step 3: Add auto-suggest via dispatch service**
- [ ] **Step 4: Color calendar events by assigned technician**
- [ ] **Step 5: Commit**

---

## Chunk 8: Customer Portal Upgrade

### Task 15: Enhance customer-facing portal

**Files:**
- Modify: `apps/web/src/app/(booking)/book/[businessId]/page.tsx`
- Create: `apps/web/src/app/(portal)/portal/[token]/estimates/page.tsx`
- Create: `apps/web/src/app/(portal)/portal/[token]/status/page.tsx`

- [ ] **Step 1: Upgrade booking page with date/time picker and service type**
- [ ] **Step 2: Add estimate viewing and approval page**
- [ ] **Step 3: Add job status tracking page**
- [ ] **Step 4: Commit**

---

## Chunk 9: Mobile App Sync Updates

### Task 16: Add new entities to mobile Legend-State sync

**Files:**
- Modify: `apps/mobile/src/store/index.ts`
- Modify: `apps/mobile/src/types/index.ts`

- [ ] **Step 1: Add technician, inventory, notification types to mobile**
- [ ] **Step 2: Add sync tables for new entities**
- [ ] **Step 3: Add notification badge to mobile tab bar**
- [ ] **Step 4: Commit**

---

## Chunk 10: Testing

### Task 17: Set up Vitest and write tests

**Files:**
- Create: `packages/services/vitest.config.ts`
- Create: `packages/shared/vitest.config.ts`
- Create: `packages/services/src/__tests__/scheduling.test.ts`
- Create: `packages/services/src/__tests__/inventory.test.ts`
- Create: `packages/services/src/__tests__/recurring-jobs.test.ts`
- Create: `packages/services/src/__tests__/dispatch.test.ts`
- Create: `packages/services/src/__tests__/analytics.test.ts`
- Create: `packages/shared/src/__tests__/validation.test.ts`
- Create: `packages/shared/src/__tests__/format.test.ts`

- [ ] **Step 1: Install vitest as workspace dev dependency**
- [ ] **Step 2: Create vitest configs**
- [ ] **Step 3: Write scheduling tests (conflict detection, available slots)**
- [ ] **Step 4: Write inventory tests (margin, low stock, value calc)**
- [ ] **Step 5: Write recurring jobs tests (RRULE parsing, next occurrence)**
- [ ] **Step 6: Write dispatch tests (technician scoring, ranking)**
- [ ] **Step 7: Write analytics tests (revenue trend, LTV, profitability)**
- [ ] **Step 8: Write validation tests (phone, email, job schedule)**
- [ ] **Step 9: Write format tests (currency, phone, date)**
- [ ] **Step 10: Run all tests, verify pass**
- [ ] **Step 11: Commit**

```bash
git add packages/
git commit -m "test: add Vitest setup and tests for services and shared packages"
```

---

## Chunk 11: Update schema.sql and Documentation

### Task 18: Update master schema file and docs

**Files:**
- Modify: `supabase/schema.sql` (append new tables)
- Modify: `supabase/rls.sql` (append new policies)
- Modify: `docs/API.md` (document new endpoints)

- [ ] **Step 1: Append all new CREATE TABLE statements to schema.sql**
- [ ] **Step 2: Append all new RLS policies to rls.sql**
- [ ] **Step 3: Update API docs with new endpoints**
- [ ] **Step 4: Commit**

```bash
git add supabase/ docs/
git commit -m "docs: update schema.sql, rls.sql, and API docs with all new tables and endpoints"
```
