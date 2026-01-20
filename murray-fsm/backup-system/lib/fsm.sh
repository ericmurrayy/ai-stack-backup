#!/bin/bash
# Murray's FSM - Finite State Machine Library
# ============================================
# FSM state management for backup/restore operations

set -euo pipefail

# Source common library if not already loaded
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! declare -f log_info &>/dev/null; then
    # shellcheck source=./common.sh
    source "${SCRIPT_DIR}/common.sh"
fi

# FSM States
declare -A FSM_STATES=(
    # Backup states
    ["idle"]="Waiting for trigger"
    ["backup_init"]="Initializing backup"
    ["collect_sources"]="Collecting source files"
    ["capture_environment"]="Capturing environment state"
    ["compress"]="Compressing backup archive"
    ["encrypt"]="Encrypting backup archive"
    ["upload"]="Uploading to storage"
    ["verify_upload"]="Verifying upload integrity"
    ["cleanup_backup"]="Cleaning up temporary files"
    ["backup_done"]="Backup completed"

    # Restore states
    ["restore_init"]="Initializing restore"
    ["download"]="Downloading backup archive"
    ["verify_download"]="Verifying download integrity"
    ["decrypt"]="Decrypting backup archive"
    ["decompress"]="Decompressing backup archive"
    ["restore_apply"]="Applying backup files"
    ["restore_environment"]="Restoring environment"
    ["restore_verify"]="Verifying restored state"
    ["cleanup_restore"]="Cleaning up temporary files"
    ["restore_done"]="Restore completed"

    # Error states
    ["error"]="Error occurred"
    ["error_recoverable"]="Recoverable error - will retry"
    ["error_fatal"]="Fatal error - manual intervention required"
)

# Valid state transitions
declare -A FSM_TRANSITIONS=(
    # Backup transitions
    ["idle->backup_init"]="start_backup"
    ["backup_init->collect_sources"]="init_complete"
    ["collect_sources->capture_environment"]="sources_collected"
    ["capture_environment->compress"]="environment_captured"
    ["compress->encrypt"]="compressed"
    ["compress->upload"]="compressed_no_encrypt"
    ["encrypt->upload"]="encrypted"
    ["upload->verify_upload"]="uploaded"
    ["verify_upload->cleanup_backup"]="verified"
    ["cleanup_backup->backup_done"]="cleaned"
    ["backup_done->idle"]="complete"

    # Restore transitions
    ["idle->restore_init"]="start_restore"
    ["restore_init->download"]="init_complete"
    ["download->verify_download"]="downloaded"
    ["verify_download->decrypt"]="verified_encrypted"
    ["verify_download->decompress"]="verified_no_encrypt"
    ["decrypt->decompress"]="decrypted"
    ["decompress->restore_apply"]="decompressed"
    ["restore_apply->restore_environment"]="files_restored"
    ["restore_environment->restore_verify"]="environment_restored"
    ["restore_verify->cleanup_restore"]="verified"
    ["cleanup_restore->restore_done"]="cleaned"
    ["restore_done->idle"]="complete"

    # Error transitions (from any state)
    ["*->error"]="error_occurred"
    ["*->error_recoverable"]="recoverable_error"
    ["*->error_fatal"]="fatal_error"
    ["error_recoverable->*"]="retry"
    ["error->idle"]="reset"
)

# Initialize FSM state file
fsm_init() {
    local state_file="${FSM_STATE_FILE:-/tmp/fsm_state.json}"

    mkdir -p "$(dirname "$state_file")"

    if [[ ! -f "$state_file" ]]; then
        cat > "$state_file" <<EOF
{
    "current_state": "idle",
    "previous_state": null,
    "operation": null,
    "operation_id": null,
    "started_at": null,
    "updated_at": "$(date -Iseconds)",
    "retry_count": 0,
    "error": null,
    "metadata": {}
}
EOF
        log_debug "FSM state file initialized: $state_file"
    fi
}

