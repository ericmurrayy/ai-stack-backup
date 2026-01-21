#!/bin/bash
# Murray's FSM - Doctor Command
# =============================
# Diagnostic tool to check system readiness and troubleshoot issues
# Usage: ./scripts/doctor.sh [--fix] [--verbose]

set -uo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SYSTEM_DIR="$(dirname "$SCRIPT_DIR")"

# Options
FIX_MODE=false
VERBOSE=false
JSON_OUTPUT=false

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
    if [[ "$JSON_OUTPUT" != "true" ]]; then
        echo -e "${BLUE}[INFO]${NC} $1"
    fi
}

log_pass() {
    ((CHECKS_PASSED++)) || true
    if [[ "$JSON_OUTPUT" == "true" ]]; then
        JSON_RESULTS+=("{\"check\": \"$1\", \"status\": \"pass\", \"details\": \"$2\"}")
    else
        echo -e "${GREEN}[PASS]${NC} $1"
        [[ "$VERBOSE" == "true" && -n "$2" ]] && echo "       $2"
    fi
}

log_warn() {
    ((CHECKS_WARNED++)) || true
    if [[ "$JSON_OUTPUT" == "true" ]]; then
        JSON_RESULTS+=("{\"check\": \"$1\", \"status\": \"warn\", \"details\": \"$2\"}")
    else
        echo -e "${YELLOW}[WARN]${NC} $1"
        [[ -n "$2" ]] && echo "       $2"
    fi
}

log_fail() {
    ((CHECKS_FAILED++)) || true
    if [[ "$JSON_OUTPUT" == "true" ]]; then
        JSON_RESULTS+=("{\"check\": \"$1\", \"status\": \"fail\", \"details\": \"$2\"}")
    else
        echo -e "${RED}[FAIL]${NC} $1"
        [[ -n "$2" ]] && echo "       $2"
    fi
}

# ============================================
# Check Functions
# ============================================

check_bash_version() {
    local bash_version="${BASH_VERSION%%(*}"
    local major_version="${bash_version%%.*}"

    if [[ "$major_version" -ge 4 ]]; then
        log_pass "Bash version" "v${bash_version} (>= 4.0 required)"
    else
        log_fail "Bash version" "v${bash_version} found, v4.0+ required"
    fi
}

