#!/bin/bash
# Murray's FSM - Top-Level Setup Script
# ======================================
# One-command setup for development and production environments
# Usage: ./scripts/fsm-setup.sh [--dev|--prod] [OPTIONS]

set -euo pipefail

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
MODE=""  # dev or prod
SKIP_INSTALL=false
SKIP_SUPABASE=false
SKIP_DOCTOR=false
VERBOSE=false

# ============================================
# Helper Functions
# ============================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${CYAN}==> $1${NC}"
}

command_exists() {
    command -v "$1" &>/dev/null
}

# ============================================
# Prerequisite Checks
# ============================================

check_prerequisites() {
    log_step "Checking prerequisites..."
    local missing=()

    # Node.js
    if command_exists node; then
        local node_version
        node_version=$(node -v | sed 's/v//' | cut -d. -f1)
        if [[ "$node_version" -ge 18 ]]; then
            log_success "Node.js $(node -v)"
        else
            log_warn "Node.js $(node -v) - version 18+ recommended"
        fi
    else
        missing+=("node")
    fi

    # pnpm
    if command_exists pnpm; then
        log_success "pnpm $(pnpm -v)"
    else
        missing+=("pnpm")
    fi

    # Supabase CLI (optional but recommended)
    if command_exists supabase; then
        log_success "Supabase CLI $(supabase -v 2>/dev/null | head -1 || echo 'installed')"
    else
        log_warn "Supabase CLI not found - install for local development"
    fi

    # Git
    if command_exists git; then
        log_success "Git $(git --version | cut -d' ' -f3)"
    else
        missing+=("git")
    fi

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "Missing required tools: ${missing[*]}"
        echo ""
        echo "Install with:"
        for tool in "${missing[@]}"; do
            case "$tool" in
                node)
                    echo "  Node.js: https://nodejs.org/ or 'nvm install 18'"
                    ;;
                pnpm)
                    echo "  pnpm: npm install -g pnpm"
                    ;;
                git)
                    echo "  Git: https://git-scm.com/"
                    ;;
            esac
        done
        return 1
    fi

    log_success "All prerequisites met"
    return 0
}

# ============================================
# Environment Setup
# ============================================

setup_env_files() {
    log_step "Setting up environment files..."

    # Mobile app .env
    local mobile_env="$PROJECT_ROOT/apps/mobile/.env"
    local mobile_env_example="$PROJECT_ROOT/apps/mobile/.env.example"

    if [[ ! -f "$mobile_env" ]]; then
        if [[ -f "$mobile_env_example" ]]; then
            cp "$mobile_env_example" "$mobile_env"
            log_success "Created apps/mobile/.env from example"
        else
            create_mobile_env_example "$mobile_env_example"
            cp "$mobile_env_example" "$mobile_env"
            log_success "Created apps/mobile/.env.example and .env"
        fi
        log_warn "Edit apps/mobile/.env with your values"
    else
        log_info "apps/mobile/.env already exists"
    fi

    # Web app .env
    local web_env="$PROJECT_ROOT/apps/web/.env"
    local web_env_example="$PROJECT_ROOT/apps/web/.env.example"

    if [[ ! -f "$web_env" ]]; then
        if [[ -f "$web_env_example" ]]; then
            cp "$web_env_example" "$web_env"
            log_success "Created apps/web/.env from example"
        else
            create_web_env_example "$web_env_example"
            cp "$web_env_example" "$web_env"
            log_success "Created apps/web/.env.example and .env"
        fi
        log_warn "Edit apps/web/.env with your values"
    else
        log_info "apps/web/.env already exists"
    fi
}

create_mobile_env_example() {
    local file="$1"
    cat > "$file" << 'EOF'
# Murray's FSM Mobile App Environment
# ====================================

# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Stripe Configuration
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# Optional: Enable debug mode
# EXPO_PUBLIC_DEBUG=true
EOF
}

create_web_env_example() {
    local file="$1"
    cat > "$file" << 'EOF'
# Murray's FSM Web Dashboard Environment
# =======================================

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Site URL (for callbacks)
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# n8n Webhook URLs
N8N_APPROVAL_EXECUTOR_WEBHOOK_URL=https://your-n8n.com/webhook/approval-executor

# Optional: Server-side Supabase (for API routes)
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
EOF
}

# ============================================
# Dependencies Installation
# ============================================

install_dependencies() {
    if [[ "$SKIP_INSTALL" == "true" ]]; then
        log_info "Skipping dependency installation (--skip-install)"
        return 0
    fi

    log_step "Installing dependencies..."

    cd "$PROJECT_ROOT"

    if [[ -f "pnpm-lock.yaml" ]]; then
        pnpm install --frozen-lockfile 2>/dev/null || pnpm install
    else
        pnpm install
    fi

    log_success "Dependencies installed"
}

# ============================================
# Supabase Setup
# ============================================

setup_supabase_local() {
    if [[ "$SKIP_SUPABASE" == "true" ]]; then
        log_info "Skipping Supabase setup (--skip-supabase)"
        return 0
    fi

    log_step "Setting up local Supabase..."

    if ! command_exists supabase; then
        log_warn "Supabase CLI not found - skipping local setup"
        echo "Install with: brew install supabase/tap/supabase"
        echo "Or: npx supabase"
        return 0
    fi

    cd "$PROJECT_ROOT"

    # Check if Supabase is already running
    if supabase status &>/dev/null; then
        log_info "Supabase is already running"
    else
        log_info "Starting Supabase local development..."
        supabase start || {
            log_warn "Could not start Supabase (Docker may not be running)"
            return 0
        }
    fi

    # Apply migrations/schema
    if [[ -f "supabase/schema.sql" ]]; then
        log_info "Pushing database schema..."
        supabase db push || log_warn "Schema push failed - you may need to do this manually"
    fi

    # Seed data (if available and in dev mode)
    if [[ "$MODE" == "dev" && -f "supabase/seed.sql" ]]; then
        log_info "Seeding development data..."
        supabase db reset --no-confirm 2>/dev/null || log_info "Seed data applied"
    fi

    log_success "Supabase local development ready"

    # Print connection info
    echo ""
    log_info "Supabase URLs (for .env files):"
    supabase status 2>/dev/null | grep -E "(API URL|anon key|service_role)" || true
}

