#!/bin/bash
# Murray's FSM - Lock Management Library
# =======================================
# Prevents concurrent backup/restore operations

# Lock file location
LOCK_DIR="${LOCK_DIR:-/tmp/murray-fsm}"
LOCK_FILE="${LOCK_DIR}/backup.lock"
LOCK_TIMEOUT="${LOCK_TIMEOUT:-3600}"  # 1 hour default

# Initialize lock directory
lock_init() {
    mkdir -p "$LOCK_DIR"
}

# Acquire exclusive lock
# Returns 0 on success, 1 if already locked
lock_acquire() {
    local operation="${1:-backup}"
    local pid=$$
    local hostname
    hostname=$(hostname)

    lock_init

    # Check for stale lock
    if [[ -f "$LOCK_FILE" ]]; then
        local lock_pid lock_time lock_host lock_op
        IFS=':' read -r lock_pid lock_time lock_host lock_op < "$LOCK_FILE"

        # Check if lock is stale (older than timeout)
        local current_time
        current_time=$(date +%s)
        local lock_age=$((current_time - lock_time))

        if [[ $lock_age -gt $LOCK_TIMEOUT ]]; then
            log_warn "Found stale lock (age: ${lock_age}s), removing"
            rm -f "$LOCK_FILE"
        elif [[ "$lock_host" == "$hostname" ]]; then
            # Same host - check if process still running
            if ! kill -0 "$lock_pid" 2>/dev/null; then
                log_warn "Lock held by dead process $lock_pid, removing"
                rm -f "$LOCK_FILE"
            else
                log_error "Operation already in progress (PID: $lock_pid, operation: $lock_op)"
                return 1
            fi
        else
            log_error "Operation locked by another host: $lock_host (operation: $lock_op)"
            return 1
        fi
    fi

    # Create lock file atomically
    local lock_content="${pid}:$(date +%s):${hostname}:${operation}"

    # Use mkdir for atomic lock (works across NFS)
    local lock_dir_tmp="${LOCK_FILE}.d"
    if mkdir "$lock_dir_tmp" 2>/dev/null; then
        echo "$lock_content" > "$LOCK_FILE"
        rmdir "$lock_dir_tmp"
        log_debug "Lock acquired: $lock_content"
        return 0
    else
        log_error "Failed to acquire lock - another operation may be starting"
        return 1
    fi
}

# Release lock
lock_release() {
    local pid=$$

    if [[ -f "$LOCK_FILE" ]]; then
        local lock_pid
        IFS=':' read -r lock_pid _ _ _ < "$LOCK_FILE"

        if [[ "$lock_pid" == "$pid" ]]; then
            rm -f "$LOCK_FILE"
            log_debug "Lock released"
            return 0
        else
            log_warn "Lock not owned by this process (owned by: $lock_pid)"
            return 1
        fi
    fi

    return 0
}

# Check if locked
lock_check() {
    if [[ -f "$LOCK_FILE" ]]; then
        local lock_pid lock_time lock_host lock_op
        IFS=':' read -r lock_pid lock_time lock_host lock_op < "$LOCK_FILE"

        local current_time
        current_time=$(date +%s)
        local lock_age=$((current_time - lock_time))

        echo "locked"
        echo "pid:$lock_pid"
        echo "host:$lock_host"
        echo "operation:$lock_op"
        echo "age:$lock_age"
        return 0
    else
        echo "unlocked"
        return 1
    fi
}

# Get lock info as JSON
lock_info_json() {
    if [[ -f "$LOCK_FILE" ]]; then
        local lock_pid lock_time lock_host lock_op
        IFS=':' read -r lock_pid lock_time lock_host lock_op < "$LOCK_FILE"

        local current_time
        current_time=$(date +%s)
        local lock_age=$((current_time - lock_time))

        cat << EOF
{
    "locked": true,
    "pid": $lock_pid,
    "host": "$lock_host",
    "operation": "$lock_op",
    "started_at": "$lock_time",
    "age_seconds": $lock_age
}
EOF
    else
        echo '{"locked": false}'
    fi
}

# Wait for lock with timeout
lock_wait() {
    local timeout="${1:-60}"
    local interval="${2:-5}"
    local elapsed=0

    while [[ $elapsed -lt $timeout ]]; do
        if lock_acquire; then
            return 0
        fi

        log_info "Waiting for lock... (${elapsed}s / ${timeout}s)"
        sleep "$interval"
        elapsed=$((elapsed + interval))
    done

    log_error "Timeout waiting for lock after ${timeout}s"
    return 1
}

# Cleanup lock on exit (trap handler)
lock_cleanup_trap() {
    lock_release 2>/dev/null || true
}
