#!/bin/bash
# Murray's FSM - Top-Level Doctor Script
# =======================================
# System diagnostics and validation for all components
# Usage: ./scripts/fsm-doctor.sh [--mode dev|prod] [OPTIONS]

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
MODE="dev"  # dev or prod
VERBOSE=false
JSON_OUTPUT=false
FIX_MODE=false

# Counters
CHECKS_PASSED=0
CHECKS_WARNED=0
CHECKS_FAILED=0

# Results for JSON output
declare -a JSON_RESULTS=()

# ============================================
# Helper Functions
# ============================================

log_info() {
    [[ "$JSON_OUTPUT" != "true" ]] && echo -e "${BLUE}[INFO]${NC} $1"
}

log_pass() {
    ((CHECKS_PASSED++)) || true
    if [[ "$JSON_OUTPUT" == "true" ]]; then
        JSON_RESULTS+=("{\"check\": \"$1\", \"status\": \"pass\", \"details\": \"$2\"}")
    else
        echo -e "${GREEN}[PASS]${NC} $1"
        [[ "$VERBOSE" == "true" && -n "${2:-}" ]] && echo "       $2"
    fi
}

log_warn() {
    ((CHECKS_WARNED++)) || true
    if [[ "$JSON_OUTPUT" == "true" ]]; then
        JSON_RESULTS+=("{\"check\": \"$1\", \"status\": \"warn\", \"details\": \"$2\"}")
    else
        echo -e "${YELLOW}[WARN]${NC} $1"
        [[ -n "${2:-}" ]] && echo "       $2"
    fi
}

log_fail() {
    ((CHECKS_FAILED++)) || true
    if [[ "$JSON_OUTPUT" == "true" ]]; then
        JSON_RESULTS+=("{\"check\": \"$1\", \"status\": \"fail\", \"details\": \"$2\"}")
    else
        echo -e "${RED}[FAIL]${NC} $1"
        [[ -n "${2:-}" ]] && echo "       $2"
    fi
}

command_exists() {
    command -v "$1" &>/dev/null
}

# ============================================
# Development Tool Checks
# ============================================

check_node() {
    if command_exists node; then
        local version
        version=$(node -v | sed 's/v//')
        local major
        major=$(echo "$version" | cut -d. -f1)
        if [[ "$major" -ge 18 ]]; then
            log_pass "Node.js version" "v$version (>= 18 required)"
        else
            log_warn "Node.js version" "v$version found, v18+ recommended"
        fi
    else
        log_fail "Node.js" "Not installed"
    fi
}

check_pnpm() {
    if command_exists pnpm; then
        local version
        version=$(pnpm -v)
        log_pass "pnpm" "v$version"
    else
        log_fail "pnpm" "Not installed (npm install -g pnpm)"
    fi
}

check_supabase_cli() {
    if command_exists supabase; then
        local version
        version=$(supabase -v 2>/dev/null | head -1 || echo "installed")
        log_pass "Supabase CLI" "$version"
    else
        if [[ "$MODE" == "dev" ]]; then
            log_warn "Supabase CLI" "Not installed (optional for local dev)"
        else
            log_info "Supabase CLI" "Not required for production"
        fi
    fi
}

check_docker() {
    if command_exists docker; then
        if docker info &>/dev/null; then
            log_pass "Docker" "Running"
        else
            log_warn "Docker" "Installed but not running"
        fi
    else
        if [[ "$MODE" == "dev" ]]; then
            log_warn "Docker" "Not installed (required for local Supabase)"
        fi
    fi
}

# ============================================
# Project Structure Checks
# ============================================

