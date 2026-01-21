#!/bin/bash
# Murray's FSM - Backup System Test Suite
# ========================================
# End-to-end tests for backup and restore functionality
# Suitable for CI/CD pipelines

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SYSTEM_DIR="$(dirname "$SCRIPT_DIR")"
TEST_DIR="${BACKUP_SYSTEM_DIR}/test-workspace"
TEST_SOURCE_DIR="${TEST_DIR}/source"
TEST_RESTORE_DIR="${TEST_DIR}/restore"
TEST_BACKUP_DIR="${TEST_DIR}/backups"
TEST_CONFIG="${TEST_DIR}/test.conf"

# Counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# ============================================
# Helper Functions
# ============================================

log_test() {
    echo -e "${YELLOW}[TEST]${NC} $1"
}

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++)) || true
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++)) || true
}

run_test() {
    local test_name="$1"
    local test_func="$2"

    ((TESTS_RUN++)) || true
    log_test "Running: $test_name"

    if $test_func; then
        log_pass "$test_name"
        return 0
    else
        log_fail "$test_name"
        return 1
    fi
}

# ============================================
# Setup and Teardown
# ============================================

setup_test_environment() {
    log_test "Setting up test environment..."

    # Clean up any previous test runs
    rm -rf "$TEST_DIR"

    # Create test directories
    mkdir -p "$TEST_SOURCE_DIR/subdir1/nested"
    mkdir -p "$TEST_SOURCE_DIR/subdir2"
    mkdir -p "$TEST_RESTORE_DIR"
    mkdir -p "$TEST_BACKUP_DIR"

    # Create test files with known content
    echo "Test file 1 content" > "$TEST_SOURCE_DIR/file1.txt"
    echo "Test file 2 content" > "$TEST_SOURCE_DIR/file2.txt"
    echo "Nested file content" > "$TEST_SOURCE_DIR/subdir1/nested/deep.txt"
    echo "Config file" > "$TEST_SOURCE_DIR/subdir1/config.json"
    echo "Data file" > "$TEST_SOURCE_DIR/subdir2/data.csv"

    # Create test configuration
    cat > "$TEST_CONFIG" << EOF
# Test configuration for Murray's FSM Backup System

# Backup sources
BACKUP_DIRS="$TEST_SOURCE_DIR"
BACKUP_FILES=""
EXCLUDE_PATTERNS="*.tmp *.log"

# Storage configuration
STORAGE_TYPE="local"
LOCAL_BACKUP_DIR="$TEST_BACKUP_DIR"

# Compression
COMPRESSION="gzip"

# Encryption (disabled for testing)
ENCRYPTION_ENABLED=false

# Checksum
CHECKSUM_ALGORITHM="sha256"

# Environment capture
CAPTURE_ENVIRONMENT=false

# Retention
RETENTION_ENABLED=false

# Service quiescing (disabled for testing)
QUIESCE_SERVICES=false
QUIESCE_DOCKER=false
QUIESCE_SYSTEMD=false

# Notifications (log only)
NOTIFY_ENABLED=true
NOTIFY_CHANNELS="log"

# Pre-restore backup
PRE_RESTORE_BACKUP=false
EOF

    log_test "Test environment ready at: $TEST_DIR"
}

cleanup_test_environment() {
    log_test "Cleaning up test environment..."
    rm -rf "$TEST_DIR"
    # Also clean up any lock files and FSM state
    rm -f /tmp/murray-fsm/backup.lock
    rm -f /tmp/fsm_state.json
}

# Reset FSM state before each test
reset_fsm_state() {
    rm -f /tmp/fsm_state.json
    rm -f /tmp/murray-fsm/backup.lock
}

# ============================================
# Individual Tests
# ============================================

test_config_loads() {
    # Test that configuration loads correctly
    source "${BACKUP_SYSTEM_DIR}/lib/common.sh"
    load_config "$TEST_CONFIG"

    [[ "$STORAGE_TYPE" == "local" ]] && [[ "$COMPRESSION" == "gzip" ]]
}

test_fsm_init() {
    # Test FSM initialization
    source "${BACKUP_SYSTEM_DIR}/lib/common.sh"
    source "${BACKUP_SYSTEM_DIR}/lib/fsm.sh"
    load_config "$TEST_CONFIG"

    fsm_init
    local state
    state=$(fsm_get_state)

    [[ "$state" == "idle" ]]
}

