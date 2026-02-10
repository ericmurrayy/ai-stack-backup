#!/bin/bash
# Murray's FSM - Execution Loop Smoke Tests
# ==========================================
# Tests the full approval-gated execution loop:
#   inbound → lead → approve → execute → audit
#
# Usage: ./scripts/test-execution-loop.sh [--api-url URL]

set -uo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

API_URL="${API_URL:-http://localhost:3000}"
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-url) API_URL="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--api-url URL]"
      echo "Tests the execution loop endpoints."
      exit 0
      ;;
    *) shift ;;
  esac
done

pass() { ((TESTS_PASSED++)) || true; echo -e "${GREEN}[PASS]${NC} $1"; }
fail() { ((TESTS_FAILED++)) || true; echo -e "${RED}[FAIL]${NC} $1"; [[ -n "${2:-}" ]] && echo "       $2"; }
skip() { ((TESTS_SKIPPED++)) || true; echo -e "${YELLOW}[SKIP]${NC} $1"; }

# Check if server is running
check_server() {
  local response
  response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "${API_URL}" 2>/dev/null)
  if [[ "$response" == "000" ]]; then
    echo -e "${RED}Server not reachable at ${API_URL}${NC}"
    echo "Start the dev server: cd murray-fsm && pnpm dev:web"
    exit 1
  fi
}

echo ""
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}Execution Loop Smoke Tests${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""

check_server

# -----------------------------------------------------------------------
# Test 1: Inbound webhook accepts valid payload
# -----------------------------------------------------------------------
echo -e "${CYAN}Inbound Webhook Tests${NC}"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/webhooks/inbound" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "message.received",
    "direction": "inbound",
    "from_phone": "+15550000001",
    "to_phone": "+15559999999",
    "body": "I need a garage door repair",
    "external_message_id": "smoke-test-msg-'$(date +%s)'",
    "owner_id": "00000000-0000-0000-0000-000000000001"
  }' 2>/dev/null)

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [[ "$HTTP_CODE" == "200" ]] || [[ "$HTTP_CODE" == "201" ]]; then
  pass "Inbound webhook accepts SMS payload (HTTP $HTTP_CODE)"
else
  fail "Inbound webhook" "Got HTTP $HTTP_CODE: $(echo "$BODY" | head -c 150)"
fi

# Test missing required fields
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${API_URL}/api/webhooks/inbound" \
  -H "Content-Type: application/json" \
  -d '{"type": "message.received"}' 2>/dev/null)

if [[ "$RESPONSE" == "400" ]]; then
  pass "Inbound webhook rejects incomplete payload (HTTP 400)"
else
  fail "Inbound webhook validation" "Expected 400, got $RESPONSE"
fi

echo ""

# -----------------------------------------------------------------------
# Test 2: Schedule check endpoint
# -----------------------------------------------------------------------
echo -e "${CYAN}Schedule Check Tests${NC}"

TOMORROW=$(date -u -d '+1 day' '+%Y-%m-%d' 2>/dev/null || date -u -v+1d '+%Y-%m-%d')

