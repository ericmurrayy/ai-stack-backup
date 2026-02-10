#!/bin/bash
# Murray's FSM - Seed Execution Loop Test Data
# ==============================================
# Seeds a test lead → customer → action_queue entries to validate
# the full execution loop end-to-end.
#
# Usage: ./scripts/seed-execution-loop.sh [--api-url URL] [--api-key KEY]
#
# Requires: curl, jq
# Default URL: http://localhost:3000

set -uo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Defaults
API_URL="${API_URL:-http://localhost:3000}"
API_KEY="${API_KEY:-}"

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-url) API_URL="$2"; shift 2 ;;
    --api-key) API_KEY="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--api-url URL] [--api-key KEY]"
      echo ""
      echo "Seeds test data for the full execution loop."
      echo "  --api-url  Base URL (default: http://localhost:3000)"
      echo "  --api-key  API key for authentication"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Load .env if available
if [[ -f "$PROJECT_ROOT/apps/web/.env" ]]; then
  set -a
  source <(grep -v '^\s*#' "$PROJECT_ROOT/apps/web/.env" | grep -v '^\s*$') 2>/dev/null || true
  set +a
fi

SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-}"
SUPABASE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}}"

if [[ -z "$SUPABASE_URL" || "$SUPABASE_URL" == *"your-"* ]]; then
  echo -e "${YELLOW}No Supabase URL configured. Using API seeding mode.${NC}"
  USE_API=true
else
  USE_API=false
fi

echo ""
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}Murray's FSM - Execution Loop Seed${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""

# -----------------------------------------------------------------------
# Step 1: Simulate inbound SMS webhook (lead creation)
# -----------------------------------------------------------------------
echo -e "${CYAN}[1/5] Simulating inbound SMS webhook...${NC}"

INBOUND_RESPONSE=$(curl -s -X POST "${API_URL}/api/webhooks/inbound" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "message.received",
    "direction": "inbound",
    "from_phone": "+15551234567",
    "to_phone": "+15559876543",
    "body": "Hi, my garage door spring broke and it wont open. I am at 123 Oak Street, Austin TX 78701. Can you come out tomorrow morning?",
    "external_message_id": "test-msg-seed-001",
    "owner_id": "00000000-0000-0000-0000-000000000001"
  }' 2>/dev/null)

if echo "$INBOUND_RESPONSE" | grep -q '"success"' 2>/dev/null; then
  echo -e "${GREEN}  Inbound webhook accepted${NC}"
  echo "  Response: $(echo "$INBOUND_RESPONSE" | head -c 200)"
else
  echo -e "${YELLOW}  Inbound webhook returned: $(echo "$INBOUND_RESPONSE" | head -c 200)${NC}"
fi

echo ""

# -----------------------------------------------------------------------
# Step 2: Create a test customer + job via API
# -----------------------------------------------------------------------
echo -e "${CYAN}[2/5] Creating test job via API...${NC}"

if [[ -n "$API_KEY" ]]; then
  AUTH_HEADER="Authorization: Bearer ${API_KEY}"
else
  AUTH_HEADER="x-api-key: test-seed-key"
fi

JOB_RESPONSE=$(curl -s -X POST "${API_URL}/api/v1/jobs" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "title": "Spring Replacement - Test Seed",
    "customer_id": "00000000-0000-0000-0000-000000000010",
    "service_type": "Spring Replacement",
    "scheduled_start": "'"$(date -u -d '+1 day' '+%Y-%m-%dT09:00:00Z' 2>/dev/null || date -u -v+1d '+%Y-%m-%dT09:00:00Z')"'",
    "notes": "Seeded by execution loop test script"
  }' 2>/dev/null)