test_fsm_transitions() {
    # Test FSM state transitions
    source "${BACKUP_SYSTEM_DIR}/lib/common.sh"
    source "${BACKUP_SYSTEM_DIR}/lib/fsm.sh"
    load_config "$TEST_CONFIG"

    fsm_init
    fsm_set_state "backup_init"

    local state
    state=$(fsm_get_state)
    [[ "$state" == "backup_init" ]] || return 1

    fsm_set_state "idle"
    state=$(fsm_get_state)
    [[ "$state" == "idle" ]]
}

test_lock_acquire_release() {
    # Test locking mechanism
    source "${BACKUP_SYSTEM_DIR}/lib/common.sh"
    source "${BACKUP_SYSTEM_DIR}/lib/lock.sh"
    load_config "$TEST_CONFIG"

    # Acquire lock
    lock_acquire "test" || return 1

    # Should not be able to acquire again
    if lock_acquire "test" 2>/dev/null; then
        lock_release
        return 1
    fi

    # Release lock
    lock_release || return 1

    # Should be able to acquire after release
    lock_acquire "test" || return 1
    lock_release
}

test_checksum_calculation() {
    # Test checksum calculation
    source "${BACKUP_SYSTEM_DIR}/lib/common.sh"
    load_config "$TEST_CONFIG"

    local test_file="$TEST_DIR/checksum_test.txt"
    echo "checksum test content" > "$test_file"

    local checksum
    checksum=$(calculate_checksum "$test_file")

    # Verify checksum is not empty and has expected format
    [[ -n "$checksum" ]] && [[ ${#checksum} -eq 64 ]]  # SHA256 produces 64 hex chars
}

test_backup_dry_run() {
    # Reset FSM state for clean test
    reset_fsm_state

    # Test backup in dry-run mode
    "${SCRIPT_DIR}/backup.sh" -c "$TEST_CONFIG" -d -n "test-dry" 2>&1 | grep -q "DRY RUN"
}

test_full_backup() {
    # Reset FSM state for clean test
    reset_fsm_state

    # Test full backup operation
    "${SCRIPT_DIR}/backup.sh" -c "$TEST_CONFIG" -n "test-full" -v

    # Check backup was created
    local backup_count
    backup_count=$(ls -1 "$TEST_BACKUP_DIR"/*.tar.gz 2>/dev/null | wc -l)

    [[ $backup_count -ge 1 ]]
}

test_backup_manifest() {
    # Test that manifest is created
    local manifest_file
    manifest_file=$(ls -1 "$TEST_BACKUP_DIR"/*.manifest.json 2>/dev/null | head -1)

    [[ -f "$manifest_file" ]] || return 1

    # Verify manifest is valid JSON
    if command -v jq &>/dev/null; then
        jq '.' "$manifest_file" > /dev/null 2>&1
    else
        # Basic check - file exists and is not empty
        [[ -s "$manifest_file" ]]
    fi
}

test_list_backups() {
    # Test listing backups
    "${SCRIPT_DIR}/restore.sh" -c "$TEST_CONFIG" -l 2>&1 | grep -q "test-full"
}

test_restore_dry_run() {
    # Test restore in dry-run mode
    "${SCRIPT_DIR}/restore.sh" -c "$TEST_CONFIG" -d -L 2>&1 | grep -q "DRY RUN"
}

test_full_restore() {
    # Test full restore operation
    "${SCRIPT_DIR}/restore.sh" -c "$TEST_CONFIG" -t "$TEST_RESTORE_DIR" -L -v

    # Verify restored files exist
    local source_name
    source_name=$(echo "$TEST_SOURCE_DIR" | tr '/' '_' | sed 's/^_//')

    [[ -d "${TEST_RESTORE_DIR}/sources/${source_name}" ]] || return 1

    # Check file contents match
    local original restored
    original=$(cat "$TEST_SOURCE_DIR/file1.txt")
    restored=$(cat "${TEST_RESTORE_DIR}/sources/${source_name}/file1.txt" 2>/dev/null || echo "not found")

    [[ "$original" == "$restored" ]]
}

test_controller_status() {
    # Test FSM controller status command
    local output
    output=$("${SCRIPT_DIR}/fsm-controller.sh" -c "$TEST_CONFIG" status)

    echo "$output" | grep -q '"status": "success"'
}

test_controller_list() {
    # Test FSM controller list command
    local output
    output=$("${SCRIPT_DIR}/fsm-controller.sh" -c "$TEST_CONFIG" list)

    echo "$output" | grep -q '"backups":'
}

test_controller_explain() {
    # Test FSM controller explain command
    local output
    output=$("${SCRIPT_DIR}/fsm-controller.sh" -c "$TEST_CONFIG" explain backup)

    echo "$output" | grep -q '"steps":'
}

test_controller_validate() {
    # Test FSM controller validate command
    local output
    output=$("${SCRIPT_DIR}/fsm-controller.sh" -c "$TEST_CONFIG" validate)

    # Should pass validation with test config
    echo "$output" | grep -q '"valid": true'
}

test_controller_lock() {
    # Test FSM controller lock command
    local output
    output=$("${SCRIPT_DIR}/fsm-controller.sh" -c "$TEST_CONFIG" lock)

    echo "$output" | grep -q '"locked":'
}

# ============================================
# Edge Case and Failure Scenario Tests
# ============================================

test_atomic_write() {
    # Test atomic write operations
    source "${BACKUP_SYSTEM_DIR}/lib/common.sh"
    load_config "$TEST_CONFIG"

    local test_file="${TEST_DIR}/atomic_test.txt"
    local content="Test atomic content"

    atomic_write "$test_file" "$content" || return 1

    [[ -f "$test_file" ]] || return 1
    [[ "$(cat "$test_file")" == "$content" ]]
}

test_atomic_copy() {
    # Test atomic copy with verification
    source "${BACKUP_SYSTEM_DIR}/lib/common.sh"
    load_config "$TEST_CONFIG"

    local source_file="${TEST_DIR}/source_atomic.txt"
    local target_file="${TEST_DIR}/target_atomic.txt"

    echo "Source content for atomic copy" > "$source_file"

    atomic_copy "$source_file" "$target_file" "true" || return 1

    [[ -f "$target_file" ]] || return 1

    # Verify content matches
    local src_content tgt_content
    src_content=$(cat "$source_file")
    tgt_content=$(cat "$target_file")
    [[ "$src_content" == "$tgt_content" ]]
}

test_retry_mechanism() {
    # Test retry with backoff (should succeed on first try)
    source "${BACKUP_SYSTEM_DIR}/lib/common.sh"
    load_config "$TEST_CONFIG"

    # Command that succeeds
    retry_with_backoff 3 1 true
}

test_safe_restore_target() {
    # Test that dangerous paths are rejected
    source "${BACKUP_SYSTEM_DIR}/lib/common.sh"
    load_config "$TEST_CONFIG"

    # Root should be unsafe
    if is_safe_restore_target "/"; then
        return 1
    fi

    # /bin should be unsafe
    if is_safe_restore_target "/bin"; then
        return 1
    fi

    # /tmp should be safe
    if ! is_safe_restore_target "/tmp/restore-test"; then
        return 1
    fi

    # Home directory should be safe
    if ! is_safe_restore_target "$HOME/restore-test"; then
        return 1
    fi

    return 0
}

test_concurrent_lock_prevention() {
    # Test that concurrent operations are prevented
    source "${BACKUP_SYSTEM_DIR}/lib/common.sh"
    source "${BACKUP_SYSTEM_DIR}/lib/lock.sh"
    load_config "$TEST_CONFIG"

    # Acquire lock
    lock_acquire "test-concurrent" || return 1

    # Try to acquire again (should fail)
    local second_attempt_failed=false
    if ! lock_acquire "test-concurrent" 2>/dev/null; then
        second_attempt_failed=true
    fi

    # Release lock
    lock_release

    [[ "$second_attempt_failed" == "true" ]]
}

test_missing_source_handling() {
    # Test behavior when backup source doesn't exist
    source "${BACKUP_SYSTEM_DIR}/lib/common.sh"
    load_config "$TEST_CONFIG"

    # Backup a non-existent directory should warn but not crash
    export BACKUP_DIRS="/nonexistent/path/12345"
    export BACKUP_FILES=""

    # This should fail gracefully (no sources)
    ! "${SCRIPT_DIR}/backup.sh" -c "$TEST_CONFIG" -d 2>&1 | grep -q "FATAL"
}

test_storage_verification() {
    # Test storage upload verification
    source "${BACKUP_SYSTEM_DIR}/lib/common.sh"
    source "${BACKUP_SYSTEM_DIR}/lib/storage.sh"
    load_config "$TEST_CONFIG"

    # Create a test file
    local test_file="${TEST_DIR}/verify_test.txt"
    echo "Verification test content" > "$test_file"

    # Upload to local storage
    storage_upload_local "$test_file" "verify_test.txt" || return 1

    # Verify it exists
    storage_verify_upload "verify_test.txt"
}

test_config_validation() {
    # Test configuration validation catches missing config
    source "${BACKUP_SYSTEM_DIR}/lib/common.sh"
    load_config "$TEST_CONFIG"

    # With valid config, should pass
    export BACKUP_DIRS="$TEST_SOURCE_DIR"
    export STORAGE_TYPE="local"
    export ENCRYPTION_ENABLED="false"

    validate_config
}

test_checksum_integrity() {
    # Test checksum detects file corruption
    source "${BACKUP_SYSTEM_DIR}/lib/common.sh"
    load_config "$TEST_CONFIG"

    local test_file="${TEST_DIR}/checksum_integrity.txt"
    echo "Original content" > "$test_file"

    # Calculate original checksum
    local original_checksum
    original_checksum=$(calculate_checksum "$test_file")

    # Modify file
    echo "Modified content" > "$test_file"

    # New checksum should be different
    local modified_checksum
    modified_checksum=$(calculate_checksum "$test_file")

    [[ "$original_checksum" != "$modified_checksum" ]]
}

# ============================================
# Test Runner
# ============================================

run_all_tests() {
    echo ""
    echo "============================================"
    echo "Murray's FSM Backup System - Test Suite"
    echo "============================================"
    echo ""

    # Setup
    setup_test_environment

    # Configuration tests
    run_test "Configuration loads correctly" test_config_loads
    run_test "FSM initializes properly" test_fsm_init
    run_test "FSM state transitions work" test_fsm_transitions
    run_test "Lock acquire/release works" test_lock_acquire_release
    run_test "Checksum calculation works" test_checksum_calculation

    # Backup tests
    run_test "Backup dry-run mode works" test_backup_dry_run
    run_test "Full backup completes" test_full_backup
    run_test "Backup manifest created" test_backup_manifest

    # Restore tests
    run_test "List backups works" test_list_backups
    run_test "Restore dry-run mode works" test_restore_dry_run
    run_test "Full restore completes" test_full_restore

    # Controller tests
    run_test "Controller status command" test_controller_status
    run_test "Controller list command" test_controller_list
    run_test "Controller explain command" test_controller_explain
    run_test "Controller validate command" test_controller_validate
    run_test "Controller lock command" test_controller_lock

    # Edge case and failure scenario tests
    run_test "Atomic write operations work" test_atomic_write
    run_test "Atomic copy with verification works" test_atomic_copy
    run_test "Retry mechanism works" test_retry_mechanism
    run_test "Dangerous restore paths rejected" test_safe_restore_target
    run_test "Concurrent lock prevention works" test_concurrent_lock_prevention
    run_test "Storage verification works" test_storage_verification
    run_test "Configuration validation works" test_config_validation
    run_test "Checksum detects corruption" test_checksum_integrity

    # Cleanup
    cleanup_test_environment

    # Summary
    echo ""
    echo "============================================"
    echo "Test Results"
    echo "============================================"
    echo "Total:  $TESTS_RUN"
    echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
    echo "============================================"
    echo ""

    # Return appropriate exit code
    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}All tests passed!${NC}"
        return 0
    else
        echo -e "${RED}Some tests failed.${NC}"
        return 1
    fi
}

# ============================================
# Main
# ============================================

main() {
    case "${1:-all}" in
        all)
            run_all_tests
            ;;
        setup)
            setup_test_environment
            ;;
        cleanup)
            cleanup_test_environment
            ;;
        *)
            echo "Usage: $(basename "$0") [all|setup|cleanup]"
            exit 1
            ;;
    esac
}

main "$@"
