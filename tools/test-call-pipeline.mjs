#!/usr/bin/env node
/**
 * End-to-End Call → Job Pipeline Tester
 * ======================================
 * Sends a simulated phone call webhook to the local dev server
 * and verifies the full pipeline: webhook → store → AI analysis → job creation.
 *
 * Usage:
 *   node tools/test-call-pipeline.mjs [--base-url http://localhost:3000]
 *
 * Requires: pnpm dev:web running on localhost:3000
 */

const BASE_URL = process.argv.includes('--base-url')
  ? process.argv[process.argv.indexOf('--base-url') + 1]
  : 'http://localhost:3000';

// ============================================================================
// Test Payloads — one per provider format
// ============================================================================

const TEST_OPENPHONE_CALL = {
  type: 'call.completed',
  object: 'call',
  data: {
    object: {
      id: 'test_op_' + Date.now(),
      from: '+16175551234',
      to: '+19785559876',
      direction: 'incoming',
      duration: 47,
      createdAt: new Date().toISOString(),
      callerName: 'John Smith',
      transcript:
        "Hi, I'm calling about my garage door. It won't open. The spring on the left side looks broken — I heard a really loud bang this morning and now the door won't budge. We're at 42 Maple Street in Chelmsford. Can you come out today? My name is John Smith, number is 617-555-1234.",
    },
  },
};

const TEST_BESIDE_CALL = {
  event_type: 'call.completed',
  source: 'beside',
  data: {
    call_id: 'test_bs_' + Date.now(),
    from_number: '+15085559999',
    to_number: '+19785559876',
    direction: 'inbound',
    duration: 32,
    started_at: new Date().toISOString(),
    caller_name: 'Jane Doe',
    transcript:
      "Hello, I need someone to look at my garage door opener. It's been making a grinding noise for the past week and now it's barely lifting the door. I'm in Westford at 15 Oak Lane. Can I get a quote?",
  },
};

const TEST_SPAM_CALL = {
  from: '+18005551111',
  to: '+19785559876',
  direction: 'inbound',
  duration: 18,
  transcript:
    "Hello this is a reminder that your car warranty is about to expire. Press 1 to speak to an agent about extending your coverage. This is your final notice.",
};

const TEST_SHORT_CALL = {
  from: '+16175550000',
  to: '+19785559876',
  direction: 'inbound',
  duration: 2,
};

// ============================================================================
// Test Runner
// ============================================================================

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function log(emoji, msg) {
  console.log(`${emoji}  ${msg}`);
}

async function testEndpoint(name, payload, expect) {
  const url = `${BASE_URL}/api/webhooks/call-received`;
  log('📡', `${colors.cyan}Testing: ${name}${colors.reset}`);
  log('  ', `POST ${url}`);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    const passed = expect(res.status, data);

    if (passed) {
      log('✅', `${colors.green}PASSED${colors.reset} (${res.status})`);
    } else {
      log('❌', `${colors.red}FAILED${colors.reset} (${res.status})`);
    }
    log('  ', `Response: ${JSON.stringify(data, null, 2).substring(0, 500)}`);
    console.log('');
    return { name, passed, status: res.status, data };
  } catch (err) {
    log('❌', `${colors.red}ERROR: ${err.message}${colors.reset}`);
    console.log('');
    return { name, passed: false, error: err.message };
  }
}

async function testHealthCheck() {
  const url = `${BASE_URL}/api/webhooks/call-received`;
  log('🏥', `${colors.cyan}Health Check${colors.reset}: GET ${url}`);

  try {
    const res = await fetch(url);
    const data = await res.json();
    const ok = res.status === 200 && data.status === 'ok';
    log(ok ? '✅' : '❌', ok ? `${colors.green}Server is running${colors.reset}` : `${colors.red}Server issue${colors.reset}`);
    console.log('');
    return ok;
  } catch (err) {
    log('❌', `${colors.red}Cannot connect to ${BASE_URL}. Is the dev server running?${colors.reset}`);
    log('  ', `Run: pnpm dev:web`);
    console.log('');
    return false;
  }
}

async function testAIEndpoint() {
  const url = `${BASE_URL}/api/ai/analyze-call`;
  log('🧠', `${colors.cyan}AI Endpoint Check${colors.reset}: GET ${url}`);

  try {
    const res = await fetch(url);
    const data = await res.json();
    log('✅', `AI endpoint accessible (${res.status})`);
    console.log('');
    return true;
  } catch (err) {
    log('❌', `${colors.red}AI endpoint unreachable: ${err.message}${colors.reset}`);
    console.log('');
    return false;
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('');
  console.log(`${colors.bold}══════════════════════════════════════════════════`);
  console.log(`  Murray's FSM — Call Pipeline End-to-End Test`);
  console.log(`══════════════════════════════════════════════════${colors.reset}`);
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  Time: ${new Date().toLocaleString()}`);
  console.log('');

  // Step 1: Health check
  const serverOk = await testHealthCheck();
  if (!serverOk) {
    console.log(`${colors.yellow}⚠️  Start the dev server first: pnpm dev:web${colors.reset}`);
    process.exit(1);
  }

  await testAIEndpoint();

  // Step 2: Run tests
  const results = [];

  // Test 1: Short call should be skipped
  results.push(
    await testEndpoint(
      '1. Short call (should skip)',
      TEST_SHORT_CALL,
      (status, data) => status === 200 && data.skipped === true
    )
  );

  // Test 2: OpenPhone format with transcript → should store + analyze
  results.push(
    await testEndpoint(
      '2. OpenPhone call (spring broken, emergency)',
      TEST_OPENPHONE_CALL,
      (status, data) => status === 200 && data.received === true && data.call_id
    )
  );

  // Test 3: Beside format with transcript → should store + analyze
  results.push(
    await testEndpoint(
      '3. Beside call (opener noise, quote request)',
      TEST_BESIDE_CALL,
      (status, data) => status === 200 && data.received === true && data.call_id
    )
  );

  // Test 4: Spam call → should store + analyze but flag as spam
  results.push(
    await testEndpoint(
      '4. Spam call (car warranty)',
      TEST_SPAM_CALL,
      (status, data) => {
        if (status !== 200 || !data.received) return false;
        if (data.analyzed && data.analysis) {
          return data.analysis.is_spam === true;
        }
        return true; // Still pass if stored but not analyzed (no API key)
      }
    )
  );

  // Summary
  console.log(`${colors.bold}══════════════════════════════════════════════════`);
  console.log(`  RESULTS`);
  console.log(`══════════════════════════════════════════════════${colors.reset}`);

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  results.forEach((r) => {
    const icon = r.passed ? '✅' : '❌';
    console.log(`  ${icon} ${r.name}`);
  });

  console.log('');
  console.log(
    `  ${colors.bold}${passed} passed, ${failed} failed${colors.reset} out of ${results.length} tests`
  );

  // Verification hints
  console.log('');
  console.log(`${colors.cyan}📋 Manual Verification Checklist:${colors.reset}`);
  console.log(`  1. Check Supabase → call_logs table for new entries`);
  console.log(`  2. OpenPhone call should have ai_extraction JSONB populated`);
  console.log(`  3. OpenPhone call should create a customer + job (if ANTHROPIC_API_KEY set)`);
  console.log(`  4. Spam call analysis.is_spam should be true`);
  console.log(`  5. Beside call should recommend 'send_quote' or 'follow_up'`);
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

main();
