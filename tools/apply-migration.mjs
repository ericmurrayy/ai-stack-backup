// Apply migration via Supabase Management API
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const supabaseUrl = 'https://pglzuykkdazzvxrdargj.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnbHp1eWtrZGF6enZ4cmRhcmdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODUxNjUwNSwiZXhwIjoyMDg0MDkyNTA1fQ.e8QAcn2ldXd6VU2vzOg5sHhUQ3P44scm73uqZ0eAXrY';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'public' },
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  // Read the SQL file
  const sqlPath = path.join(__dirname, '..', 'supabase', 'add-communication-tables.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Executing migration...');

  // Try to execute via RPC if available, otherwise we need dashboard
  try {
    // First, test if we can insert into a table to verify connectivity
    const { data: profiles, error: testError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (testError) {
      console.error('Connection test failed:', testError);
      return;
    }

    console.log('Connection successful. Found profiles:', profiles?.length || 0);

    // Unfortunately, supabase-js doesn't support raw SQL execution
    // You need to run this SQL in the Supabase Dashboard > SQL Editor
    console.log('\n===========================================');
    console.log('IMPORTANT: Run the following SQL in Supabase Dashboard');
    console.log('Go to: https://supabase.com/dashboard/project/pglzuykkdazzvxrdargj/sql/new');
    console.log('===========================================\n');
    console.log('Or copy the contents of:');
    console.log(sqlPath);

  } catch (err) {
    console.error('Error:', err);
  }
}

main();