# Get current FSM state
fsm_get_state() {
    local state_file="${FSM_STATE_FILE:-/tmp/fsm_state.json}"

    if [[ ! -f "$state_file" ]]; then
        fsm_init
    fi

    if command_exists jq; then
        jq -r '.current_state' "$state_file"
    else
        grep -o '"current_state": *"[^"]*"' "$state_file" | cut -d'"' -f4
    fi
}

# Get FSM metadata
fsm_get_metadata() {
    local key="$1"
    local state_file="${FSM_STATE_FILE:-/tmp/fsm_state.json}"

    if command_exists jq; then
        jq -r ".metadata.${key} // empty" "$state_file"
    else
        grep -o "\"${key}\": *\"[^\"]*\"" "$state_file" | cut -d'"' -f4 || echo ""
    fi
}

# Set FSM state
fsm_set_state() {
    local new_state="$1"
    local operation="${2:-}"
    local state_file="${FSM_STATE_FILE:-/tmp/fsm_state.json}"

    local current_state
    current_state=$(fsm_get_state)

    # Validate state
    if [[ -z "${FSM_STATES[$new_state]:-}" ]]; then
        log_error "Invalid FSM state: $new_state"
        return 1
    fi

    # Update state file
    local temp_file
    temp_file=$(mktemp)

    if command_exists jq; then
        jq --arg new_state "$new_state" \
           --arg prev_state "$current_state" \
           --arg operation "${operation:-null}" \
           --arg updated_at "$(date -Iseconds)" \
           '.current_state = $new_state |
            .previous_state = $prev_state |
            .operation = (if $operation == "null" then .operation else $operation end) |
            .updated_at = $updated_at' \
           "$state_file" > "$temp_file"
    else
        # Fallback without jq
        cat > "$temp_file" <<EOF
{
    "current_state": "$new_state",
    "previous_state": "$current_state",
    "operation": "${operation:-null}",
    "operation_id": null,
    "started_at": "$(date -Iseconds)",
    "updated_at": "$(date -Iseconds)",
    "retry_count": 0,
    "error": null,
    "metadata": {}
}
EOF
    fi

    mv "$temp_file" "$state_file"
    log_state "State transition: $current_state -> $new_state"

    return 0
}

# Set FSM metadata
fsm_set_metadata() {
    local key="$1"
    local value="$2"
    local state_file="${FSM_STATE_FILE:-/tmp/fsm_state.json}"

    if command_exists jq; then
        local temp_file
        temp_file=$(mktemp)
        jq --arg key "$key" --arg value "$value" \
           '.metadata[$key] = $value' "$state_file" > "$temp_file"
        mv "$temp_file" "$state_file"
    fi

    log_debug "FSM metadata set: $key = $value"
}

# Increment retry count
fsm_increment_retry() {
    local state_file="${FSM_STATE_FILE:-/tmp/fsm_state.json}"

    if command_exists jq; then
        local temp_file
        temp_file=$(mktemp)
        jq '.retry_count += 1' "$state_file" > "$temp_file"
        mv "$temp_file" "$state_file"
    fi
}

# Get retry count
fsm_get_retry_count() {
    local state_file="${FSM_STATE_FILE:-/tmp/fsm_state.json}"

    if command_exists jq; then
        jq -r '.retry_count' "$state_file"
    else
        echo "0"
    fi
}

# Reset retry count
fsm_reset_retry() {
    local state_file="${FSM_STATE_FILE:-/tmp/fsm_state.json}"

    if command_exists jq; then
        local temp_file
        temp_file=$(mktemp)
        jq '.retry_count = 0' "$state_file" > "$temp_file"
        mv "$temp_file" "$state_file"
    fi
}

