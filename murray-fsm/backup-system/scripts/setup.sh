#!/bin/bash
# Murray's FSM - Setup Script
# ============================
# Idempotent one-command setup for the backup system
# Safe to run multiple times - only creates/modifies what's needed
#
# Usage: ./scripts/setup.sh [OPTIONS]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SYSTEM_DIR="$(dirname "$SCRIPT_DIR")"

# Options
QUIET=false
SKIP_DOCTOR=false
CREATE_EXAMPLE_CONFIG=false
LOCAL_BACKUP_DIR=""

# ============================================
# Helper Functions
# ============================================

log_info() {
    [[ "$QUIET" != "true" ]] && echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    [[ "$QUIET" != "true" ]] && echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    [[ "$QUIET" != "true" ]] && echo -e "${CYAN}==> $1${NC}"
}

# ============================================
# Setup Functions
# ============================================

check_prerequisites() {
    log_step "Checking prerequisites..."

    # Check bash version
    local bash_version="${BASH_VERSION%%(*}"
    local major_version="${bash_version%%.*}"

    if [[ "$major_version" -lt 4 ]]; then
        log_error "Bash 4.0+ required (found ${bash_version})"
        exit 1
    fi
    log_success "Bash version: ${bash_version}"

    # Check required commands (tar and gzip are essential)
    local required_cmds=("tar" "gzip")
    local missing=()

    for cmd in "${required_cmds[@]}"; do
        if ! command -v "$cmd" &>/dev/null; then
            missing+=("$cmd")
        fi
    done

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "Missing required commands: ${missing[*]}"
        log_info "Install with: apt-get install ${missing[*]} (Debian/Ubuntu)"
        log_info "         or: brew install ${missing[*]} (macOS)"
        exit 1
    fi
    log_success "Required commands available"

    # Check recommended commands (warn only, system has fallbacks)
    local recommended_cmds=("rsync" "jq" "openssl")
    local missing_recommended=()

    for cmd in "${recommended_cmds[@]}"; do
        if ! command -v "$cmd" &>/dev/null; then
            missing_recommended+=("$cmd")
        fi
    done

    if [[ ${#missing_recommended[@]} -gt 0 ]]; then
        log_warn "Recommended commands not found: ${missing_recommended[*]}"
        log_info "Some features may not work without these"
    else
        log_success "Recommended commands available"
    fi
}

create_directories() {
    log_step "Creating directory structure..."

    local dirs=(
        "$BACKUP_SYSTEM_DIR/config"
        "$BACKUP_SYSTEM_DIR/states"
        "$BACKUP_SYSTEM_DIR/logs"
    )

    for dir in "${dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            log_success "Created: $dir"
        else
            log_info "Exists: $dir"
        fi
    done

    # Create .gitkeep files for empty directories
    for dir in "$BACKUP_SYSTEM_DIR/states" "$BACKUP_SYSTEM_DIR/logs"; do
        if [[ ! -f "$dir/.gitkeep" ]]; then
            touch "$dir/.gitkeep"
        fi
    done
}

make_scripts_executable() {
    log_step "Making scripts executable..."

    local scripts=(
        "$SCRIPT_DIR/backup.sh"
        "$SCRIPT_DIR/restore.sh"
        "$SCRIPT_DIR/fsm-controller.sh"
        "$SCRIPT_DIR/doctor.sh"
        "$SCRIPT_DIR/setup.sh"
        "$SCRIPT_DIR/test-backup-system.sh"
    )

    for script in "${scripts[@]}"; do
        if [[ -f "$script" ]]; then
            if [[ ! -x "$script" ]]; then
                chmod +x "$script"
                log_success "Made executable: $(basename "$script")"
            else
                log_info "Already executable: $(basename "$script")"
            fi
        fi
    done

    # Make library files executable (for sourcing)
    if [[ -d "$BACKUP_SYSTEM_DIR/lib" ]]; then
        for lib in "$BACKUP_SYSTEM_DIR/lib"/*.sh; do
            if [[ -f "$lib" && ! -x "$lib" ]]; then
                chmod +x "$lib"
            fi
        done
        log_success "Library files ready"
    fi
}

setup_configuration() {
    log_step "Setting up configuration..."

    local config_file="$BACKUP_SYSTEM_DIR/config/backup.conf"
    local example_file="$BACKUP_SYSTEM_DIR/config/backup.conf.example"

    # Create example config if it doesn't exist
    if [[ ! -f "$example_file" ]]; then
        create_example_config "$example_file"
        log_success "Created example configuration"
    fi

    # Copy to main config if it doesn't exist
    if [[ ! -f "$config_file" ]]; then
        if [[ "$CREATE_EXAMPLE_CONFIG" == "true" ]]; then
            cp "$example_file" "$config_file"

            # Update backup dir if specified
            if [[ -n "$LOCAL_BACKUP_DIR" ]]; then
                sed -i.bak "s|LOCAL_BACKUP_DIR=.*|LOCAL_BACKUP_DIR=\"$LOCAL_BACKUP_DIR\"|" "$config_file"
                rm -f "${config_file}.bak"
            fi

            log_success "Created configuration from example"
            log_warn "Please edit $config_file with your settings"
        else
            log_warn "No configuration file found"
            log_info "Run with --init to create one, or copy from example:"
            log_info "  cp config/backup.conf.example config/backup.conf"
        fi
    else
        log_info "Configuration already exists: $config_file"
    fi
}

create_example_config() {
    local config_file="$1"
    local default_backup_dir="${LOCAL_BACKUP_DIR:-\$HOME/backups}"

    cat > "$config_file" << 'EXAMPLE_CONFIG'
# Murray's FSM - Backup System Configuration
# ==========================================
# Copy this file to backup.conf and customize for your environment

# ============================================
# Backup Sources
# ============================================

# Directories to backup (space-separated)
BACKUP_DIRS="$HOME/projects $HOME/Documents"

# Individual files to backup (space-separated)
BACKUP_FILES="$HOME/.bashrc $HOME/.gitconfig"

# Patterns to exclude from backup (space-separated)
EXCLUDE_PATTERNS="node_modules .git __pycache__ *.log *.tmp .DS_Store"

# ============================================
# Storage Configuration
# ============================================

# Storage type: local, s3, gcs, azure
STORAGE_TYPE="local"

# Local storage settings
EXAMPLE_CONFIG

    # Add backup dir (handle variable substitution)
    echo "LOCAL_BACKUP_DIR=\"${default_backup_dir}\"" >> "$config_file"

    cat >> "$config_file" << 'EXAMPLE_CONFIG'

# AWS S3 settings (if STORAGE_TYPE="s3")
# S3_BUCKET="my-backup-bucket"
# S3_PREFIX="backups"
# S3_REGION="us-east-1"

# Google Cloud Storage settings (if STORAGE_TYPE="gcs")
# GCS_BUCKET="my-backup-bucket"
# GCS_PREFIX="backups"

# Azure Blob Storage settings (if STORAGE_TYPE="azure")
# AZURE_CONTAINER="backups"
# AZURE_PREFIX="fsm"
# AZURE_STORAGE_ACCOUNT="mystorageaccount"

# ============================================
# Compression
# ============================================

# Compression type: gzip, bzip2, xz, zstd, none
COMPRESSION="gzip"

# ============================================
# Security
# ============================================

# Enable encryption (AES-256-CBC)
ENCRYPTION_ENABLED=false

# Encryption key (use key file for production)
# ENCRYPTION_KEY="your-secret-key"
# ENCRYPTION_KEY_FILE="/path/to/encryption.key"

# Checksum algorithm: sha256, sha512, md5
CHECKSUM_ALGORITHM="sha256"

# ============================================
# Environment Capture
# ============================================

# Capture environment (pip packages, npm packages, system packages)
CAPTURE_ENVIRONMENT=true

# ============================================
# Retention Policy
# ============================================

# Enable automatic backup retention
RETENTION_ENABLED=false

# Retention periods
RETENTION_DAILY=7     # Keep daily backups for N days
RETENTION_WEEKLY=4    # Keep weekly backups for N weeks
RETENTION_MONTHLY=3   # Keep monthly backups for N months

# ============================================
# Service Quiescing
# ============================================

# Enable service quiescing for consistent backups
QUIESCE_SERVICES=false

# Docker container management
QUIESCE_DOCKER=false
DOCKER_CONTAINERS=""  # Space-separated, empty = all running containers

# Systemd service management
QUIESCE_SYSTEMD=false
SYSTEMD_SERVICES=""  # Space-separated service names

# ============================================
# Notifications
# ============================================

# Enable notifications
NOTIFY_ENABLED=true

# Notification channels: log, webhook, slack, discord, email, desktop
NOTIFY_CHANNELS="log"

# Send notifications on success/failure
NOTIFY_ON_SUCCESS=true
NOTIFY_ON_FAILURE=true

# Webhook URL (for generic webhook notifications)
# WEBHOOK_URL="https://example.com/webhook"

# Slack settings
# SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
# SLACK_CHANNEL="#backups"

# Discord settings
# DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."

# Email settings
# EMAIL_TO="admin@example.com"
# EMAIL_FROM="backup@localhost"

# ============================================
# Safety Options
# ============================================

# Create safety backup before restoring
PRE_RESTORE_BACKUP=true

# Storage retry configuration
STORAGE_MAX_RETRIES=3
STORAGE_RETRY_DELAY=2
EXAMPLE_CONFIG

    log_info "Example configuration created: $config_file"
}

create_local_backup_dir() {
    log_step "Setting up local backup directory..."

    local config_file="$BACKUP_SYSTEM_DIR/config/backup.conf"

    if [[ -f "$config_file" ]]; then
        local backup_dir
        backup_dir=$(grep "^LOCAL_BACKUP_DIR=" "$config_file" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'")

        if [[ -n "$backup_dir" ]]; then
            # Expand variables
            backup_dir=$(eval echo "$backup_dir" 2>/dev/null || echo "$backup_dir")

            if [[ ! -d "$backup_dir" ]]; then
                mkdir -p "$backup_dir"
                log_success "Created backup directory: $backup_dir"
            else
                log_info "Backup directory exists: $backup_dir"
            fi
        fi
    elif [[ -n "$LOCAL_BACKUP_DIR" ]]; then
        if [[ ! -d "$LOCAL_BACKUP_DIR" ]]; then
            mkdir -p "$LOCAL_BACKUP_DIR"
            log_success "Created backup directory: $LOCAL_BACKUP_DIR"
        else
            log_info "Backup directory exists: $LOCAL_BACKUP_DIR"
        fi
    fi
}

initialize_fsm_state() {
    log_step "Initializing FSM state..."

    local state_file="$BACKUP_SYSTEM_DIR/states/current_state"

    if [[ ! -f "$state_file" ]]; then
        echo "idle" > "$state_file"
        log_success "FSM initialized to idle state"
    else
        local current_state
        current_state=$(cat "$state_file")
        log_info "FSM already initialized: $current_state"
    fi
}

run_doctor() {
    if [[ "$SKIP_DOCTOR" == "true" ]]; then
        log_info "Skipping doctor check (--no-doctor)"
        return 0
    fi

    log_step "Running system diagnostics..."
    echo ""

    if "$SCRIPT_DIR/doctor.sh"; then
        return 0
    else
        log_warn "Some doctor checks failed - review the output above"
        return 1
    fi
}

print_success_message() {
    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}Setup Complete!${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo ""
    echo "Next steps:"
    echo ""
    echo "1. Configure your backup settings:"
    echo "   ${CYAN}nano $BACKUP_SYSTEM_DIR/config/backup.conf${NC}"
    echo ""
    echo "2. Run a test backup:"
    echo "   ${CYAN}$SCRIPT_DIR/backup.sh --dry-run${NC}"
    echo ""
    echo "3. Run the test suite:"
    echo "   ${CYAN}$SCRIPT_DIR/test-backup-system.sh${NC}"
    echo ""
    echo "4. Create your first backup:"
    echo "   ${CYAN}$SCRIPT_DIR/backup.sh${NC}"
    echo ""
    echo "For AI agent integration, use:"
    echo "   ${CYAN}$SCRIPT_DIR/fsm-controller.sh status${NC}"
    echo ""
}

print_help() {
    echo "Murray's FSM - Setup Script"
    echo ""
    echo "Usage: $(basename "$0") [OPTIONS]"
    echo ""
    echo "Options:"
    echo "    --init              Create configuration from example"
    echo "    --backup-dir DIR    Set local backup directory"
    echo "    --no-doctor         Skip running doctor after setup"
    echo "    --quiet, -q         Minimal output"
    echo "    -h, --help          Show this help"
    echo ""
    echo "Examples:"
    echo "    # Basic setup"
    echo "    ./scripts/setup.sh"
    echo ""
    echo "    # Setup with configuration initialization"
    echo "    ./scripts/setup.sh --init --backup-dir /var/backups/murray"
    echo ""
    echo "    # Quick setup for CI"
    echo "    ./scripts/setup.sh --init --no-doctor --quiet"
    echo ""
    echo "This script is idempotent - safe to run multiple times."
}

# ============================================
# Main
# ============================================

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --init)
                CREATE_EXAMPLE_CONFIG=true
                shift
                ;;
            --backup-dir)
                LOCAL_BACKUP_DIR="$2"
                shift 2
                ;;
            --no-doctor)
                SKIP_DOCTOR=true
                shift
                ;;
            --quiet|-q)
                QUIET=true
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

    [[ "$QUIET" != "true" ]] && echo ""
    [[ "$QUIET" != "true" ]] && echo -e "${CYAN}============================================${NC}"
    [[ "$QUIET" != "true" ]] && echo -e "${CYAN}Murray's FSM - Backup System Setup${NC}"
    [[ "$QUIET" != "true" ]] && echo -e "${CYAN}============================================${NC}"
    [[ "$QUIET" != "true" ]] && echo ""

    # Run setup steps
    check_prerequisites
    create_directories
    make_scripts_executable
    setup_configuration
    create_local_backup_dir
    initialize_fsm_state

    # Run doctor
    run_doctor

    # Print success message
    [[ "$QUIET" != "true" ]] && print_success_message

    exit 0
}

main "$@"