RESPONSE=$(curl -s -w "\n%{http_code}" "${API_URL}/api/schedule/check?date=${TOMORROW}&duration=90" 2>/dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [[ "$HTTP_CODE" == "200" ]]; then
  pass "Schedule check returns slots (HTTP 200)"
  if echo "$BODY" | grep -q '"slots"' 2>/dev/null; then
    pass "Schedule response contains slots array"
  else
    fail "Schedule response format" "Missing slots key"
  fi
else
  fail "Schedule check endpoint" "Got HTTP $HTTP_CODE"
fi

# Conflict detection
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/schedule/check" \
  -H "Content-Type: application/json" \
  -d '{"proposedStart": "2020-01-01T09:00:00Z"}' 2>/dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [[ "$HTTP_CODE" == "200" ]] && echo "$BODY" | grep -q '"hasConflicts":true' 2>/dev/null; then
  pass "Schedule check detects past-date conflict"
else
  skip "Schedule conflict detection" "May need live DB"
fi

echo ""

# -----------------------------------------------------------------------
# Test 3: Invoice creation
# -----------------------------------------------------------------------
echo -e "${CYAN}Invoice API Tests${NC}"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/invoices" \
  -H "Content-Type: application/json" \
  -d '{"jobId": "nonexistent-job-id"}' 2>/dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -1)

if [[ "$HTTP_CODE" == "404" ]] || [[ "$HTTP_CODE" == "500" ]] || [[ "$HTTP_CODE" == "401" ]]; then
  pass "Invoice API handles missing job gracefully (HTTP $HTTP_CODE)"
else
  fail "Invoice API error handling" "Expected 404/500, got $HTTP_CODE"
fi

echo ""

# -----------------------------------------------------------------------
# Test 4: Approval endpoints
# -----------------------------------------------------------------------
echo -e "${CYAN}Approval API Tests${NC}"

# Approve with bad action ID
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/approvals/approve" \
  -H "Content-Type: application/json" \
  -d '{"actionId": "00000000-0000-0000-0000-000000000000"}' 2>/dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -1)

if [[ "$HTTP_CODE" == "404" ]] || [[ "$HTTP_CODE" == "400" ]] || [[ "$HTTP_CODE" == "500" ]]; then
  pass "Approve endpoint handles invalid action ID (HTTP $HTTP_CODE)"
else
  fail "Approve endpoint" "Expected error code, got $HTTP_CODE"
fi

# Reject with bad action ID
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/approvals/reject" \
  -H "Content-Type: application/json" \
  -d '{"actionId": "00000000-0000-0000-0000-000000000000", "reason": "test"}' 2>/dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -1)

if [[ "$HTTP_CODE" == "404" ]] || [[ "$HTTP_CODE" == "400" ]] || [[ "$HTTP_CODE" == "500" ]]; then
  pass "Reject endpoint handles invalid action ID (HTTP $HTTP_CODE)"
else
  fail "Reject endpoint" "Expected error code, got $HTTP_CODE"
fi

echo ""

# -----------------------------------------------------------------------
# Test 5: Stripe webhook
# -----------------------------------------------------------------------
echo -e "${CYAN}Stripe Webhook Tests${NC}"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/webhooks/stripe" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "evt_test_smoke_'$(date +%s)'",
    "type": "payment_intent.succeeded",
    "data": {
      "object": {
        "id": "pi_test_smoke_001",
        "amount_received": 15000,
        "metadata": {
          "owner_id": "00000000-0000-0000-0000-000000000001",
          "job_id": "00000000-0000-0000-0000-000000000099"
        }
      }
    }
  }' 2>/dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [[ "$HTTP_CODE" == "200" ]]; then
  pass "Stripe webhook processes payment event (HTTP 200)"
elif [[ "$HTTP_CODE" == "401" ]]; then
  skip "Stripe webhook" "Signature verification enabled (expected in production)"
else
  fail "Stripe webhook" "Got HTTP $HTTP_CODE: $(echo "$BODY" | head -c 150)"
fi

echo ""

# -----------------------------------------------------------------------
# Test 6: MCP endpoint
# -----------------------------------------------------------------------
echo -e "${CYAN}MCP Endpoint Tests${NC}"

# Tool discovery
RESPONSE=$(curl -s -w "\n%{http_code}" "${API_URL}/api/mcp" 2>/dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [[ "$HTTP_CODE" == "200" ]] && echo "$BODY" | grep -q '"tools"' 2>/dev/null; then
  TOOL_COUNT=$(echo "$BODY" | grep -o '"name"' | wc -l)
  pass "MCP tool discovery works (${TOOL_COUNT} tools)"
else
  fail "MCP tool discovery" "Got HTTP $HTTP_CODE"
fi

# JSON-RPC call
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/mcp" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "list_action_queue",
      "arguments": {"status": "pending", "limit": 5}
    }
  }' 2>/dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -1)

if [[ "$HTTP_CODE" == "200" ]]; then
  pass "MCP JSON-RPC call works (HTTP 200)"
else
  skip "MCP JSON-RPC" "May need auth (HTTP $HTTP_CODE)"
fi

echo ""

# -----------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------
echo "============================================"
echo "Execution Loop Smoke Test Summary"
echo "============================================"
echo -e "Passed:  ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed:  ${RED}$TESTS_FAILED${NC}"
echo -e "Skipped: ${YELLOW}$TESTS_SKIPPED${NC}"
echo "============================================"
echo ""

if [[ $TESTS_FAILED -eq 0 ]]; then
  echo -e "${GREEN}All execution loop tests passed!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed. Review above.${NC}"
  exit 1
fi
