#!/bin/bash
# Murray's FSM - Smoke Test Script
# =================================
# End-to-end validation of system components
# Usage: ./scripts/smoke.sh [OPTIONS]

set -uo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Options
VERBOSE=false
MOCK_MODE=false
SKIP_DB=false
SKIP_WEBHOOKS=false

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# ============================================
# Helper Functions
# ============================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_test() {
    echo -e "${CYAN}[TEST]${NC} $1"
}

log_pass() {
    ((TESTS_PASSED++)) || true
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_fail() {
    ((TESTS_FAILED++)) || true
    echo -e "${RED}[FAIL]${NC} $1"
    [[ -n "${2:-}" ]] && echo "       $2"
}

log_skip() {
    ((TESTS_SKIPPED++)) || true
    echo -e "${YELLOW}[SKIP]${NC} $1"
    [[ -n "${2:-}" ]] && echo "       $2"
}

command_exists() {
    command -v "$1" &>/dev/null
}

# Load environment from .env file
load_env() {
    local env_file="$1"
    if [[ -f "$env_file" ]]; then
        # Export variables, ignoring comments and empty lines
        set -a
        # shellcheck source=/dev/null
        source <(grep -v '^\s*#' "$env_file" | grep -v '^\s*$')
        set +a
        return 0
    fi
    return 1
}

# ============================================
# Database Tests
# ============================================

test_supabase_connection() {
    log_test "Testing Supabase connection..."

    if [[ "$SKIP_DB" == "true" ]]; then
        log_skip "Supabase connection" "Database tests disabled"
        return 0
    fi

    # Load web env for Supabase URL
    load_env "$PROJECT_ROOT/apps/web/.env" 2>/dev/null || true

    local supabase_url="${NEXT_PUBLIC_SUPABASE_URL:-}"

    if [[ -z "$supabase_url" || "$supabase_url" == *"your-"* ]]; then
        log_skip "Supabase connection" "URL not configured"
        return 0
    fi

    if ! command_exists curl; then
        log_skip "Supabase connection" "curl not installed"
        return 0
    fi

    # Test REST API endpoint
    local response
    response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "${supabase_url}/rest/v1/" 2>/dev/null)

    if [[ "$response" == "200" || "$response" == "401" ]]; then
        log_pass "Supabase REST API reachable (HTTP $response)"
    else
        log_fail "Supabase REST API" "Got HTTP $response"
    fi
}

test_supabase_tables() {
    log_test "Testing Supabase tables exist..."

    if [[ "$SKIP_DB" == "true" ]]; then
        log_skip "Supabase tables" "Database tests disabled"
        return 0
    fi

    load_env "$PROJECT_ROOT/apps/web/.env" 2>/dev/null || true

    local supabase_url="${NEXT_PUBLIC_SUPABASE_URL:-}"
    local supabase_key="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}"

    if [[ -z "$supabase_url" || -z "$supabase_key" || "$supabase_url" == *"your-"* ]]; then
        log_skip "Supabase tables" "Credentials not configured"
        return 0
    fi

    if ! command_exists curl; then
        log_skip "Supabase tables" "curl not installed"
        return 0
    fi

    # Core tables to check
    local tables=("profiles" "customers" "jobs" "action_queue")
    local all_exist=true

    for table in "${tables[@]}"; do
        local response
        response=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "apikey: $supabase_key" \
            -H "Authorization: Bearer $supabase_key" \
            --connect-timeout 5 \
            "${supabase_url}/rest/v1/${table}?limit=0" 2>/dev/null)

        if [[ "$response" != "200" && "$response" != "401" ]]; then
            all_exist=false
            [[ "$VERBOSE" == "true" ]] && echo "       Table '$table' not accessible (HTTP $response)"
        fi
    done

    if [[ "$all_exist" == "true" ]]; then
        log_pass "Core database tables accessible"
    else
        log_fail "Some database tables not accessible" "Run 'supabase db push' to apply schema"
    fi
}

test_supabase_storage() {
    log_test "Testing Supabase storage buckets..."

    if [[ "$SKIP_DB" == "true" ]]; then
        log_skip "Supabase storage" "Database tests disabled"
        return 0
    fi

    load_env "$PROJECT_ROOT/apps/web/.env" 2>/dev/null || true

    local supabase_url="${NEXT_PUBLIC_SUPABASE_URL:-}"
    local supabase_key="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}"

    if [[ -z "$supabase_url" || -z "$supabase_key" || "$supabase_url" == *"your-"* ]]; then
        log_skip "Supabase storage" "Credentials not configured"
        return 0
    fi

    if ! command_exists curl; then
        log_skip "Supabase storage" "curl not installed"
        return 0
    fi

    # Check storage API
    local response
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "apikey: $supabase_key" \
        -H "Authorization: Bearer $supabase_key" \
        --connect-timeout 5 \
        "${supabase_url}/storage/v1/bucket" 2>/dev/null)

    if [[ "$response" == "200" || "$response" == "401" ]]; then
        log_pass "Supabase storage API reachable"
    else
        log_fail "Supabase storage API" "Got HTTP $response"
    fi
}