JOB_ID=$(echo "$JOB_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [[ -n "$JOB_ID" ]]; then
  echo -e "${GREEN}  Job created: ${JOB_ID}${NC}"
else
  echo -e "${YELLOW}  Job creation returned: $(echo "$JOB_RESPONSE" | head -c 200)${NC}"
  JOB_ID="test-job-seed-001"
fi

echo ""

# -----------------------------------------------------------------------
# Step 3: Seed action_queue entries directly (if Supabase available)
# -----------------------------------------------------------------------
echo -e "${CYAN}[3/5] Seeding action_queue entries...${NC}"

OWNER_ID="00000000-0000-0000-0000-000000000001"

if [[ "$USE_API" == "false" ]]; then
  # Direct Supabase insert
  for KIND in "propose_booking_times" "send_sms" "request_review"; do
    case "$KIND" in
      propose_booking_times)
        PAYLOAD='{"service_type":"Spring Replacement","customer_id":"00000000-0000-0000-0000-000000000010","num_days":7}'
        ;;
      send_sms)
        PAYLOAD='{"to_phone":"+15551234567","message":"Hi! This is Murray'\''s Garage Door Service. We received your request and will get back to you shortly.","customer_name":"Test Customer"}'
        ;;
      request_review)
        PAYLOAD='{"job_id":"'"$JOB_ID"'","customer_id":"00000000-0000-0000-0000-000000000010","customer_phone":"+15551234567","send_via":"sms"}'
        ;;
    esac

    RESULT=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/action_queue" \
      -H "apikey: ${SUPABASE_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_KEY}" \
      -H "Content-Type: application/json" \
      -H "Prefer: return=representation" \
      -d '{
        "owner_id": "'"$OWNER_ID"'",
        "kind": "'"$KIND"'",
        "payload": '"$PAYLOAD"',
        "source_type": "test_seed",
        "source_id": "seed-'"$KIND"'-001",
        "requires_approval": true,
        "status": "pending",
        "idempotency_key": "seed:'"$KIND"':001",
        "result": {},
        "retry_count": 0,
        "max_retries": 3
      }' 2>/dev/null)

    if echo "$RESULT" | grep -q '"id"' 2>/dev/null; then
      ACTION_ID=$(echo "$RESULT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
      echo -e "${GREEN}  Seeded ${KIND}: ${ACTION_ID}${NC}"
    else
      echo -e "${YELLOW}  ${KIND}: $(echo "$RESULT" | head -c 150)${NC}"
    fi
  done
else
  echo -e "${YELLOW}  Skipping direct DB seed (no Supabase credentials)${NC}"
  echo "  Action queue entries will be created by the inbound webhook handler"
fi

echo ""

# -----------------------------------------------------------------------
# Step 4: Test approval endpoint
# -----------------------------------------------------------------------
echo -e "${CYAN}[4/5] Testing approval endpoints...${NC}"

# List pending approvals
APPROVALS=$(curl -s "${API_URL}/api/approvals/list?status=pending" \
  -H "$AUTH_HEADER" 2>/dev/null)

PENDING_COUNT=$(echo "$APPROVALS" | grep -o '"status":"pending"' | wc -l)
echo -e "  Pending approvals: ${PENDING_COUNT}"

echo ""

# -----------------------------------------------------------------------
# Step 5: Test schedule check
# -----------------------------------------------------------------------
echo -e "${CYAN}[5/5] Testing schedule availability...${NC}"

TOMORROW=$(date -u -d '+1 day' '+%Y-%m-%d' 2>/dev/null || date -u -v+1d '+%Y-%m-%d')

SCHEDULE_RESPONSE=$(curl -s "${API_URL}/api/schedule/check?date=${TOMORROW}&duration=90" 2>/dev/null)

if echo "$SCHEDULE_RESPONSE" | grep -q '"slots"' 2>/dev/null; then
  SLOT_COUNT=$(echo "$SCHEDULE_RESPONSE" | grep -o '"start"' | wc -l)
  echo -e "${GREEN}  Schedule check works. ${SLOT_COUNT} slots available for ${TOMORROW}${NC}"
else
  echo -e "${YELLOW}  Schedule response: $(echo "$SCHEDULE_RESPONSE" | head -c 200)${NC}"
fi

echo ""
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}Seed Complete${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Open dashboard: ${API_URL}/approvals"
echo "  2. Review pending actions"
echo "  3. Approve → verify execution"
echo "  4. Check audit_log for traces"
echo ""
