'use client';

import { useState, useEffect } from 'react';

interface SetupResult {
  step: string;
  status: string;
  error?: string;
}

interface InitResponse {
  success: boolean;
  tablesExist: boolean;
  needsSchema: boolean;
  results: SetupResult[];
  message: string;
}

export default function SetupPage() {
  const [status, setStatus] = useState<string>('Checking database...');
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(true);
  const [dbReady, setDbReady] = useState<boolean | null>(null);
  const [initResponse, setInitResponse] = useState<InitResponse | null>(null);

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const checkDatabase = async () => {
    setIsRunning(true);
    setStatus('Checking database configuration...');
    addLog('Initializing database check...');

    try {
      const response = await fetch('/api/setup/init-db', {
        method: 'POST',
      });

      const data: InitResponse = await response.json();
      setInitResponse(data);

      if (data.success) {
        for (const result of data.results) {
          const statusIcon = result.status === 'OK' ? '✓' : result.status === 'CREATED' ? '✓ Created' : '✗';
          addLog(`${statusIcon} ${result.step}: ${result.status}${result.error ? ` - ${result.error}` : ''}`);
        }

        if (data.tablesExist) {
          addLog('✓ All database tables exist!');
          setDbReady(true);
          setStatus('Database is ready!');
        } else {
          addLog('✗ Some tables are missing - run the schema SQL below');
          setDbReady(false);
          setStatus('Database needs initialization');
        }
      } else {
        addLog(`ERROR: ${data.message || 'Unknown error'}`);
        setDbReady(false);
        setStatus('Database check failed');
      }
    } catch (err: any) {
      addLog(`Connection error: ${err.message}`);
      setDbReady(false);
      setStatus('Connection failed');
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    checkDatabase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Murray&apos;s FSM - Setup</h1>
        <p className="text-gray-600 mb-8">Configure your database and get started.</p>

        {/* Status Card */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Database Status</h2>
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-4 h-4 rounded-full ${
              dbReady === null ? 'bg-yellow-400 animate-pulse' :
              dbReady ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <span className="font-medium">{status}</span>
          </div>

          {dbReady === true && (
            <div className="bg-green-50 border border-green-200 rounded p-4 mb-4">
              <p className="text-green-800">
                ✓ Your database is configured and ready to use!
              </p>
              <div className="mt-4 flex gap-4">
                <a
                  href="/auth/signup"
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Create Account
                </a>
                <a
                  href="/auth/login"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Sign In
                </a>
              </div>
            </div>
          )}

          {dbReady === false && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
              <p className="text-yellow-800 mb-2">
                ⚠ Database tables need to be created.
              </p>
              <p className="text-yellow-700 text-sm">
                Follow the steps below to set up your database.
              </p>
            </div>
          )}

          <button
            onClick={checkDatabase}
            disabled={isRunning}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isRunning ? 'Checking...' : 'Re-check Database'}
          </button>
        </div>

        {/* Setup Instructions */}
        {dbReady === false && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Setup Instructions</h2>

            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">1</div>
                <div>
                  <h3 className="font-medium">Open Supabase SQL Editor</h3>
                  <p className="text-gray-600 text-sm mb-2">Click the button below to open your Supabase project&apos;s SQL editor.</p>
                  <a
                    href="https://supabase.com/dashboard/project/pglzuykkdazzvxrdargj/sql/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Open SQL Editor →
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">2</div>
                <div>
                  <h3 className="font-medium">Copy and Run Schema SQL</h3>
                  <p className="text-gray-600 text-sm mb-2">Expand the section below, copy all the SQL, and paste it in the SQL Editor. Click &quot;Run&quot;.</p>
                  <details className="mb-2">
                    <summary className="cursor-pointer text-blue-600 hover:underline font-medium">
                      ▶ View Schema SQL (click to expand)
                    </summary>
                    <div className="mt-2 relative">
                      <button
                        onClick={() => {
                          const schema = document.getElementById('schema-sql')?.textContent;
                          if (schema) {
                            navigator.clipboard.writeText(schema);
                            addLog('Schema SQL copied to clipboard!');
                          }
                        }}
                        className="absolute top-2 right-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        Copy SQL
                      </button>
                      <pre id="schema-sql" className="p-4 bg-gray-900 text-green-400 rounded text-xs overflow-x-auto max-h-96">
{`-- Murray's FSM - Supabase Schema
-- Run this in Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Helper function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- PROFILES
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

-- CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

-- LOCATIONS
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
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

-- JOB STATUS ENUM
DO $$ BEGIN
    CREATE TYPE job_status AS ENUM ('scheduled', 'in_progress', 'completed', 'canceled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- JOBS
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
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
    diagnostics JSONB DEFAULT '{}'::jsonb,
    total_estimate_cents INTEGER DEFAULT 0,
    total_invoice_cents INTEGER DEFAULT 0,
    paid_cents INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

-- JOB_EVENTS
CREATE TABLE IF NOT EXISTS job_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

-- PHOTO KIND ENUM
DO $$ BEGIN
    CREATE TYPE photo_kind AS ENUM ('before', 'after', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- JOB_PHOTOS
CREATE TABLE IF NOT EXISTS job_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    kind photo_kind DEFAULT 'other',
    storage_bucket TEXT NOT NULL DEFAULT 'job-photos',
    storage_path TEXT NOT NULL,
    mime_type TEXT,
    captured_at TIMESTAMPTZ DEFAULT NOW(),
    caption TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

-- JOB_SIGNATURES
CREATE TABLE IF NOT EXISTS job_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    signer_name TEXT NOT NULL,
    signed_at TIMESTAMPTZ DEFAULT NOW(),
    storage_bucket TEXT NOT NULL DEFAULT 'job-signatures',
    storage_path TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

-- LINE_ITEM KIND ENUM
DO $$ BEGIN
    CREATE TYPE line_item_kind AS ENUM ('estimate', 'invoice');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- LINE_ITEMS
CREATE TABLE IF NOT EXISTS line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    kind line_item_kind NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    qty NUMERIC(10, 2) DEFAULT 1,
    unit_price_cents INTEGER NOT NULL,
    total_cents INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

-- PAYMENT STATUS ENUM
DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'canceled', 'refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
    provider TEXT DEFAULT 'stripe',
    stripe_payment_intent_id TEXT,
    amount_cents INTEGER NOT NULL,
    status payment_status DEFAULT 'pending',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

-- COMM_THREADS
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

-- CALL DIRECTION ENUM
DO $$ BEGIN
    CREATE TYPE call_direction AS ENUM ('inbound', 'outbound');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CALL_LOGS
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
    answered_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    recording_url TEXT,
    transcript TEXT,
    summary TEXT,
    action_items JSONB DEFAULT '[]'::jsonb,
    ai_extraction JSONB DEFAULT '{}'::jsonb,
    related_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    raw_event JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

-- MESSAGE DIRECTION ENUM
DO $$ BEGIN
    CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- MESSAGE_LOGS
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
    delivered_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    ai_extraction JSONB DEFAULT '{}'::jsonb,
    related_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    raw_event JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

-- ACTION STATUS ENUM
DO $$ BEGIN
    CREATE TYPE action_status AS ENUM ('pending', 'approved', 'rejected', 'executed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ACTION_QUEUE
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

-- AUTOMATION_EVENTS
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

-- CALENDAR PROVIDER ENUM
DO $$ BEGIN
    CREATE TYPE calendar_provider AS ENUM ('google', 'outlook', 'icloud');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CALENDAR EVENT STATUS ENUM
DO $$ BEGIN
    CREATE TYPE calendar_event_status AS ENUM ('created', 'updated', 'deleted');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CALENDAR_EVENTS
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    provider calendar_provider NOT NULL,
    external_event_id TEXT,
    calendar_id TEXT,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    status calendar_event_status DEFAULT 'created',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

-- Create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, owner_id, full_name, phone)
    VALUES (
        NEW.id,
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'phone', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

SELECT 'Schema created successfully!' as result;`}
                      </pre>
                    </div>
                  </details>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">3</div>
                <div>
                  <h3 className="font-medium">Run RLS Policies SQL</h3>
                  <p className="text-gray-600 text-sm mb-2">After the schema, run this SQL to enable Row Level Security.</p>
                  <details className="mb-2">
                    <summary className="cursor-pointer text-blue-600 hover:underline font-medium">
                      ▶ View RLS Policies SQL (click to expand)
                    </summary>
                    <div className="mt-2 relative">
                      <button
                        onClick={() => {
                          const rls = document.getElementById('rls-sql')?.textContent;
                          if (rls) {
                            navigator.clipboard.writeText(rls);
                            addLog('RLS Policies SQL copied to clipboard!');
                          }
                        }}
                        className="absolute top-2 right-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        Copy SQL
                      </button>
                      <pre id="rls-sql" className="p-4 bg-gray-900 text-green-400 rounded text-xs overflow-x-auto max-h-96">
{`-- Murray's FSM - Row Level Security Policies
-- Run this AFTER creating the tables

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comm_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (id = auth.uid());

-- CUSTOMERS POLICIES
CREATE POLICY "Users can view own customers" ON customers FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own customers" ON customers FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own customers" ON customers FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can delete own customers" ON customers FOR DELETE USING (owner_id = auth.uid());

-- LOCATIONS POLICIES
CREATE POLICY "Users can view own locations" ON locations FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own locations" ON locations FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own locations" ON locations FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can delete own locations" ON locations FOR DELETE USING (owner_id = auth.uid());

-- JOBS POLICIES
CREATE POLICY "Users can view own jobs" ON jobs FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own jobs" ON jobs FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own jobs" ON jobs FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can delete own jobs" ON jobs FOR DELETE USING (owner_id = auth.uid());

-- JOB_EVENTS POLICIES
CREATE POLICY "Users can view own job events" ON job_events FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own job events" ON job_events FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own job events" ON job_events FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can delete own job events" ON job_events FOR DELETE USING (owner_id = auth.uid());

-- JOB_PHOTOS POLICIES
CREATE POLICY "Users can view own job photos" ON job_photos FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own job photos" ON job_photos FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own job photos" ON job_photos FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can delete own job photos" ON job_photos FOR DELETE USING (owner_id = auth.uid());

-- JOB_SIGNATURES POLICIES
CREATE POLICY "Users can view own job signatures" ON job_signatures FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own job signatures" ON job_signatures FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own job signatures" ON job_signatures FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can delete own job signatures" ON job_signatures FOR DELETE USING (owner_id = auth.uid());

-- LINE_ITEMS POLICIES
CREATE POLICY "Users can view own line items" ON line_items FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own line items" ON line_items FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own line items" ON line_items FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can delete own line items" ON line_items FOR DELETE USING (owner_id = auth.uid());

-- PAYMENTS POLICIES
CREATE POLICY "Users can view own payments" ON payments FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own payments" ON payments FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own payments" ON payments FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can delete own payments" ON payments FOR DELETE USING (owner_id = auth.uid());

-- COMM_THREADS POLICIES
CREATE POLICY "Users can view own comm threads" ON comm_threads FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own comm threads" ON comm_threads FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own comm threads" ON comm_threads FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can delete own comm threads" ON comm_threads FOR DELETE USING (owner_id = auth.uid());

-- CALL_LOGS POLICIES
CREATE POLICY "Users can view own call logs" ON call_logs FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own call logs" ON call_logs FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own call logs" ON call_logs FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can delete own call logs" ON call_logs FOR DELETE USING (owner_id = auth.uid());

-- MESSAGE_LOGS POLICIES
CREATE POLICY "Users can view own message logs" ON message_logs FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own message logs" ON message_logs FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own message logs" ON message_logs FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can delete own message logs" ON message_logs FOR DELETE USING (owner_id = auth.uid());

-- ACTION_QUEUE POLICIES
CREATE POLICY "Users can view own action queue" ON action_queue FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own action queue" ON action_queue FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own action queue" ON action_queue FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can delete own action queue" ON action_queue FOR DELETE USING (owner_id = auth.uid());

-- AUTOMATION_EVENTS POLICIES
CREATE POLICY "Users can view own automation events" ON automation_events FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own automation events" ON automation_events FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own automation events" ON automation_events FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can delete own automation events" ON automation_events FOR DELETE USING (owner_id = auth.uid());

-- CALENDAR_EVENTS POLICIES
CREATE POLICY "Users can view own calendar events" ON calendar_events FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can insert own calendar events" ON calendar_events FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can update own calendar events" ON calendar_events FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Users can delete own calendar events" ON calendar_events FOR DELETE USING (owner_id = auth.uid());

SELECT 'RLS Policies created successfully!' as result;`}
                      </pre>
                    </div>
                  </details>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">4</div>
                <div>
                  <h3 className="font-medium">Re-check Database</h3>
                  <p className="text-gray-600 text-sm mb-2">Click the button above to verify all tables were created successfully.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Logs */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Setup Logs</h2>
          <div className="bg-gray-900 rounded p-4 h-64 overflow-y-auto font-mono text-sm">
            {logs.length === 0 ? (
              <p className="text-gray-500">Initializing...</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={`${
                  log.includes('ERROR') || log.includes('✗') ? 'text-red-400' :
                  log.includes('✓') || log.includes('OK') || log.includes('successful') || log.includes('ready') ? 'text-green-400' :
                  log.includes('NOT_FOUND') || log.includes('missing') ? 'text-yellow-400' :
                  'text-gray-300'
                }`}>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-6 flex flex-wrap gap-4">
          <a
            href="https://supabase.com/dashboard/project/pglzuykkdazzvxrdargj"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Supabase Dashboard
          </a>
          <a
            href="https://supabase.com/dashboard/project/pglzuykkdazzvxrdargj/auth/users"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Auth Users
          </a>
          <a
            href="https://supabase.com/dashboard/project/pglzuykkdazzvxrdargj/storage/buckets"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Storage Buckets
          </a>
        </div>
      </div>
    </div>
  );
}