# ============================================
# Development Mode
# ============================================

setup_dev() {
    log_step "Setting up development environment..."

    check_prerequisites || exit 1
    setup_env_files
    install_dependencies
    setup_supabase_local

    # Run doctor if not skipped
    if [[ "$SKIP_DOCTOR" != "true" && -f "$SCRIPT_DIR/doctor.sh" ]]; then
        echo ""
        log_step "Running system diagnostics..."
        "$SCRIPT_DIR/doctor.sh" --mode dev || log_warn "Some checks failed - see above"
    fi

    print_dev_next_steps
}

print_dev_next_steps() {
    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}Development Setup Complete!${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo ""
    echo "Next steps:"
    echo ""
    echo "1. Configure environment files:"
    echo "   ${CYAN}nano apps/mobile/.env${NC}"
    echo "   ${CYAN}nano apps/web/.env${NC}"
    echo ""
    echo "2. Start the mobile app:"
    echo "   ${CYAN}pnpm dev:mobile${NC}"
    echo ""
    echo "3. Start the web dashboard:"
    echo "   ${CYAN}pnpm dev:web${NC}"
    echo ""
    echo "4. Run smoke tests:"
    echo "   ${CYAN}./scripts/fsm-smoke.sh${NC}"
    echo ""
    echo "For full setup including n8n, Stripe, and Quo:"
    echo "   See README.md or run: ${CYAN}./scripts/fsm-doctor.sh --verbose${NC}"
    echo ""
}

# ============================================
# Production Mode
# ============================================

setup_prod() {
    log_step "Validating production configuration..."

    check_prerequisites || exit 1

    # In prod mode, we validate but don't modify
    echo ""
    log_info "Production setup validates configuration only."
    log_info "No destructive operations will be performed."
    echo ""

    # Run doctor in prod mode
    if [[ -f "$SCRIPT_DIR/doctor.sh" ]]; then
        "$SCRIPT_DIR/doctor.sh" --mode prod --verbose || {
            log_error "Production validation failed"
            exit 1
        }
    fi

    print_prod_checklist
}

print_prod_checklist() {
    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}Production Checklist${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo ""
    echo "Required Services:"
    echo "  [ ] Supabase project created and configured"
    echo "  [ ] Storage buckets: job-photos, job-signatures"
    echo "  [ ] Edge functions deployed: create-payment-intent, healthcheck"
    echo "  [ ] RLS policies applied"
    echo ""
    echo "Required Integrations:"
    echo "  [ ] n8n instance running with all workflows imported"
    echo "  [ ] Quo/OpenPhone webhook configured"
    echo "  [ ] Stripe webhook configured"
    echo "  [ ] Calendar API credentials set"
    echo ""
    echo "Required Secrets:"
    echo "  [ ] SUPABASE_URL and keys"
    echo "  [ ] STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET"
    echo "  [ ] QUO_API_KEY and QUO_WEBHOOK_SIGNING_SECRET"
    echo "  [ ] N8N_WEBHOOK_URLs"
    echo ""
    echo "Deployment:"
    echo "  [ ] Mobile app built and submitted to stores"
    echo "  [ ] Web dashboard deployed to Vercel/hosting"
    echo "  [ ] DNS configured"
    echo ""
    echo "See LAUNCH.md for complete checklist"
    echo ""
}

# ============================================
# Main
# ============================================

print_help() {
    echo "Murray's FSM - Setup Script"
    echo ""
    echo "Usage: $(basename "$0") [MODE] [OPTIONS]"
    echo ""
    echo "Modes:"
    echo "    --dev           Development setup (default)"
    echo "    --prod          Production validation"
    echo ""
    echo "Options:"
    echo "    --skip-install  Skip pnpm install"
    echo "    --skip-supabase Skip Supabase local setup"
    echo "    --skip-doctor   Skip running doctor after setup"
    echo "    --verbose       Verbose output"
    echo "    -h, --help      Show this help"
    echo ""
    echo "Examples:"
    echo "    ./scripts/fsm-setup.sh --dev                    # Full dev setup"
    echo "    ./scripts/fsm-setup.sh --dev --skip-supabase    # Dev without Supabase"
    echo "    ./scripts/fsm-setup.sh --prod                   # Validate production"
}

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dev)
                MODE="dev"
                shift
                ;;
            --prod)
                MODE="prod"
                shift
                ;;
            --skip-install)
                SKIP_INSTALL=true
                shift
                ;;
            --skip-supabase)
                SKIP_SUPABASE=true
                shift
                ;;
            --skip-doctor)
                SKIP_DOCTOR=true
                shift
                ;;
            --verbose|-v)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                print_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                print_help
                exit 1
                ;;
        esac
    done

    # Default to dev mode
    MODE="${MODE:-dev}"

    echo ""
    echo -e "${CYAN}============================================${NC}"
    echo -e "${CYAN}Murray's FSM - Setup (${MODE} mode)${NC}"
    echo -e "${CYAN}============================================${NC}"
    echo ""

    case "$MODE" in
        dev)
            setup_dev
            ;;
        prod)
            setup_prod
            ;;
    esac
}

main "$@"