# Set error in FSM
fsm_set_error() {
    local error_message="$1"
    local recoverable="${2:-false}"
    local state_file="${FSM_STATE_FILE:-/tmp/fsm_state.json}"

    if command_exists jq; then
        local temp_file
        temp_file=$(mktemp)
        jq --arg error "$error_message" \
           --arg recoverable "$recoverable" \
           '.error = {"message": $error, "recoverable": ($recoverable == "true"), "timestamp": now | todate}' \
           "$state_file" > "$temp_file"
        mv "$temp_file" "$state_file"
    fi

    log_error "FSM error: $error_message (recoverable: $recoverable)"
}

# Clear error in FSM
fsm_clear_error() {
    local state_file="${FSM_STATE_FILE:-/tmp/fsm_state.json}"

    if command_exists jq; then
        local temp_file
        temp_file=$(mktemp)
        jq '.error = null' "$state_file" > "$temp_file"
        mv "$temp_file" "$state_file"
    fi
}

# Check if transition is valid
fsm_can_transition() {
    local from_state="$1"
    local to_state="$2"

    local transition_key="${from_state}->${to_state}"
    local wildcard_key="*->${to_state}"
    local wildcard_from="${from_state}->*"

    if [[ -n "${FSM_TRANSITIONS[$transition_key]:-}" ]] ||
       [[ -n "${FSM_TRANSITIONS[$wildcard_key]:-}" ]] ||
       [[ -n "${FSM_TRANSITIONS[$wildcard_from]:-}" ]]; then
        return 0
    fi

    return 1
}

# Transition to new state with validation
fsm_transition() {
    local to_state="$1"
    local operation="${2:-}"
    local force="${3:-false}"

    local current_state
    current_state=$(fsm_get_state)

    # Check if transition is valid
    if [[ "$force" != "true" ]] && ! fsm_can_transition "$current_state" "$to_state"; then
        log_error "Invalid state transition: $current_state -> $to_state"
        return 1
    fi

    fsm_set_state "$to_state" "$operation"
    fsm_reset_retry

    return 0
}

# Execute state action with retry logic
fsm_execute_with_retry() {
    local action_func="$1"
    shift
    local max_retries="${FSM_MAX_RETRIES:-3}"
    local retry_delay="${FSM_RETRY_DELAY:-30}"

    local retry_count
    retry_count=$(fsm_get_retry_count)

    while [[ $retry_count -lt $max_retries ]]; do
        log_debug "Executing action: $action_func (attempt $((retry_count + 1))/$max_retries)"

        if "$action_func" "$@"; then
            fsm_clear_error
            return 0
        fi

        fsm_increment_retry
        retry_count=$(fsm_get_retry_count)

        if [[ $retry_count -lt $max_retries ]]; then
            log_warn "Action failed, retrying in ${retry_delay}s..."
            sleep "$retry_delay"
        fi
    done

    log_error "Action failed after $max_retries attempts"
    return 1
}

# Get state description
fsm_state_description() {
    local state="${1:-$(fsm_get_state)}"
    echo "${FSM_STATES[$state]:-Unknown state}"
}

# Print FSM status
fsm_status() {
    local state_file="${FSM_STATE_FILE:-/tmp/fsm_state.json}"

    echo "=== FSM Status ==="
    echo "State File: $state_file"

    if [[ -f "$state_file" ]]; then
        if command_exists jq; then
            jq '.' "$state_file"
        else
            cat "$state_file"
        fi
    else
        echo "State file not found"
    fi

    echo "=================="
}

# Reset FSM to idle state
fsm_reset() {
    log_info "Resetting FSM to idle state"
    fsm_set_state "idle"
    fsm_clear_error
    fsm_reset_retry
}

# Export FSM functions
export -f fsm_init fsm_get_state fsm_set_state
export -f fsm_get_metadata fsm_set_metadata
export -f fsm_increment_retry fsm_get_retry_count fsm_reset_retry
export -f fsm_set_error fsm_clear_error
export -f fsm_can_transition fsm_transition fsm_execute_with_retry
export -f fsm_state_description fsm_status fsm_reset
