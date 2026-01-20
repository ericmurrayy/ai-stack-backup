#!/bin/bash
# Murray's FSM - Controller Script
# =================================
# FSM controller for Claude/Open Interpreter coordination
# Provides JSON-based interface for AI agent interaction

set -euo pipefail

# Script directory resolution
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SYSTEM_DIR="$(dirname "$SCRIPT_DIR")"
LIB_DIR="${BACKUP_SYSTEM_DIR}/lib"

# Source libraries
# shellcheck source=../lib/common.sh
source "${LIB_DIR}/common.sh"
# shellcheck source=../lib/fsm.sh
source "${LIB_DIR}/fsm.sh"
# shellcheck source=../lib/storage.sh
source "${LIB_DIR}/storage.sh"

# Configuration
CONFIG_FILE="${BACKUP_SYSTEM_DIR}/config/backup.conf"
OUTPUT_FORMAT="${OUTPUT_FORMAT:-json}"

# Show usage
usage() {
    cat << EOF
Murray's FSM Controller
=======================

A command-line interface for Claude/Open Interpreter coordination.
Outputs JSON for easy parsing by AI agents.

Usage: $(basename "$0") <COMMAND> [OPTIONS]

Commands:
    status              Get current FSM state and system status
    backup              Start a new backup
    restore [SOURCE]    Start a restore (optional: specify backup source)
    list                List available backups
    transition STATE    Manually transition to a state
    error               Get current error information
    clear-error         Clear error state
    config              Show current configuration
    validate            Validate system configuration
    history             Show state transition history

Options:
    -c, --config FILE   Config file (default: config/backup.conf)
    -f, --format FMT    Output format: json, text (default: json)
    -v, --verbose       Verbose output
    -h, --help          Show this help

Examples:
    # AI Agent: Check system status
    $(basename "$0") status

    # AI Agent: Start backup and monitor
    $(basename "$0") backup
    $(basename "$0") status

    # AI Agent: List and restore
    $(basename "$0") list
    $(basename "$0") restore backup-2024-01-15.tar.gz

    # AI Agent: Handle errors
    $(basename "$0") error
    $(basename "$0") clear-error
    $(basename "$0") transition idle

EOF
}

# Output JSON response
output_json() {
    local status="$1"
    local data="$2"
    local message="${3:-}"

    if [[ "$OUTPUT_FORMAT" == "json" ]]; then
        cat << EOF
{
    "status": "$status",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "data": $data,
    "message": "$message"
}
EOF
    else
        echo "Status: $status"
        echo "Message: $message"
        echo "Data:"
        echo "$data" | jq -r '.' 2>/dev/null || echo "$data"
    fi
}

# Output error JSON
output_error() {
    local message="$1"
    local code="${2:-1}"

    if [[ "$OUTPUT_FORMAT" == "json" ]]; then
        cat << EOF
{
    "status": "error",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "error": {
        "message": "$message",
        "code": $code
    }
}
EOF
    else
        echo "Error: $message (code: $code)"
    fi
    return "$code"
}

# Get system status
cmd_status() {
    fsm_init

    local current_state
    current_state=$(fsm_get_state)

    local state_data
    state_data=$(fsm_get_state_data)

    local error_info=""
    if [[ "$current_state" == error* ]]; then
        error_info=$(fsm_get_error)
    fi

    local backup_count
    backup_count=$(storage_list "${BACKUP_PREFIX:-backup}" 2>/dev/null | wc -l | tr -d ' ')

    local latest_backup=""
    latest_backup=$(storage_get_latest 2>/dev/null) || true

    local data
    data=$(cat << EOF
{
    "state": "$current_state",
    "state_data": $state_data,
    "error": $(if [[ -n "$error_info" ]]; then echo "\"$error_info\""; else echo "null"; fi),
    "backup_count": $backup_count,
    "latest_backup": $(if [[ -n "$latest_backup" ]]; then echo "\"$latest_backup\""; else echo "null"; fi),
    "storage_type": "${STORAGE_TYPE:-local}",
    "encryption_enabled": ${ENCRYPTION_ENABLED:-false}
}
EOF
)

    output_json "success" "$data" "System status retrieved"
}