# ============================================
# Edge Function Tests
# ============================================

test_edge_function_healthcheck() {
    log_test "Testing healthcheck edge function..."

    load_env "$PROJECT_ROOT/apps/web/.env" 2>/dev/null || true

    local supabase_url="${NEXT_PUBLIC_SUPABASE_URL:-}"
    local supabase_key="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}"

    if [[ -z "$supabase_url" || -z "$supabase_key" || "$supabase_url" == *"your-"* ]]; then
        log_skip "Healthcheck edge function" "Credentials not configured"
        return 0
    fi

    if ! command_exists curl; then
        log_skip "Healthcheck edge function" "curl not installed"
        return 0
    fi

    local response
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $supabase_key" \
        --connect-timeout 10 \
        "${supabase_url}/functions/v1/healthcheck" 2>/dev/null)

    case "$response" in
        200)
            log_pass "Healthcheck edge function working"
            ;;
        404)
            log_skip "Healthcheck edge function" "Not deployed (run 'supabase functions deploy')"
            ;;
        *)
            log_fail "Healthcheck edge function" "Got HTTP $response"
            ;;
    esac
}

# ============================================
# Webhook Tests
# ============================================

test_n8n_webhook() {
    log_test "Testing n8n webhook endpoint..."

    if [[ "$SKIP_WEBHOOKS" == "true" ]]; then
        log_skip "n8n webhook" "Webhook tests disabled"
        return 0
    fi

    load_env "$PROJECT_ROOT/apps/web/.env" 2>/dev/null || true

    local webhook_url="${N8N_APPROVAL_EXECUTOR_WEBHOOK_URL:-}"

    if [[ -z "$webhook_url" || "$webhook_url" == *"your-n8n"* ]]; then
        log_skip "n8n webhook" "URL not configured"
        return 0
    fi

    if ! command_exists curl; then
        log_skip "n8n webhook" "curl not installed"
        return 0
    fi

    # Try OPTIONS or HEAD to avoid triggering actual webhook logic
    local response
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -X OPTIONS \
        --connect-timeout 10 \
        "$webhook_url" 2>/dev/null)

    # n8n returns various codes, but reachability is the main check
    if [[ "$response" != "000" ]]; then
        log_pass "n8n webhook endpoint reachable (HTTP $response)"
    else
        log_fail "n8n webhook endpoint" "Connection failed"
    fi
}

# ============================================
# Approval Gate Test
# ============================================

test_approval_gate_invariant() {
    log_test "Testing approval gate invariant..."

    if [[ "$SKIP_DB" == "true" ]]; then
        log_skip "Approval gate invariant" "Database tests disabled"
        return 0
    fi

    load_env "$PROJECT_ROOT/apps/web/.env" 2>/dev/null || true

    local supabase_url="${NEXT_PUBLIC_SUPABASE_URL:-}"
    local supabase_key="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}"

    if [[ -z "$supabase_url" || -z "$supabase_key" || "$supabase_url" == *"your-"* ]]; then
        log_skip "Approval gate invariant" "Credentials not configured"
        return 0
    fi

    if ! command_exists curl; then
        log_skip "Approval gate invariant" "curl not installed"
        return 0
    fi

    # Check action_queue table exists
    local response
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "apikey: $supabase_key" \
        -H "Authorization: Bearer $supabase_key" \
        --connect-timeout 5 \
        "${supabase_url}/rest/v1/action_queue?limit=0" 2>/dev/null)

    if [[ "$response" == "200" || "$response" == "401" ]]; then
        log_pass "Approval gate table (action_queue) exists"

        # Note: A more complete test would:
        # 1. Insert a pending action
        # 2. Verify NO calendar event is created
        # 3. Approve the action
        # 4. Verify calendar event IS created
        # This requires authenticated access and is better done in integration tests
        [[ "$VERBOSE" == "true" ]] && echo "       Full invariant test requires integration testing"
    else
        log_fail "Approval gate table" "action_queue not accessible"
    fi
}

# ============================================
# Local Development Tests
# ============================================

test_local_supabase() {
    log_test "Testing local Supabase (if running)..."

    if ! command_exists supabase; then
        log_skip "Local Supabase" "CLI not installed"
        return 0
    fi

    cd "$PROJECT_ROOT"

    if supabase status &>/dev/null; then
        log_pass "Local Supabase is running"

        # Get local URL
        local local_url
        local_url=$(supabase status 2>/dev/null | grep "API URL" | awk '{print $3}')
        [[ -n "$local_url" && "$VERBOSE" == "true" ]] && echo "       URL: $local_url"
    else
        log_skip "Local Supabase" "Not running (run 'supabase start')"
    fi
}

# ============================================
# File System Tests
# ============================================

