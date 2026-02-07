import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// This endpoint creates all required database tables using the service role key
export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      );
    }

    // Create admin client with service role key
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const results: { step: string; status: string; error?: string }[] = [];

    // Try to create tables one by one using insert with on_conflict
    // This is a workaround since we can't run raw DDL SQL

    // Test if customers table exists by trying to query it
    const { error: customersError } = await supabase
      .from('customers')
      .select('id')
      .limit(1);

    if (customersError?.code === '42P01' || customersError?.message?.includes('does not exist') || customersError?.message?.includes('schema cache')) {
      results.push({
        step: 'customers',
        status: 'NOT_FOUND',
        error: 'Table does not exist. Please run schema.sql in Supabase SQL Editor.'
      });
    } else if (customersError) {
      results.push({ step: 'customers', status: 'ERROR', error: customersError.message });
    } else {
      results.push({ step: 'customers', status: 'OK' });
    }

    // Check all required tables
    const tables = [
      'profiles', 'locations', 'jobs', 'job_events', 'job_photos',
      'job_signatures', 'line_items', 'payments', 'comm_threads',
      'call_logs', 'message_logs', 'action_queue', 'automation_events',
      'calendar_events', 'team_members', 'inventory_items',
      'marketing_campaigns', 'business_settings', 'installed_plugins',
      'webhook_endpoints', 'api_keys', 'pipeline_stages', 'leads', 'referrals', 'reviews'
    ];

    for (const table of tables) {
      const { error } = await supabase.from(table).select('id').limit(1);
      if (error?.code === '42P01' || error?.message?.includes('does not exist') || error?.message?.includes('schema cache')) {
        results.push({ step: table, status: 'NOT_FOUND', error: 'Table does not exist' });
      } else if (error) {
        results.push({ step: table, status: 'ERROR', error: error.message });
      } else {
        results.push({ step: table, status: 'OK' });
      }
    }

    const missingTables = results.filter(r => r.status === 'NOT_FOUND');
    const existingTables = results.filter(r => r.status === 'OK');

    // Generate the combined SQL to create missing tables
    const schemaSQL = generateSchemaSQL(missingTables.map(t => t.step));

    return NextResponse.json({
      success: true,
      summary: {
        total: results.length,
        existing: existingTables.length,
        missing: missingTables.length
      },
      missingTables: missingTables.map(t => t.step),
      existingTables: existingTables.map(t => t.step),
      results,
      schemaSQL: missingTables.length > 0 ? schemaSQL : null,
      message: missingTables.length > 0
        ? `${missingTables.length} tables need to be created. Copy the schemaSQL and run it in Supabase SQL Editor.`
        : 'All database tables exist!'
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

function generateSchemaSQL(missingTables: string[]): string {
  const allSQL: string[] = [];

  // Helper function
  allSQL.push(`-- Murray's FSM Database Schema
-- Run this in Supabase SQL Editor

-- Helper function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`);

  // Add each missing table's SQL
  if (missingTables.includes('customers')) {
    allSQL.push(`
-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    communication_preferences JSONB DEFAULT '{"email_marketing": true, "sms_marketing": true}'::jsonb,
    portal_enabled BOOLEAN DEFAULT TRUE,
    lifetime_value_cents INTEGER DEFAULT 0,
    total_jobs INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    source TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_customers_owner ON customers(owner_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
`);
  }

  if (missingTables.includes('profiles')) {
    allSQL.push(`
-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL DEFAULT auth.uid(),
    full_name TEXT,
    phone TEXT,
    company_name TEXT,
    timezone TEXT DEFAULT 'America/New_York',
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
`);
  }

  if (missingTables.includes('locations')) {
    allSQL.push(`
-- Locations table
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    address1 TEXT NOT NULL,
    address2 TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    access_notes TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_locations_customer ON locations(customer_id);
`);
  }

  if (missingTables.includes('jobs')) {
    allSQL.push(`
-- Job status enum
DO $$ BEGIN
    CREATE TYPE job_status AS ENUM ('scheduled', 'in_progress', 'completed', 'canceled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    service_type TEXT,
    problem_description TEXT,
    status job_status DEFAULT 'scheduled',
    scheduled_start TIMESTAMPTZ,
    scheduled_end TIMESTAMPTZ,
    arrived_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    internal_notes TEXT,
    customer_notes TEXT,
    total_estimate_cents INTEGER DEFAULT 0,
    total_invoice_cents INTEGER DEFAULT 0,
    paid_cents INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_jobs_owner ON jobs(owner_id);
CREATE INDEX IF NOT EXISTS idx_jobs_customer ON jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
`);
  }

  if (missingTables.includes('job_events')) {
    allSQL.push(`
-- Job events table
CREATE TABLE IF NOT EXISTS job_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
`);
  }

  if (missingTables.includes('job_photos')) {
    allSQL.push(`
-- Photo kind enum
DO $$ BEGIN
    CREATE TYPE photo_kind AS ENUM ('before', 'after', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Job photos table
CREATE TABLE IF NOT EXISTS job_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    kind photo_kind DEFAULT 'other',
    storage_bucket TEXT DEFAULT 'job-photos',
    storage_path TEXT NOT NULL,
    mime_type TEXT,
    caption TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
`);
  }

  if (missingTables.includes('job_signatures')) {
    allSQL.push(`
-- Job signatures table
CREATE TABLE IF NOT EXISTS job_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    signer_name TEXT NOT NULL,
    signed_at TIMESTAMPTZ DEFAULT NOW(),
    storage_bucket TEXT DEFAULT 'job-signatures',
    storage_path TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
`);
  }

  if (missingTables.includes('line_items')) {
    allSQL.push(`
-- Line item kind enum
DO $$ BEGIN
    CREATE TYPE line_item_kind AS ENUM ('estimate', 'invoice');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Line items table
CREATE TABLE IF NOT EXISTS line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    kind line_item_kind NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    qty NUMERIC(10, 2) DEFAULT 1,
    unit_price_cents INTEGER NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
`);
  }

  if (missingTables.includes('payments')) {
    allSQL.push(`
-- Payment status enum
DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'canceled', 'refunded');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE RESTRICT,
    provider TEXT DEFAULT 'stripe',
    stripe_payment_intent_id TEXT,
    amount_cents INTEGER NOT NULL,
    status payment_status DEFAULT 'pending',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
`);
  }

  if (missingTables.includes('comm_threads')) {
    allSQL.push(`
-- Comm threads table
CREATE TABLE IF NOT EXISTS comm_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    external_provider TEXT DEFAULT 'quo',
    external_phone_number_id TEXT,
    contact_phone TEXT NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
`);
  }

  if (missingTables.includes('call_logs')) {
    allSQL.push(`
-- Call direction enum
DO $$ BEGIN
    CREATE TYPE call_direction AS ENUM ('inbound', 'outbound');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Call logs table
CREATE TABLE IF NOT EXISTS call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    external_call_id TEXT UNIQUE NOT NULL,
    thread_id UUID REFERENCES comm_threads(id) ON DELETE SET NULL,
    direction call_direction NOT NULL,
    from_phone TEXT NOT NULL,
    to_phone TEXT NOT NULL,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    recording_url TEXT,
    transcript TEXT,
    summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
`);
  }

  if (missingTables.includes('message_logs')) {
    allSQL.push(`
-- Message direction enum
DO $$ BEGIN
    CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Message logs table
CREATE TABLE IF NOT EXISTS message_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    external_message_id TEXT UNIQUE NOT NULL,
    thread_id UUID REFERENCES comm_threads(id) ON DELETE SET NULL,
    direction message_direction NOT NULL,
    from_phone TEXT NOT NULL,
    to_phone TEXT NOT NULL,
    body TEXT,
    media JSONB DEFAULT '[]'::jsonb,
    status TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
`);
  }

  if (missingTables.includes('action_queue')) {
    allSQL.push(`
-- Action status enum
DO $$ BEGIN
    CREATE TYPE action_status AS ENUM ('pending', 'approved', 'rejected', 'executed', 'failed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Action queue table
CREATE TABLE IF NOT EXISTS action_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    source_type TEXT NOT NULL,
    source_id TEXT,
    kind TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status action_status DEFAULT 'pending',
    requires_approval BOOLEAN DEFAULT TRUE,
    approved_at TIMESTAMPTZ,
    approved_by UUID,
    executed_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
`);
  }

  if (missingTables.includes('automation_events')) {
    allSQL.push(`
-- Automation events table
CREATE TABLE IF NOT EXISTS automation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    source TEXT NOT NULL,
    event_type TEXT NOT NULL,
    idempotency_key TEXT UNIQUE NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
`);
  }

  if (missingTables.includes('calendar_events')) {
    allSQL.push(`
-- Calendar provider enum
DO $$ BEGIN
    CREATE TYPE calendar_provider AS ENUM ('google', 'outlook', 'icloud');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Calendar events table
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    provider calendar_provider NOT NULL,
    external_event_id TEXT,
    calendar_id TEXT,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    UNIQUE(job_id, provider)
);
`);
  }

  if (missingTables.includes('team_members')) {
    allSQL.push(`
-- Team role enum
DO $$ BEGIN
    CREATE TYPE team_role AS ENUM ('owner', 'admin', 'dispatcher', 'technician', 'office');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Team members table
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role team_role DEFAULT 'technician',
    hourly_rate_cents INTEGER DEFAULT 0,
    color TEXT DEFAULT '#3b82f6',
    skills TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
`);
  }

  if (missingTables.includes('inventory_items')) {
    allSQL.push(`
-- Inventory items table
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    sku TEXT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    unit TEXT DEFAULT 'each',
    cost_cents INTEGER DEFAULT 0,
    price_cents INTEGER DEFAULT 0,
    quantity_on_hand NUMERIC(10,2) DEFAULT 0,
    reorder_point NUMERIC(10,2) DEFAULT 5,
    reorder_quantity NUMERIC(10,2) DEFAULT 10,
    supplier TEXT,
    location TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
`);
  }

  if (missingTables.includes('marketing_campaigns')) {
    allSQL.push(`
-- Campaign type enum
DO $$ BEGIN
    CREATE TYPE campaign_type AS ENUM ('email', 'sms', 'both');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Campaign status enum
DO $$ BEGIN
    CREATE TYPE campaign_status AS ENUM ('draft', 'scheduled', 'active', 'paused', 'completed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Marketing campaigns table
CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    campaign_type campaign_type DEFAULT 'email',
    status campaign_status DEFAULT 'draft',
    subject TEXT,
    message TEXT,
    scheduled_at TIMESTAMPTZ,
    total_recipients INTEGER DEFAULT 0,
    total_sent INTEGER DEFAULT 0,
    total_opened INTEGER DEFAULT 0,
    total_clicked INTEGER DEFAULT 0,
    total_converted INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
`);
  }

  if (missingTables.includes('business_settings')) {
    allSQL.push(`
-- Business settings table
CREATE TABLE IF NOT EXISTS business_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL UNIQUE,
    business_name TEXT,
    business_phone TEXT,
    business_email TEXT,
    referral_reward_cents INTEGER DEFAULT 5000,
    min_job_value_cents INTEGER DEFAULT 10000,
    referral_expiry_days INTEGER DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
`);
  }

  if (missingTables.includes('installed_plugins')) {
    allSQL.push(`
-- Installed plugins table
CREATE TABLE IF NOT EXISTS installed_plugins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    plugin_id TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    config JSONB DEFAULT '{}'::jsonb,
    installed_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    UNIQUE(owner_id, plugin_id)
);
`);
  }

  if (missingTables.includes('webhook_endpoints')) {
    allSQL.push(`
-- Webhook endpoints table
CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    events TEXT[] NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    failure_count INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
`);
  }

  if (missingTables.includes('api_keys')) {
    allSQL.push(`
-- API keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    scopes TEXT[] NOT NULL,
    description TEXT,
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    rate_limit_per_minute INTEGER DEFAULT 100,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
`);
  }

  if (missingTables.includes('pipeline_stages')) {
    allSQL.push(`
-- Pipeline stages table
CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3b82f6',
    sort_order INTEGER DEFAULT 0,
    is_won BOOLEAN DEFAULT FALSE,
    is_lost BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
`);
  }

  if (missingTables.includes('leads')) {
    allSQL.push(`
-- Leads table
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES team_members(id) ON DELETE SET NULL,
    source TEXT,
    title TEXT NOT NULL,
    description TEXT,
    estimated_value_cents INTEGER DEFAULT 0,
    probability INTEGER DEFAULT 50,
    next_follow_up_at TIMESTAMPTZ,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
`);
  }

  if (missingTables.includes('referrals')) {
    allSQL.push(`
-- Referrals table
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    referrer_customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    referred_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    referred_name TEXT,
    referred_phone TEXT,
    referred_email TEXT,
    referral_code TEXT UNIQUE,
    status TEXT DEFAULT 'pending',
    referrer_reward_cents INTEGER DEFAULT 0,
    referrer_reward_paid BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
`);
  }

  if (missingTables.includes('reviews')) {
    allSQL.push(`
-- Review platform enum
DO $$ BEGIN
    CREATE TYPE review_platform AS ENUM ('google', 'yelp', 'facebook', 'homeadvisor', 'angieslist', 'bbb', 'internal');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    platform review_platform NOT NULL,
    external_review_id TEXT,
    reviewer_name TEXT,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title TEXT,
    content TEXT,
    review_date TIMESTAMPTZ,
    response TEXT,
    response_date TIMESTAMPTZ,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);
`);
  }

  // Add RLS policies
  allSQL.push(`
-- Enable Row Level Security on all tables
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename IN ('customers', 'locations', 'jobs', 'job_events', 'job_photos',
            'job_signatures', 'line_items', 'payments', 'comm_threads', 'call_logs',
            'message_logs', 'action_queue', 'automation_events', 'calendar_events',
            'team_members', 'inventory_items', 'marketing_campaigns', 'business_settings',
            'installed_plugins', 'webhook_endpoints', 'api_keys', 'pipeline_stages',
            'leads', 'referrals', 'reviews')
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    END LOOP;
END $$;
`);

  return allSQL.join('\n');
}

// GET endpoint to check status
export async function GET() {
  return NextResponse.json({
    message: 'Use POST to check and generate schema SQL for missing tables'
  });
}
