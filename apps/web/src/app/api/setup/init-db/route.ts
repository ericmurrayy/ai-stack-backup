import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// This endpoint initializes the database schema using the service role key
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

    // Execute schema creation using raw SQL via RPC or direct query
    // Note: Supabase JS client doesn't support raw SQL directly,
    // so we'll check tables and create storage buckets instead

    const results: { step: string; status: string; error?: string }[] = [];

    // Check which tables exist
    const tables = [
      'profiles', 'customers', 'locations', 'jobs', 'job_events',
      'job_photos', 'job_signatures', 'line_items', 'payments',
      'comm_threads', 'call_logs', 'message_logs', 'action_queue',
      'automation_events', 'calendar_events'
    ];

    for (const table of tables) {
      const { error } = await supabase.from(table).select('count').limit(1);
      if (error?.code === '42P01') {
        results.push({ step: `Check table: ${table}`, status: 'NOT_FOUND', error: 'Table does not exist' });
      } else if (error) {
        results.push({ step: `Check table: ${table}`, status: 'ERROR', error: error.message });
      } else {
        results.push({ step: `Check table: ${table}`, status: 'OK' });
      }
    }

    // Check/create storage buckets
    const buckets = ['job-photos', 'job-signatures'];
    for (const bucket of buckets) {
      const { data: existingBucket, error: getBucketError } = await supabase.storage.getBucket(bucket);

      if (getBucketError && getBucketError.message.includes('not found')) {
        // Create bucket
        const { error: createError } = await supabase.storage.createBucket(bucket, {
          public: false,
          fileSizeLimit: 10485760, // 10MB
        });
        if (createError) {
          results.push({ step: `Create bucket: ${bucket}`, status: 'ERROR', error: createError.message });
        } else {
          results.push({ step: `Create bucket: ${bucket}`, status: 'CREATED' });
        }
      } else if (existingBucket) {
        results.push({ step: `Check bucket: ${bucket}`, status: 'OK' });
      } else if (getBucketError) {
        results.push({ step: `Check bucket: ${bucket}`, status: 'ERROR', error: getBucketError.message });
      }
    }

    const tableResults = results.filter(r => r.step.startsWith('Check table:'));
    const tablesExist = tableResults.every(r => r.status === 'OK');
    const needsSchema = tableResults.some(r => r.status === 'NOT_FOUND' || r.status === 'ERROR');

    return NextResponse.json({
      success: true,
      tablesExist,
      needsSchema,
      results,
      message: needsSchema
        ? 'Database tables need to be created. Please run the schema SQL in Supabase SQL Editor.'
        : 'Database is properly configured!'
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