check_required_commands() {
    # Core commands that are essential (tar, gzip for compression; others for file ops)
    local required_cmds=("tar" "gzip" "date" "mkdir" "rm" "cp" "mv")
    local missing=()

    for cmd in "${required_cmds[@]}"; do
        if ! command -v "$cmd" &>/dev/null; then
            missing+=("$cmd")
        fi
    done

    if [[ ${#missing[@]} -eq 0 ]]; then
        log_pass "Required commands" "All required commands available"
    else
        log_fail "Required commands" "Missing: ${missing[*]}"
    fi
}

check_recommended_commands() {
    # rsync is recommended but cp is used as fallback
    local recommended_cmds=("rsync" "jq" "openssl")
    local missing=()

    for cmd in "${recommended_cmds[@]}"; do
        if ! command -v "$cmd" &>/dev/null; then
            missing+=("$cmd")
        fi
    done

    if [[ ${#missing[@]} -eq 0 ]]; then
        log_pass "Recommended commands" "rsync, jq, openssl available"
    else
        log_warn "Recommended commands" "Missing: ${missing[*]} (using fallbacks where available)"
    fi
}

check_cloud_cli() {
    local cloud_cmds=()

    command -v aws &>/dev/null && cloud_cmds+=("aws")
    command -v gsutil &>/dev/null && cloud_cmds+=("gsutil")
    command -v az &>/dev/null && cloud_cmds+=("az")

    if [[ ${#cloud_cmds[@]} -gt 0 ]]; then
        log_pass "Cloud CLI tools" "${cloud_cmds[*]} available"
    else
        log_warn "Cloud CLI tools" "No cloud CLI found (aws, gsutil, az). Only local storage available."
    fi
}

check_directory_structure() {
    local required_dirs=(
        "$BACKUP_SYSTEM_DIR/config"
        "$BACKUP_SYSTEM_DIR/lib"
        "$BACKUP_SYSTEM_DIR/scripts"
        "$BACKUP_SYSTEM_DIR/states"
        "$BACKUP_SYSTEM_DIR/logs"
    )
    local missing=()

    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            missing+=("$(basename "$dir")")
        fi
    done

    if [[ ${#missing[@]} -eq 0 ]]; then
        log_pass "Directory structure" "All required directories present"
    else
        log_fail "Directory structure" "Missing directories: ${missing[*]}"

        if [[ "$FIX_MODE" == "true" ]]; then
            log_info "Creating missing directories..."
            for dir in "${required_dirs[@]}"; do
                mkdir -p "$dir"
            done
            log_info "Directories created"
        fi
    fi
}

check_library_files() {
    local required_libs=(
        "$BACKUP_SYSTEM_DIR/lib/common.sh"
        "$BACKUP_SYSTEM_DIR/lib/fsm.sh"
        "$BACKUP_SYSTEM_DIR/lib/storage.sh"
        "$BACKUP_SYSTEM_DIR/lib/lock.sh"
        "$BACKUP_SYSTEM_DIR/lib/services.sh"
        "$BACKUP_SYSTEM_DIR/lib/notify.sh"
    )
    local missing=()

    for lib in "${required_libs[@]}"; do
        if [[ ! -f "$lib" ]]; then
            missing+=("$(basename "$lib")")
        fi
    done

    if [[ ${#missing[@]} -eq 0 ]]; then
        log_pass "Library files" "All library files present"
    else
        log_fail "Library files" "Missing: ${missing[*]}"
    fi
}

check_script_files() {
    local required_scripts=(
        "$BACKUP_SYSTEM_DIR/scripts/backup.sh"
        "$BACKUP_SYSTEM_DIR/scripts/restore.sh"
        "$BACKUP_SYSTEM_DIR/scripts/fsm-controller.sh"
    )
    local missing=()
    local not_executable=()

    for script in "${required_scripts[@]}"; do
        if [[ ! -f "$script" ]]; then
            missing+=("$(basename "$script")")
        elif [[ ! -x "$script" ]]; then
            not_executable+=("$(basename "$script")")
        fi
    done

    if [[ ${#missing[@]} -eq 0 && ${#not_executable[@]} -eq 0 ]]; then
        log_pass "Script files" "All scripts present and executable"
    elif [[ ${#missing[@]} -gt 0 ]]; then
        log_fail "Script files" "Missing: ${missing[*]}"
    else
        log_warn "Script files" "Not executable: ${not_executable[*]}"

        if [[ "$FIX_MODE" == "true" ]]; then
            log_info "Making scripts executable..."
            chmod +x "$BACKUP_SYSTEM_DIR/scripts/"*.sh
            log_info "Scripts are now executable"
        fi
    fi
}

check_config_file() {
    local config_file="$BACKUP_SYSTEM_DIR/config/backup.conf"

    if [[ -f "$config_file" ]]; then
        # Check if config is readable and has content
        if [[ -r "$config_file" && -s "$config_file" ]]; then
            log_pass "Configuration file" "backup.conf exists and is readable"
        else
            log_warn "Configuration file" "backup.conf exists but is empty or unreadable"
        fi
    else
        log_warn "Configuration file" "backup.conf not found (copy from backup.conf.example)"

        if [[ "$FIX_MODE" == "true" ]]; then
            local example_config="$BACKUP_SYSTEM_DIR/config/backup.conf.example"
            if [[ -f "$example_config" ]]; then
                log_info "Copying example configuration..."
                cp "$example_config" "$config_file"
                log_info "Configuration created - please edit backup.conf"
            fi
        fi
    fi
}

check_write_permissions() {
    local test_dirs=(
        "$BACKUP_SYSTEM_DIR/states"
        "$BACKUP_SYSTEM_DIR/logs"
        "/tmp"
    )
    local no_write=()

    for dir in "${test_dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            local test_file="$dir/.write_test_$$"
            if touch "$test_file" 2>/dev/null; then
                rm -f "$test_file"
            else
                no_write+=("$dir")
            fi
        fi
    done

    if [[ ${#no_write[@]} -eq 0 ]]; then
        log_pass "Write permissions" "Can write to required directories"
    else
        log_fail "Write permissions" "Cannot write to: ${no_write[*]}"
    fi
}

check_lock_status() {
    local lock_dir="/tmp/murray-fsm"
    local lock_file="$lock_dir/backup.lock"

    if [[ -d "$lock_file" ]]; then
        local lock_info
        if [[ -f "$lock_file/info" ]]; then
            lock_info=$(cat "$lock_file/info")
            local lock_time
            lock_time=$(echo "$lock_info" | cut -d: -f2)
            local current_time
            current_time=$(date +%s)
            local age=$((current_time - lock_time))

            if [[ $age -gt 3600 ]]; then
                log_warn "Lock status" "Stale lock found (${age}s old) - may need cleanup"
            else
                log_warn "Lock status" "System is currently locked"
            fi
        else
            log_warn "Lock status" "Lock directory exists but no info file"
        fi
    else
        log_pass "Lock status" "No active locks"
    fi
}

check_fsm_state() {
    local state_file="$BACKUP_SYSTEM_DIR/states/current_state"

    if [[ -f "$state_file" ]]; then
        local current_state
        current_state=$(cat "$state_file" 2>/dev/null || echo "unknown")

        case "$current_state" in
            idle)
                log_pass "FSM state" "System is idle (ready)"
                ;;
            error_*)
                log_warn "FSM state" "System in error state: $current_state"
                ;;
            *)
                log_warn "FSM state" "System in state: $current_state (may be mid-operation)"
                ;;
        esac
    else
        log_pass "FSM state" "No state file (system not initialized - normal for first run)"
    fi
}

check_storage_config() {
    local config_file="$BACKUP_SYSTEM_DIR/config/backup.conf"

    if [[ ! -f "$config_file" ]]; then
        log_warn "Storage config" "No configuration file to check"
        return
    fi

    # Source config safely - strip comments and quotes
    local storage_type=""
    storage_type=$(grep "^STORAGE_TYPE=" "$config_file" 2>/dev/null | cut -d'=' -f2 | sed 's/#.*//' | tr -d '"' | tr -d "'" | tr -d ' ')

    case "$storage_type" in
        local)
            local backup_dir
            backup_dir=$(grep "^LOCAL_BACKUP_DIR=" "$config_file" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'")
            if [[ -n "$backup_dir" ]]; then
                # Expand variables
                backup_dir=$(eval echo "$backup_dir" 2>/dev/null || echo "$backup_dir")
                if [[ -d "$backup_dir" ]]; then
                    log_pass "Storage config" "Local storage: $backup_dir exists"
                else
                    log_warn "Storage config" "Local storage directory not found: $backup_dir"
                fi
            else
                log_warn "Storage config" "LOCAL_BACKUP_DIR not set"
            fi
            ;;
        s3)
            if command -v aws &>/dev/null; then
                log_pass "Storage config" "S3 storage configured, aws CLI available"
            else
                log_fail "Storage config" "S3 storage configured but aws CLI not found"
            fi
            ;;
        gcs)
            if command -v gsutil &>/dev/null; then
                log_pass "Storage config" "GCS storage configured, gsutil available"
            else
                log_fail "Storage config" "GCS storage configured but gsutil not found"
            fi
            ;;
        azure)
            if command -v az &>/dev/null; then
                log_pass "Storage config" "Azure storage configured, az CLI available"
            else
                log_fail "Storage config" "Azure storage configured but az CLI not found"
            fi
            ;;
        "")
            log_warn "Storage config" "STORAGE_TYPE not set in configuration"
            ;;
        *)
            log_warn "Storage config" "Unknown storage type: $storage_type"
            ;;
    esac
}

check_encryption_config() {
    local config_file="$BACKUP_SYSTEM_DIR/config/backup.conf"

    if [[ ! -f "$config_file" ]]; then
        return
    fi

    local encryption_enabled
    encryption_enabled=$(grep "^ENCRYPTION_ENABLED=" "$config_file" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'")

    if [[ "$encryption_enabled" == "true" ]]; then
        if ! command -v openssl &>/dev/null; then
            log_fail "Encryption config" "Encryption enabled but openssl not found"
        else
            local key_file
            key_file=$(grep "^ENCRYPTION_KEY_FILE=" "$config_file" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'")

            if [[ -n "$key_file" ]]; then
                key_file=$(eval echo "$key_file" 2>/dev/null || echo "$key_file")
                if [[ -f "$key_file" ]]; then
                    log_pass "Encryption config" "Encryption enabled, key file exists"
                else
                    log_warn "Encryption config" "Key file not found: $key_file"
                fi
            else
                local inline_key
                inline_key=$(grep "^ENCRYPTION_KEY=" "$config_file" 2>/dev/null | cut -d'=' -f2)
                if [[ -n "$inline_key" ]]; then
                    log_pass "Encryption config" "Encryption enabled with inline key"
                else
                    log_warn "Encryption config" "Encryption enabled but no key configured"
                fi
            fi
        fi
    else
        log_info "Encryption is disabled"
    fi
}

check_disk_space() {
    local backup_dir="$BACKUP_SYSTEM_DIR"
    local available_kb
    available_kb=$(df -k "$backup_dir" 2>/dev/null | tail -1 | awk '{print $4}')

    if [[ -n "$available_kb" ]]; then
        local available_mb=$((available_kb / 1024))
        local available_gb=$((available_mb / 1024))

        if [[ $available_gb -ge 10 ]]; then
            log_pass "Disk space" "${available_gb}GB available"
        elif [[ $available_gb -ge 1 ]]; then
            log_warn "Disk space" "${available_gb}GB available (consider more space for backups)"
        else
            log_warn "Disk space" "${available_mb}MB available (low disk space)"
        fi
    else
        log_warn "Disk space" "Could not determine available space"
    fi
}

# ============================================
# Output Functions
# ============================================

print_summary() {
    if [[ "$JSON_OUTPUT" == "true" ]]; then
        echo "{"
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
        echo "Doctor Summary"
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
        else
            echo -e "${RED}System has issues that need attention.${NC}"
            if [[ "$FIX_MODE" != "true" ]]; then
                echo "Run with --fix to attempt automatic fixes."
            fi
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
    echo "Murray's FSM - Doctor Command"
    echo ""
    echo "Usage: $(basename "$0") [OPTIONS]"
    echo ""
    echo "Options:"
    echo "    --fix       Attempt to fix issues automatically"
    echo "    --verbose   Show detailed output"
    echo "    --json      Output results as JSON"
    echo "    -h, --help  Show this help"
    echo ""
    echo "Checks performed:"
    echo "    - Bash version (4.0+ required)"
    echo "    - Required commands (tar, gzip, rsync, etc.)"
    echo "    - Recommended commands (jq, openssl)"
    echo "    - Cloud CLI tools (aws, gsutil, az)"
    echo "    - Directory structure"
    echo "    - Library and script files"
    echo "    - Configuration file"
    echo "    - Write permissions"
    echo "    - Lock status"
    echo "    - FSM state"
    echo "    - Storage configuration"
    echo "    - Encryption configuration"
    echo "    - Disk space"
}

# ============================================
# Main
# ============================================

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --fix)
                FIX_MODE=true
                shift
                ;;
            --verbose|-v)
                VERBOSE=true
                shift
                ;;
            --json)
                JSON_OUTPUT=true
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
        echo "Murray's FSM - System Diagnostics"
        echo "============================================"
        echo ""
    fi

    # Run all checks
    check_bash_version
    check_required_commands
    check_recommended_commands
    check_cloud_cli
    check_directory_structure
    check_library_files
    check_script_files
    check_config_file
    check_write_permissions
    check_lock_status
    check_fsm_state
    check_storage_config
    check_encryption_config
    check_disk_space

    # Print summary
    print_summary

    # Return appropriate exit code
    if [[ $CHECKS_FAILED -gt 0 ]]; then
        exit 1
    elif [[ $CHECKS_WARNED -gt 0 ]]; then
        exit 0  # Warnings don't fail the check
    else
        exit 0
    fi
}

main "$@"