# Start backup
cmd_backup() {
    local opts=("$@")

    fsm_init

    local current_state
    current_state=$(fsm_get_state)

    # Check if backup already in progress
    if [[ "$current_state" == backup_* ]]; then
        output_error "Backup already in progress (state: $current_state)"
        return 1
    fi

    # Check for error state
    if [[ "$current_state" == error* ]]; then
        output_error "System in error state. Clear error first: fsm-controller.sh clear-error"
        return 1
    fi

    # Start backup in background
    local log_file="${BACKUP_SYSTEM_DIR}/logs/backup-$(date +%Y%m%d%H%M%S).log"
    mkdir -p "$(dirname "$log_file")"

    "${SCRIPT_DIR}/backup.sh" "${opts[@]}" > "$log_file" 2>&1 &
    local backup_pid=$!

    # Wait a moment to check if it started
    sleep 1

    if kill -0 "$backup_pid" 2>/dev/null; then
        local data
        data=$(cat << EOF
{
    "pid": $backup_pid,
    "log_file": "$log_file",
    "started_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
)
        output_json "success" "$data" "Backup started"
    else
        wait "$backup_pid" 2>/dev/null || true
        local exit_code=$?

        if [[ $exit_code -eq 0 ]]; then
            output_json "success" '{"completed": true}' "Backup completed quickly"
        else
            output_error "Backup failed to start (exit code: $exit_code). Check: $log_file"
            return 1
        fi
    fi
}

# Start restore
cmd_restore() {
    local source="${1:-}"
    shift || true
    local opts=("$@")

    fsm_init

    local current_state
    current_state=$(fsm_get_state)

    # Check if restore already in progress
    if [[ "$current_state" == restore_* ]]; then
        output_error "Restore already in progress (state: $current_state)"
        return 1
    fi

    # Check for error state
    if [[ "$current_state" == error* ]]; then
        output_error "System in error state. Clear error first: fsm-controller.sh clear-error"
        return 1
    fi

    # Start restore in background
    local log_file="${BACKUP_SYSTEM_DIR}/logs/restore-$(date +%Y%m%d%H%M%S).log"
    mkdir -p "$(dirname "$log_file")"

    local restore_args=()
    [[ -n "$source" ]] && restore_args+=("$source")
    restore_args+=("${opts[@]}")

    "${SCRIPT_DIR}/restore.sh" "${restore_args[@]}" > "$log_file" 2>&1 &
    local restore_pid=$!

    # Wait a moment to check if it started
    sleep 1

    if kill -0 "$restore_pid" 2>/dev/null; then
        local data
        data=$(cat << EOF
{
    "pid": $restore_pid,
    "log_file": "$log_file",
    "source": $(if [[ -n "$source" ]]; then echo "\"$source\""; else echo "\"latest\""; fi),
    "started_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
)
        output_json "success" "$data" "Restore started"
    else
        wait "$restore_pid" 2>/dev/null || true
        local exit_code=$?

        if [[ $exit_code -eq 0 ]]; then
            output_json "success" '{"completed": true}' "Restore completed quickly"
        else
            output_error "Restore failed to start (exit code: $exit_code). Check: $log_file"
            return 1
        fi
    fi
}

# List backups
cmd_list() {
    local backups=()
    local count=0

    while IFS= read -r backup; do
        [[ -z "$backup" ]] && continue
        backups+=("\"$backup\"")
        ((count++)) || true
    done < <(storage_list "${BACKUP_PREFIX:-backup}" 2>/dev/null)

    local backup_array
    if [[ ${#backups[@]} -gt 0 ]]; then
        backup_array=$(IFS=,; echo "[${backups[*]}]")
    else
        backup_array="[]"
    fi

    local data
    data=$(cat << EOF
{
    "count": $count,
    "storage_type": "${STORAGE_TYPE:-local}",
    "backups": $backup_array
}
EOF
)

    output_json "success" "$data" "Listed $count backups"
}

# Manual state transition
cmd_transition() {
    local target_state="$1"

    if [[ -z "$target_state" ]]; then
        output_error "Target state required"
        return 1
    fi

    fsm_init

    local current_state
    current_state=$(fsm_get_state)

    # Validate state
    local valid_states="idle backup_init collect_sources capture_environment compress encrypt upload verify_upload cleanup_backup backup_done restore_init download verify_download decrypt decompress restore_apply restore_environment restore_verify cleanup_restore restore_done error error_recoverable error_fatal"

    if [[ ! " $valid_states " =~ " $target_state " ]]; then
        output_error "Invalid state: $target_state"
        return 1
    fi

    fsm_set_state "$target_state"

    local data
    data=$(cat << EOF
{
    "previous_state": "$current_state",
    "current_state": "$target_state"
}
EOF
)

    output_json "success" "$data" "State transitioned from $current_state to $target_state"
}

# Get error information
cmd_error() {
    fsm_init

    local current_state
    current_state=$(fsm_get_state)

    local error_info=""
    local error_type="none"

    if [[ "$current_state" == error* ]]; then
        error_info=$(fsm_get_error)
        error_type="$current_state"
    fi

    local data
    data=$(cat << EOF
{
    "has_error": $(if [[ "$current_state" == error* ]]; then echo "true"; else echo "false"; fi),
    "error_type": "$error_type",
    "error_message": $(if [[ -n "$error_info" ]]; then echo "\"$error_info\""; else echo "null"; fi),
    "current_state": "$current_state"
}
EOF
)

    output_json "success" "$data" "Error information retrieved"
}

# Clear error state
cmd_clear_error() {
    fsm_init

    local current_state
    current_state=$(fsm_get_state)

    if [[ "$current_state" != error* ]]; then
        output_json "success" '{"cleared": false}' "No error to clear (state: $current_state)"
        return 0
    fi

    fsm_clear_error
    fsm_set_state "idle"

    local data
    data=$(cat << EOF
{
    "cleared": true,
    "previous_state": "$current_state",
    "current_state": "idle"
}
EOF
)

    output_json "success" "$data" "Error cleared, state reset to idle"
}

# Show configuration
cmd_config() {
    local data
    data=$(cat << EOF
{
    "config_file": "$CONFIG_FILE",
    "backup_dirs": "${BACKUP_DIRS:-}",
    "backup_files": "${BACKUP_FILES:-}",
    "exclude_patterns": "${EXCLUDE_PATTERNS:-}",
    "storage_type": "${STORAGE_TYPE:-local}",
    "local_backup_dir": "${LOCAL_BACKUP_DIR:-\$HOME/backups}",
    "s3_bucket": "${S3_BUCKET:-}",
    "gcs_bucket": "${GCS_BUCKET:-}",
    "azure_container": "${AZURE_CONTAINER:-}",
    "compression": "${COMPRESSION:-gzip}",
    "encryption_enabled": ${ENCRYPTION_ENABLED:-false},
    "checksum_algorithm": "${CHECKSUM_ALGORITHM:-sha256}",
    "retention": {
        "daily": ${RETENTION_DAILY:-7},
        "weekly": ${RETENTION_WEEKLY:-4},
        "monthly": ${RETENTION_MONTHLY:-3}
    }
}
EOF
)

    output_json "success" "$data" "Configuration loaded"
}

# Validate configuration
cmd_validate() {
    local issues=()
    local warnings=()

    # Check required directories
    if [[ -z "${BACKUP_DIRS:-}" && -z "${BACKUP_FILES:-}" ]]; then
        issues+=("No backup sources configured (BACKUP_DIRS or BACKUP_FILES)")
    fi

    # Check storage configuration
    case "${STORAGE_TYPE:-local}" in
        s3)
            [[ -z "${S3_BUCKET:-}" ]] && issues+=("S3_BUCKET not configured")
            command -v aws &>/dev/null || issues+=("AWS CLI not installed")
            ;;
        gcs)
            [[ -z "${GCS_BUCKET:-}" ]] && issues+=("GCS_BUCKET not configured")
            command -v gsutil &>/dev/null || issues+=("gsutil not installed")
            ;;
        azure)
            [[ -z "${AZURE_CONTAINER:-}" ]] && issues+=("AZURE_CONTAINER not configured")
            [[ -z "${AZURE_STORAGE_ACCOUNT:-}" ]] && issues+=("AZURE_STORAGE_ACCOUNT not configured")
            command -v az &>/dev/null || issues+=("Azure CLI not installed")
            ;;
    esac

    # Check encryption configuration
    if [[ "${ENCRYPTION_ENABLED:-false}" == "true" ]]; then
        if [[ -z "${ENCRYPTION_KEY:-}" && -z "${ENCRYPTION_KEY_FILE:-}" ]]; then
            issues+=("Encryption enabled but no key configured")
        fi
        command -v openssl &>/dev/null || issues+=("openssl not installed (required for encryption)")
    fi

    # Check compression tools
    case "${COMPRESSION:-gzip}" in
        zstd)
            command -v zstd &>/dev/null || warnings+=("zstd not installed, will fall back to gzip")
            ;;
    esac

    # Check dependencies
    command -v rsync &>/dev/null || warnings+=("rsync not installed (recommended for backup)")
    command -v jq &>/dev/null || warnings+=("jq not installed (recommended for JSON handling)")

    local issues_json="[]"
    local warnings_json="[]"

    if [[ ${#issues[@]} -gt 0 ]]; then
        issues_json=$(printf '%s\n' "${issues[@]}" | jq -R . | jq -s .)
    fi

    if [[ ${#warnings[@]} -gt 0 ]]; then
        warnings_json=$(printf '%s\n' "${warnings[@]}" | jq -R . | jq -s .)
    fi

    local valid="true"
    [[ ${#issues[@]} -gt 0 ]] && valid="false"

    local data
    data=$(cat << EOF
{
    "valid": $valid,
    "issues": $issues_json,
    "warnings": $warnings_json
}
EOF
)

    if [[ "$valid" == "true" ]]; then
        output_json "success" "$data" "Configuration is valid"
    else
        output_json "error" "$data" "Configuration has ${#issues[@]} issues"
        return 1
    fi
}

# Show state history
cmd_history() {
    fsm_init

    local history_file="${FSM_STATE_DIR:-${BACKUP_SYSTEM_DIR}/states}/history.log"

    if [[ ! -f "$history_file" ]]; then
        output_json "success" '{"entries": [], "count": 0}' "No history available"
        return 0
    fi

    local entries=()
    local count=0

    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        entries+=("\"$line\"")
        ((count++)) || true
    done < <(tail -n 50 "$history_file")

    local entries_json
    if [[ ${#entries[@]} -gt 0 ]]; then
        entries_json=$(IFS=,; echo "[${entries[*]}]")
    else
        entries_json="[]"
    fi

    local data
    data=$(cat << EOF
{
    "count": $count,
    "entries": $entries_json
}
EOF
)

    output_json "success" "$data" "Retrieved last $count history entries"
}

# Parse global arguments and dispatch
main() {
    local command=""

    # Parse global options
    while [[ $# -gt 0 ]]; do
        case $1 in
            -c|--config)
                CONFIG_FILE="$2"
                shift 2
                ;;
            -f|--format)
                OUTPUT_FORMAT="$2"
                shift 2
                ;;
            -v|--verbose)
                export LOG_LEVEL="DEBUG"
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            -*)
                output_error "Unknown option: $1"
                exit 1
                ;;
            *)
                command="$1"
                shift
                break
                ;;
        esac
    done

    # Load configuration
    if [[ -f "$CONFIG_FILE" ]]; then
        load_config "$CONFIG_FILE"
    fi

    # Dispatch command
    case "${command:-status}" in
        status)
            cmd_status
            ;;
        backup)
            cmd_backup "$@"
            ;;
        restore)
            cmd_restore "$@"
            ;;
        list)
            cmd_list
            ;;
        transition)
            cmd_transition "$@"
            ;;
        error)
            cmd_error
            ;;
        clear-error)
            cmd_clear_error
            ;;
        config)
            cmd_config
            ;;
        validate)
            cmd_validate
            ;;
        history)
            cmd_history
            ;;
        help)
            usage
            ;;
        *)
            output_error "Unknown command: $command"
            exit 1
            ;;
    esac
}

# Run main if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