test_n8n_workflows_syntax() {
    log_test "Testing n8n workflow JSON syntax..."

    local workflow_dir="$PROJECT_ROOT/docs/n8n"

    if [[ ! -d "$workflow_dir" ]]; then
        log_skip "n8n workflows syntax" "Directory not found"
        return 0
    fi

    if ! command_exists jq; then
        log_skip "n8n workflows syntax" "jq not installed"
        return 0
    fi

    local all_valid=true
    local invalid_files=()

    while IFS= read -r -d '' file; do
        if ! jq empty "$file" 2>/dev/null; then
            all_valid=false
            invalid_files+=("$(basename "$file")")
        fi
    done < <(find "$workflow_dir" -name "*.json" -type f -print0)

    if [[ "$all_valid" == "true" ]]; then
        log_pass "All n8n workflow JSON files are valid"
    else
        log_fail "Invalid JSON in workflows" "${invalid_files[*]}"
    fi
}

test_package_json_syntax() {
    log_test "Testing package.json syntax..."

    if ! command_exists jq; then
        log_skip "package.json syntax" "jq not installed"
        return 0
    fi

    local files=(
        "$PROJECT_ROOT/package.json"
        "$PROJECT_ROOT/apps/mobile/package.json"
        "$PROJECT_ROOT/apps/web/package.json"
    )
    local all_valid=true
    local invalid_files=()

    for file in "${files[@]}"; do
        if [[ -f "$file" ]]; then
            if ! jq empty "$file" 2>/dev/null; then
                all_valid=false
                invalid_files+=("$(basename "$(dirname "$file")")/package.json")
            fi
        fi
    done

    if [[ "$all_valid" == "true" ]]; then
        log_pass "All package.json files are valid"
    else
        log_fail "Invalid package.json" "${invalid_files[*]}"
    fi
}

# ============================================
# Output
# ============================================

print_summary() {
    echo ""
    echo "============================================"
    echo "Smoke Test Summary"
    echo "============================================"
    echo -e "Passed:  ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Failed:  ${RED}$TESTS_FAILED${NC}"
    echo -e "Skipped: ${YELLOW}$TESTS_SKIPPED${NC}"
    echo "============================================"
    echo ""

    if [[ $TESTS_FAILED -eq 0 ]]; then
        if [[ $TESTS_SKIPPED -gt 0 ]]; then
            echo -e "${YELLOW}Smoke tests passed with skipped tests.${NC}"
            echo "Configure environment and run again for full coverage."
        else
            echo -e "${GREEN}All smoke tests passed!${NC}"
        fi
    else
        echo -e "${RED}Some smoke tests failed.${NC}"
        echo "Review failures above and fix before proceeding."
    fi
}

print_help() {
    echo "Murray's FSM - Smoke Test Script"
    echo ""
    echo "Usage: $(basename "$0") [OPTIONS]"
    echo ""
    echo "Options:"
    echo "    --verbose       Show detailed output"
    echo "    --mock          Run in mock mode (no external calls)"
    echo "    --skip-db       Skip database tests"
    echo "    --skip-webhooks Skip webhook tests"
    echo "    -h, --help      Show this help"
    echo ""
    echo "Tests performed:"
    echo "    - Supabase connection and tables"
    echo "    - Supabase storage buckets"
    echo "    - Edge function health"
    echo "    - n8n webhook reachability"
    echo "    - Approval gate invariant"
    echo "    - Local Supabase (if running)"
    echo "    - JSON file syntax"
}

# ============================================
# Main
# ============================================

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --verbose|-v)
                VERBOSE=true
                shift
                ;;
            --mock)
                MOCK_MODE=true
                SKIP_DB=true
                SKIP_WEBHOOKS=true
                shift
                ;;
            --skip-db)
                SKIP_DB=true
                shift
                ;;
            --skip-webhooks)
                SKIP_WEBHOOKS=true
                shift
                ;;
            -h|--help)
                print_help
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                print_help
                exit 1
                ;;
        esac
    done

    echo ""
    echo "============================================"
    echo "Murray's FSM - Smoke Tests"
    echo "============================================"
    echo ""

    # Run tests
    echo -e "${CYAN}Database Tests${NC}"
    test_supabase_connection
    test_supabase_tables
    test_supabase_storage

    echo ""
    echo -e "${CYAN}Edge Function Tests${NC}"
    test_edge_function_healthcheck

    echo ""
    echo -e "${CYAN}Webhook Tests${NC}"
    test_n8n_webhook

    echo ""
    echo -e "${CYAN}Business Logic Tests${NC}"
    test_approval_gate_invariant

    echo ""
    echo -e "${CYAN}Local Development Tests${NC}"
    test_local_supabase

    echo ""
    echo -e "${CYAN}Syntax Tests${NC}"
    test_n8n_workflows_syntax
    test_package_json_syntax

    # Print summary
    print_summary

    # Return appropriate exit code
    if [[ $TESTS_FAILED -gt 0 ]]; then
        exit 1
    else
        exit 0
    fi
}

main "$@"