check_project_structure() {
    local required_dirs=(
        "apps/mobile"
        "apps/web"
        "supabase"
        "docs"
    )
    local missing=()

    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$PROJECT_ROOT/$dir" ]]; then
            missing+=("$dir")
        fi
    done

    if [[ ${#missing[@]} -eq 0 ]]; then
        log_pass "Project structure" "All required directories present"
    else
        log_fail "Project structure" "Missing: ${missing[*]}"
    fi
}

check_package_json() {
    if [[ -f "$PROJECT_ROOT/package.json" ]]; then
        log_pass "Root package.json" "Present"
    else
        log_fail "Root package.json" "Missing"
    fi

    if [[ -f "$PROJECT_ROOT/apps/mobile/package.json" ]]; then
        log_pass "Mobile package.json" "Present"
    else
        log_fail "Mobile package.json" "Missing"
    fi

    if [[ -f "$PROJECT_ROOT/apps/web/package.json" ]]; then
        log_pass "Web package.json" "Present"
    else
        log_fail "Web package.json" "Missing"
    fi
}

check_node_modules() {
    if [[ -d "$PROJECT_ROOT/node_modules" ]]; then
        log_pass "Dependencies" "node_modules exists"
    else
        log_warn "Dependencies" "Run 'pnpm install' to install dependencies"
    fi
}

# ============================================
# Environment Checks
# ============================================

check_mobile_env() {
    local env_file="$PROJECT_ROOT/apps/mobile/.env"
    local required_vars=(
        "EXPO_PUBLIC_SUPABASE_URL"
        "EXPO_PUBLIC_SUPABASE_ANON_KEY"
        "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY"
    )

    if [[ ! -f "$env_file" ]]; then
        log_warn "Mobile .env" "File not found"
        return
    fi

    local missing=()
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "$env_file" || grep -q "^${var}=your-" "$env_file" || grep -q "^${var}=$" "$env_file"; then
            missing+=("$var")
        fi
    done

    if [[ ${#missing[@]} -eq 0 ]]; then
        log_pass "Mobile .env" "All required variables set"
    else
        log_warn "Mobile .env" "Missing or placeholder: ${missing[*]}"
    fi
}

check_web_env() {
    local env_file="$PROJECT_ROOT/apps/web/.env"
    local required_vars=(
        "NEXT_PUBLIC_SUPABASE_URL"
        "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    )

    if [[ ! -f "$env_file" ]]; then
        log_warn "Web .env" "File not found"
        return
    fi

    local missing=()
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "$env_file" || grep -q "^${var}=your-" "$env_file" || grep -q "^${var}=$" "$env_file"; then
            missing+=("$var")
        fi
    done

    if [[ ${#missing[@]} -eq 0 ]]; then
        log_pass "Web .env" "All required variables set"
    else
        log_warn "Web .env" "Missing or placeholder: ${missing[*]}"
    fi
}

# ============================================
# Supabase Checks
# ============================================

check_supabase_local() {
    if [[ "$MODE" != "dev" ]]; then
        return
    fi

    if ! command_exists supabase; then
        log_info "Skipping local Supabase check (CLI not installed)"
        return
    fi

    cd "$PROJECT_ROOT"

    if supabase status &>/dev/null; then
        log_pass "Supabase local" "Running"

        # Check if schema exists
        if [[ -f "supabase/schema.sql" ]]; then
            log_pass "Supabase schema" "schema.sql present"
        else
            log_warn "Supabase schema" "schema.sql not found"
        fi

        # Check if RLS exists
        if [[ -f "supabase/rls.sql" ]]; then
            log_pass "Supabase RLS" "rls.sql present"
        else
            log_warn "Supabase RLS" "rls.sql not found"
        fi
    else
        log_warn "Supabase local" "Not running (run 'supabase start')"
    fi
}

check_supabase_remote() {
    # Check if we can reach the configured Supabase URL
    local env_file="$PROJECT_ROOT/apps/web/.env"

    if [[ ! -f "$env_file" ]]; then
        log_warn "Supabase connection" "Cannot check - no .env file"
        return
    fi

    local supabase_url
    supabase_url=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" "$env_file" 2>/dev/null | cut -d'=' -f2)

    if [[ -z "$supabase_url" || "$supabase_url" == "your-project.supabase.co" || "$supabase_url" == *"your-"* ]]; then
        log_warn "Supabase connection" "URL not configured"
        return
    fi

    # Try to reach the health endpoint
    if command_exists curl; then
        local health_url="${supabase_url}/rest/v1/"
        if curl -s --connect-timeout 5 "$health_url" &>/dev/null; then
            log_pass "Supabase connection" "Reachable at $supabase_url"
        else
            log_warn "Supabase connection" "Cannot reach $supabase_url"
        fi
    else
        log_info "Supabase connection" "Install curl to test connectivity"
    fi
}

# ============================================
# n8n Checks
# ============================================

check_n8n_workflows() {
    local workflow_dir="$PROJECT_ROOT/docs/n8n"

    if [[ ! -d "$workflow_dir" ]]; then
        log_warn "n8n workflows" "Directory not found"
        return
    fi

    local workflow_count
    workflow_count=$(find "$workflow_dir" -name "*.json" -type f | wc -l)

    if [[ "$workflow_count" -gt 0 ]]; then
        log_pass "n8n workflows" "$workflow_count workflow files found"

        if [[ "$VERBOSE" == "true" ]]; then
            echo "       Workflows:"
            find "$workflow_dir" -name "*.json" -type f -exec basename {} \; | while read -r f; do
                echo "         - $f"
            done
        fi
    else
        log_warn "n8n workflows" "No workflow JSON files found"
    fi
}

check_n8n_webhook_url() {
    local env_file="$PROJECT_ROOT/apps/web/.env"

    if [[ ! -f "$env_file" ]]; then
        return
    fi

    local webhook_url
    webhook_url=$(grep "^N8N_APPROVAL_EXECUTOR_WEBHOOK_URL=" "$env_file" 2>/dev/null | cut -d'=' -f2)

    if [[ -n "$webhook_url" && "$webhook_url" != *"your-n8n"* ]]; then
        log_pass "n8n webhook URL" "Configured"
    else
        log_warn "n8n webhook URL" "Not configured in web .env"
    fi
}

# ============================================
# Edge Functions Checks
# ============================================

check_edge_functions() {
    local functions_dir="$PROJECT_ROOT/supabase/functions"

    if [[ ! -d "$functions_dir" ]]; then
        log_warn "Edge functions" "Directory not found"
        return
    fi

    local expected_functions=("create-payment-intent" "healthcheck")
    local found=()
    local missing=()

    for func in "${expected_functions[@]}"; do
        if [[ -d "$functions_dir/$func" ]]; then
            found+=("$func")
        else
            missing+=("$func")
        fi
    done

    if [[ ${#missing[@]} -eq 0 ]]; then
        log_pass "Edge functions" "All expected functions present: ${found[*]}"
    else
        if [[ ${#found[@]} -gt 0 ]]; then
            log_warn "Edge functions" "Missing: ${missing[*]}"
        else
            log_warn "Edge functions" "No functions found"
        fi
    fi
}

# ============================================
# Documentation Checks
# ============================================

check_documentation() {
    local required_docs=(
        "README.md"
        "docs/quo-setup.md"
        "docs/stripe-setup.md"
        "docs/calendar-setup.md"
        "docs/n8n-workflows.md"
    )
    local missing=()

    for doc in "${required_docs[@]}"; do
        if [[ ! -f "$PROJECT_ROOT/$doc" ]]; then
            missing+=("$doc")
        fi
    done

    if [[ ${#missing[@]} -eq 0 ]]; then
        log_pass "Documentation" "All required docs present"
    else
        log_warn "Documentation" "Missing: ${missing[*]}"
    fi
}

# ============================================
# Backup System Checks
# ============================================

check_backup_system() {
    local backup_dir="$PROJECT_ROOT/backup-system"

    if [[ ! -d "$backup_dir" ]]; then
        log_info "Backup system" "Not present (optional)"
        return
    fi

    # Check if backup system doctor exists and run it
    if [[ -x "$backup_dir/scripts/doctor.sh" ]]; then
        log_pass "Backup system" "Doctor script available"

        if [[ "$VERBOSE" == "true" ]]; then
            echo ""
            echo "       Running backup system diagnostics..."
            "$backup_dir/scripts/doctor.sh" 2>&1 | sed 's/^/       /'
        fi
    else
        log_warn "Backup system" "Doctor script not found or not executable"
    fi
}

# ============================================
# Output Functions
# ============================================

print_summary() {
    if [[ "$JSON_OUTPUT" == "true" ]]; then
        echo "{"
        echo "  \"mode\": \"$MODE\","
        echo "  \"status\": \"$(get_overall_status)\","
        echo "  \"summary\": {"
        echo "    \"passed\": $CHECKS_PASSED,"
        echo "    \"warned\": $CHECKS_WARNED,"
        echo "    \"failed\": $CHECKS_FAILED"
        echo "  },"
        echo "  \"checks\": ["
        local first=true
        for result in "${JSON_RESULTS[@]}"; do
            if [[ "$first" == "true" ]]; then
                first=false
            else
                echo ","
            fi
            echo -n "    $result"
        done
        echo ""
        echo "  ]"
        echo "}"
    else
        echo ""
        echo "============================================"
        echo "Doctor Summary ($MODE mode)"
        echo "============================================"
        echo -e "Passed: ${GREEN}$CHECKS_PASSED${NC}"
        echo -e "Warned: ${YELLOW}$CHECKS_WARNED${NC}"
        echo -e "Failed: ${RED}$CHECKS_FAILED${NC}"
        echo "============================================"
        echo ""

        if [[ $CHECKS_FAILED -eq 0 && $CHECKS_WARNED -eq 0 ]]; then
            echo -e "${GREEN}All checks passed! System is ready.${NC}"
        elif [[ $CHECKS_FAILED -eq 0 ]]; then
            echo -e "${YELLOW}System is functional with warnings.${NC}"
            echo "Review warnings above and address as needed."
        else
            echo -e "${RED}System has issues that need attention.${NC}"
            echo "Fix the failed checks before proceeding."
        fi
    fi
}

get_overall_status() {
    if [[ $CHECKS_FAILED -gt 0 ]]; then
        echo "fail"
    elif [[ $CHECKS_WARNED -gt 0 ]]; then
        echo "warn"
    else
        echo "pass"
    fi
}

print_help() {
    echo "Murray's FSM - Doctor Script"
    echo ""
    echo "Usage: $(basename "$0") [OPTIONS]"
    echo ""
    echo "Options:"
    echo "    --mode MODE     Check mode: dev or prod (default: dev)"
    echo "    --verbose       Show detailed output"
    echo "    --json          Output results as JSON"
    echo "    --fix           Attempt to fix issues (not implemented)"
    echo "    -h, --help      Show this help"
    echo ""
    echo "Checks performed:"
    echo "    - Development tools (node, pnpm, supabase, docker)"
    echo "    - Project structure and dependencies"
    echo "    - Environment configuration (.env files)"
    echo "    - Supabase connectivity (local and remote)"
    echo "    - n8n workflows and webhook configuration"
    echo "    - Edge functions"
    echo "    - Documentation"
    echo "    - Backup system (if present)"
}

# ============================================
# Main
# ============================================

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --mode)
                MODE="$2"
                shift 2
                ;;
            --verbose|-v)
                VERBOSE=true
                shift
                ;;
            --json)
                JSON_OUTPUT=true
                shift
                ;;
            --fix)
                FIX_MODE=true
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

    if [[ "$JSON_OUTPUT" != "true" ]]; then
        echo ""
        echo "============================================"
        echo "Murray's FSM - System Diagnostics ($MODE)"
        echo "============================================"
        echo ""
    fi

    # Run all checks
    [[ "$JSON_OUTPUT" != "true" ]] && echo -e "${CYAN}Development Tools${NC}"
    check_node
    check_pnpm
    check_supabase_cli
    [[ "$MODE" == "dev" ]] && check_docker

    [[ "$JSON_OUTPUT" != "true" ]] && echo "" && echo -e "${CYAN}Project Structure${NC}"
    check_project_structure
    check_package_json
    check_node_modules

    [[ "$JSON_OUTPUT" != "true" ]] && echo "" && echo -e "${CYAN}Environment Configuration${NC}"
    check_mobile_env
    check_web_env

    [[ "$JSON_OUTPUT" != "true" ]] && echo "" && echo -e "${CYAN}Supabase${NC}"
    [[ "$MODE" == "dev" ]] && check_supabase_local
    check_supabase_remote
    check_edge_functions

    [[ "$JSON_OUTPUT" != "true" ]] && echo "" && echo -e "${CYAN}n8n Automation${NC}"
    check_n8n_workflows
    check_n8n_webhook_url

    [[ "$JSON_OUTPUT" != "true" ]] && echo "" && echo -e "${CYAN}Documentation${NC}"
    check_documentation

    [[ "$JSON_OUTPUT" != "true" ]] && echo "" && echo -e "${CYAN}Backup System${NC}"
    check_backup_system

    # Print summary
    print_summary

    # Return appropriate exit code
    if [[ $CHECKS_FAILED -gt 0 ]]; then
        exit 1
    else
        exit 0
    fi
}

main "$@"
