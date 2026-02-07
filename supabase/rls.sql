-- Murray's FSM - Row Level Security Policies
-- ============================================
-- All tables use owner_id = auth.uid() pattern

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================
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

-- ============================================================================
-- PROFILES
-- Special case: id = auth.uid() (profile is linked to auth user)
-- ============================================================================
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT
    WITH CHECK (id = auth.uid());

-- ============================================================================
-- CUSTOMERS
-- ============================================================================
CREATE POLICY "Users can view own customers"
    ON customers FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own customers"
    ON customers FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own customers"
    ON customers FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own customers"
    ON customers FOR DELETE
    USING (owner_id = auth.uid());

-- ============================================================================
-- LOCATIONS
-- ============================================================================
CREATE POLICY "Users can view own locations"
    ON locations FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own locations"
    ON locations FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own locations"
    ON locations FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own locations"
    ON locations FOR DELETE
    USING (owner_id = auth.uid());

-- ============================================================================
-- JOBS
-- ============================================================================
CREATE POLICY "Users can view own jobs"
    ON jobs FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own jobs"
    ON jobs FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own jobs"
    ON jobs FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own jobs"
    ON jobs FOR DELETE
    USING (owner_id = auth.uid());

-- ============================================================================
-- JOB_EVENTS
-- ============================================================================
CREATE POLICY "Users can view own job events"
    ON job_events FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own job events"
    ON job_events FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own job events"
    ON job_events FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own job events"
    ON job_events FOR DELETE
    USING (owner_id = auth.uid());

-- ============================================================================
-- JOB_PHOTOS
-- ============================================================================
CREATE POLICY "Users can view own job photos"
    ON job_photos FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own job photos"
    ON job_photos FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own job photos"
    ON job_photos FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own job photos"
    ON job_photos FOR DELETE
    USING (owner_id = auth.uid());

-- ============================================================================
-- JOB_SIGNATURES
-- ============================================================================
CREATE POLICY "Users can view own job signatures"
    ON job_signatures FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own job signatures"
    ON job_signatures FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own job signatures"
    ON job_signatures FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own job signatures"
    ON job_signatures FOR DELETE
    USING (owner_id = auth.uid());

-- ============================================================================
-- LINE_ITEMS
-- ============================================================================
CREATE POLICY "Users can view own line items"
    ON line_items FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own line items"
    ON line_items FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own line items"
    ON line_items FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own line items"
    ON line_items FOR DELETE
    USING (owner_id = auth.uid());

-- ============================================================================
-- PAYMENTS
-- ============================================================================
CREATE POLICY "Users can view own payments"
    ON payments FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own payments"
    ON payments FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own payments"
    ON payments FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own payments"
    ON payments FOR DELETE
    USING (owner_id = auth.uid());

-- ============================================================================
-- COMM_THREADS
-- ============================================================================
CREATE POLICY "Users can view own comm threads"
    ON comm_threads FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own comm threads"
    ON comm_threads FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own comm threads"
    ON comm_threads FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own comm threads"
    ON comm_threads FOR DELETE
    USING (owner_id = auth.uid());

-- ============================================================================
-- CALL_LOGS
-- ============================================================================
CREATE POLICY "Users can view own call logs"
    ON call_logs FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own call logs"
    ON call_logs FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own call logs"
    ON call_logs FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own call logs"
    ON call_logs FOR DELETE
    USING (owner_id = auth.uid());

-- ============================================================================
-- MESSAGE_LOGS
-- ============================================================================
CREATE POLICY "Users can view own message logs"
    ON message_logs FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own message logs"
    ON message_logs FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own message logs"
    ON message_logs FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own message logs"
    ON message_logs FOR DELETE
    USING (owner_id = auth.uid());

-- ============================================================================
-- ACTION_QUEUE
-- ============================================================================
CREATE POLICY "Users can view own action queue"
    ON action_queue FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own action queue"
    ON action_queue FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own action queue"
    ON action_queue FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own action queue"
    ON action_queue FOR DELETE
    USING (owner_id = auth.uid());

-- ============================================================================
-- AUTOMATION_EVENTS
-- ============================================================================
CREATE POLICY "Users can view own automation events"
    ON automation_events FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own automation events"
    ON automation_events FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own automation events"
    ON automation_events FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own automation events"
    ON automation_events FOR DELETE
    USING (owner_id = auth.uid());

-- ============================================================================
-- CALENDAR_EVENTS
-- ============================================================================
CREATE POLICY "Users can view own calendar events"
    ON calendar_events FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own calendar events"
    ON calendar_events FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own calendar events"
    ON calendar_events FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own calendar events"
    ON calendar_events FOR DELETE
    USING (owner_id = auth.uid());

-- ============================================================================
-- STORAGE POLICIES
-- ============================================================================
-- Note: Apply these in Supabase Dashboard > Storage > Policies

-- job-photos bucket policies:
-- CREATE POLICY "Users can upload job photos"
-- ON storage.objects FOR INSERT
-- WITH CHECK (
--     bucket_id = 'job-photos'
--     AND (storage.foldername(name))[1] = auth.uid()::text
-- );
--
-- CREATE POLICY "Users can view own job photos"
-- ON storage.objects FOR SELECT
-- USING (
--     bucket_id = 'job-photos'
--     AND (storage.foldername(name))[1] = auth.uid()::text
-- );
--
-- CREATE POLICY "Users can delete own job photos"
-- ON storage.objects FOR DELETE
-- USING (
--     bucket_id = 'job-photos'
--     AND (storage.foldername(name))[1] = auth.uid()::text
-- );

-- job-signatures bucket policies:
-- CREATE POLICY "Users can upload job signatures"
-- ON storage.objects FOR INSERT
-- WITH CHECK (
--     bucket_id = 'job-signatures'
--     AND (storage.foldername(name))[1] = auth.uid()::text
-- );
--
-- CREATE POLICY "Users can view own job signatures"
-- ON storage.objects FOR SELECT
-- USING (
--     bucket_id = 'job-signatures'
--     AND (storage.foldername(name))[1] = auth.uid()::text
-- );
--
-- CREATE POLICY "Users can delete own job signatures"
-- ON storage.objects FOR DELETE
-- USING (
--     bucket_id = 'job-signatures'
--     AND (storage.foldername(name))[1] = auth.uid()::text
-- );
