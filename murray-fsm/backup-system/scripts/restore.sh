#!/bin/bash
# Murray's FSM - Restore Script
# ==============================
# FSM-based restore with idempotent operations and integrity verification

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

# Globals
BACKUP_SOURCE=""
WORK_DIR=""
MANIFEST_FILE=""
RESTORE_TARGET=""
ARCHIVE_FILE=""
IS_ENCRYPTED=false

# Show usage
usage() {
    cat << EOF
Murray's FSM Restore System
===========================

Usage: $(basename "$0") [OPTIONS] [BACKUP_SOURCE]

Arguments:
    BACKUP_SOURCE         Backup file or name (optional, uses latest if omitted)

Options:
    -c, --config FILE     Config file (default: config/backup.conf)
    -t, --target DIR      Restore target directory (default: original location)
    -l, --list            List available backups
    -L, --latest          Use latest backup
    -e, --env-only        Only restore environment (skip files)
    -f, --files-only      Only restore files (skip environment)
    -r, --resume          Resume from last state
    -d, --dry-run         Show what would be done
    -v, --verbose         Verbose output
    -h, --help            Show this help

Examples:
    $(basename "$0")                              # Restore latest backup
    $(basename "$0") backup-2024-01-15.tar.gz    # Restore specific backup
    $(basename "$0") -l                           # List backups
    $(basename "$0") -t /tmp/restore             # Restore to specific directory
    $(basename "$0") -e                           # Restore only environment

EOF
}

# List available backups
list_backups() {
    log_info "Available backups:"
    echo ""

    local count=0
    while IFS= read -r backup; do
        [[ -z "$backup" ]] && continue
        echo "  - $backup"
        ((count++)) || true
    done < <(storage_list "${BACKUP_PREFIX:-backup}")

    if [[ $count -eq 0 ]]; then
        echo "  (no backups found)"
    fi
    echo ""
    echo "Total: $count backups"
}

# Parse arguments
parse_args() {
    local config_file="${BACKUP_SYSTEM_DIR}/config/backup.conf"
    local list_mode=false
    local use_latest=false
    local resume=false
    local dry_run=false

    export RESTORE_ENV=true
    export RESTORE_FILES=true

    while [[ $# -gt 0 ]]; do
        case $1 in
            -c|--config)
                config_file="$2"
                shift 2
                ;;
            -t|--target)
                RESTORE_TARGET="$2"
                shift 2
                ;;
            -l|--list)
                list_mode=true
                shift
                ;;
            -L|--latest)
                use_latest=true
                shift
                ;;
            -e|--env-only)
                export RESTORE_ENV=true
                export RESTORE_FILES=false
                shift
                ;;
            -f|--files-only)
                export RESTORE_ENV=false
                export RESTORE_FILES=true
                shift
                ;;
            -r|--resume)
                resume=true
                shift
                ;;
            -d|--dry-run)
                dry_run=true
                shift
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
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
            *)
                BACKUP_SOURCE="$1"
                shift
                ;;
        esac
    done

    # Load configuration
    load_config "$config_file"

    # Handle list mode
    if [[ "$list_mode" == "true" ]]; then
        list_backups
        exit 0
    fi

    # Handle latest mode
    if [[ "$use_latest" == "true" || -z "$BACKUP_SOURCE" ]]; then
        BACKUP_SOURCE=$(storage_get_latest) || {
            log_error "No backups found"
            exit 1
        }
        log_info "Using latest backup: $BACKUP_SOURCE"
    fi

    # Initialize FSM
    fsm_init

    # Handle resume
    if [[ "$resume" == "true" ]]; then
        local current_state
        current_state=$(fsm_get_state)
        if [[ "$current_state" == restore_* ]]; then
            log_info "Resuming restore from state: $current_state"
        else
            log_info "No restore to resume, starting fresh"
            fsm_set_state "idle"
        fi
    fi

    export DRY_RUN="$dry_run"
}

# Initialize restore
restore_init() {
    log_state "Initializing restore"

    # Generate work directory
    local timestamp
    timestamp=$(generate_timestamp)
    WORK_DIR="${TEMP_DIR:-/tmp}/restore-${timestamp}"

    mkdir -p "$WORK_DIR"

    log_info "Backup source: $BACKUP_SOURCE"
    log_info "Work directory: $WORK_DIR"

    # Determine restore target
    if [[ -z "$RESTORE_TARGET" ]]; then
        RESTORE_TARGET="/"
        log_info "Restore target: original locations"
    else
        mkdir -p "$RESTORE_TARGET"
        log_info "Restore target: $RESTORE_TARGET"
    fi

    # Check if backup is encrypted
    if [[ "$BACKUP_SOURCE" == *.enc ]]; then
        IS_ENCRYPTED=true
        log_info "Backup is encrypted"
    fi

    fsm_transition "download"
}

# Download backup
download() {
    log_state "Downloading backup"

    if [[ "${DRY_RUN:-false}" == "true" ]]; then
        log_info "[DRY RUN] Would download: $BACKUP_SOURCE"
        fsm_transition "verify_download"
        return 0
    fi

    # Determine archive filename
    local archive_name
    if [[ "$BACKUP_SOURCE" == /* || "$BACKUP_SOURCE" == s3://* || "$BACKUP_SOURCE" == gs://* ]]; then
        archive_name=$(basename "$BACKUP_SOURCE")
    else
        archive_name="$BACKUP_SOURCE"
    fi

    ARCHIVE_FILE="${WORK_DIR}/${archive_name}"

    log_info "Downloading to: $ARCHIVE_FILE"

    if fsm_execute_with_retry "storage_download \"$BACKUP_SOURCE\" \"$ARCHIVE_FILE\""; then
        log_info "Download complete"

        # Also download manifest if available
        local manifest_name="${archive_name%.tar*}.manifest.json"
        manifest_name="${manifest_name%.enc}"
        MANIFEST_FILE="${WORK_DIR}/${manifest_name}"

        storage_download "${manifest_name}" "$MANIFEST_FILE" 2>/dev/null || {
            log_debug "Manifest not found, will extract from archive"
            MANIFEST_FILE=""
        }
    else
        log_error "Download failed after retries"
        fsm_set_error "Download failed" "recoverable"
        return 1
    fi

    fsm_transition "verify_download"
}

# Verify downloaded backup
verify_download() {
    log_state "Verifying download"

    if [[ "${DRY_RUN:-false}" == "true" ]]; then
        log_info "[DRY RUN] Would verify download"
        fsm_transition "decrypt"
        return 0
    fi

    if [[ ! -f "$ARCHIVE_FILE" ]]; then
        log_error "Archive file not found: $ARCHIVE_FILE"
        fsm_set_error "Archive file missing" "recoverable"
        return 1
    fi

    local file_size
    file_size=$(get_file_size "$ARCHIVE_FILE")
    log_info "Archive size: $(format_size "$file_size")"

    # Verify checksum if manifest available
    if [[ -n "$MANIFEST_FILE" && -f "$MANIFEST_FILE" ]]; then
        if command -v jq &>/dev/null; then
            local expected_checksum
            local algo
            expected_checksum=$(jq -r '.checksums.archive.value // empty' "$MANIFEST_FILE")
            algo=$(jq -r '.checksums.archive.algorithm // "sha256"' "$MANIFEST_FILE")

            if [[ -n "$expected_checksum" ]]; then
                export CHECKSUM_ALGORITHM="$algo"
                local actual_checksum
                actual_checksum=$(calculate_checksum "$ARCHIVE_FILE")

                if [[ "$actual_checksum" == "$expected_checksum" ]]; then
                    log_info "Checksum verified ($algo)"
                else
                    log_error "Checksum mismatch!"
                    log_error "Expected: $expected_checksum"
                    log_error "Actual:   $actual_checksum"
                    fsm_set_error "Checksum verification failed" "fatal"
                    return 1
                fi
            fi
        fi
    else
        log_warn "No manifest found, skipping checksum verification"
    fi

    fsm_transition "decrypt"
}

# Decrypt backup
decrypt() {
    log_state "Decrypting backup"

    if [[ "$IS_ENCRYPTED" != "true" ]]; then
        log_info "Backup is not encrypted"
        fsm_transition "decompress"
        return 0
    fi

    if [[ "${DRY_RUN:-false}" == "true" ]]; then
        log_info "[DRY RUN] Would decrypt archive"
        fsm_transition "decompress"
        return 0
    fi

    if [[ -z "${ENCRYPTION_KEY:-}" && -z "${ENCRYPTION_KEY_FILE:-}" ]]; then
        log_error "No encryption key configured"
        fsm_set_error "Encryption key required" "fatal"
        return 1
    fi

    local decrypted_file="${ARCHIVE_FILE%.enc}"

    if decrypt_file "$ARCHIVE_FILE" "$decrypted_file"; then
        rm -f "$ARCHIVE_FILE"
        ARCHIVE_FILE="$decrypted_file"
        log_info "Archive decrypted: $ARCHIVE_FILE"
    else
        log_error "Decryption failed"
        fsm_set_error "Decryption failed" "fatal"
        return 1
    fi

    fsm_transition "decompress"
}

# Decompress backup
decompress() {
    log_state "Decompressing backup"

    if [[ "${DRY_RUN:-false}" == "true" ]]; then
        log_info "[DRY RUN] Would decompress: $ARCHIVE_FILE"
        fsm_transition "restore_apply"
        return 0
    fi

    local extract_dir="${WORK_DIR}/extracted"
    mkdir -p "$extract_dir"

    log_info "Extracting to: $extract_dir"

    local tar_opts="-xf"

    # Detect compression from extension
    case "$ARCHIVE_FILE" in
        *.tar.gz|*.tgz)
            tar_opts="-xzf"
            ;;
        *.tar.bz2)
            tar_opts="-xjf"
            ;;
        *.tar.xz)
            tar_opts="-xJf"
            ;;
        *.tar.zst)
            if command -v zstd &>/dev/null; then
                zstd -d "$ARCHIVE_FILE" -o "${ARCHIVE_FILE%.zst}"
                ARCHIVE_FILE="${ARCHIVE_FILE%.zst}"
            else
                log_error "zstd not available"
                fsm_set_error "zstd required for decompression" "fatal"
                return 1
            fi
            ;;
    esac

    tar $tar_opts "$ARCHIVE_FILE" -C "$extract_dir" || {
        log_error "Extraction failed"
        fsm_set_error "Archive extraction failed" "fatal"
        return 1
    }

    # Find manifest if not already loaded
    if [[ -z "$MANIFEST_FILE" || ! -f "$MANIFEST_FILE" ]]; then
        local found_manifest
        found_manifest=$(find "$extract_dir" -name "manifest.json" -type f | head -1)
        if [[ -n "$found_manifest" ]]; then
            MANIFEST_FILE="$found_manifest"
            log_info "Found manifest in archive"
        fi
    fi

    export EXTRACT_DIR="$extract_dir"
    log_info "Extraction complete"

    fsm_transition "restore_apply"
}

# Apply restored files
restore_apply() {
    log_state "Applying restored files"

    if [[ "${RESTORE_FILES:-true}" != "true" ]]; then
        log_info "File restoration skipped (env-only mode)"
        fsm_transition "restore_environment"
        return 0
    fi

    if [[ "${DRY_RUN:-false}" == "true" ]]; then
        log_info "[DRY RUN] Would restore files to: $RESTORE_TARGET"
        fsm_transition "restore_environment"
        return 0
    fi

    local sources_dir="${EXTRACT_DIR}/sources"

    if [[ ! -d "$sources_dir" ]]; then
        log_warn "No sources directory found in backup"
        fsm_transition "restore_environment"
        return 0
    fi

    log_info "Restoring files..."

    # Process each source directory
    for source_dir in "$sources_dir"/*/; do
        [[ -d "$source_dir" ]] || continue

        local dir_name
        dir_name=$(basename "$source_dir")

        # Convert back to original path
        local original_path
        original_path=$(echo "$dir_name" | tr '_' '/')

        local target_path
        if [[ "$RESTORE_TARGET" == "/" ]]; then
            target_path="/$original_path"
        else
            target_path="${RESTORE_TARGET}/${original_path}"
        fi

        log_info "Restoring: $dir_name -> $target_path"

        # Create target directory
        mkdir -p "$target_path"

        # Idempotent restore using rsync
        rsync -a --backup --suffix=".bak-$(date +%Y%m%d%H%M%S)" \
            "$source_dir" "$target_path/" || {
            log_warn "Failed to restore: $dir_name"
        }
    done

    # Restore individual files
    local files_dir="${EXTRACT_DIR}/sources/files"
    if [[ -d "$files_dir" ]]; then
        log_info "Restoring individual files..."

        for file in "$files_dir"/*; do
            [[ -f "$file" ]] || continue

            local filename
            filename=$(basename "$file")

            # Determine target from manifest if available
            local target_file="${RESTORE_TARGET}/${filename}"

            if [[ -n "$MANIFEST_FILE" && -f "$MANIFEST_FILE" ]] && command -v jq &>/dev/null; then
                local original_path
                original_path=$(jq -r --arg name "$filename" \
                    '.sources[] | select(.type == "file" and (.path | endswith($name))) | .path' \
                    "$MANIFEST_FILE" | head -1)
                if [[ -n "$original_path" ]]; then
                    if [[ "$RESTORE_TARGET" == "/" ]]; then
                        target_file="$original_path"
                    else
                        target_file="${RESTORE_TARGET}${original_path}"
                    fi
                fi
            fi

            log_info "Restoring file: $filename -> $target_file"

            # Create backup of existing file
            if [[ -f "$target_file" ]]; then
                cp "$target_file" "${target_file}.bak-$(date +%Y%m%d%H%M%S)"
            fi

            mkdir -p "$(dirname "$target_file")"
            cp "$file" "$target_file"
        done
    fi

    fsm_transition "restore_environment"
}

# Restore environment
restore_environment() {
    log_state "Restoring environment"

    if [[ "${RESTORE_ENV:-true}" != "true" ]]; then
        log_info "Environment restoration skipped (files-only mode)"
        fsm_transition "restore_verify"
        return 0
    fi

    if [[ "${DRY_RUN:-false}" == "true" ]]; then
        log_info "[DRY RUN] Would restore environment"
        fsm_transition "restore_verify"
        return 0
    fi

    local env_script="${EXTRACT_DIR}/environment.sh"

    if [[ ! -f "$env_script" ]]; then
        log_warn "No environment script found in backup"
        fsm_transition "restore_verify"
        return 0
    fi

    log_info "Environment restoration script found: $env_script"

    # Copy environment script to a permanent location
    local env_target="${RESTORE_TARGET}/environment-restore.sh"
    if [[ "$RESTORE_TARGET" == "/" ]]; then
        env_target="${HOME}/environment-restore.sh"
    fi

    cp "$env_script" "$env_target"
    chmod +x "$env_target"

    log_info "Environment script copied to: $env_target"
    log_info "Run 'bash $env_target' to restore environment packages"

    # Optionally auto-run if requested
    if [[ "${AUTO_RESTORE_ENV:-false}" == "true" ]]; then
        log_info "Auto-restoring environment..."
        bash "$env_script" || {
            log_warn "Environment restoration had some errors"
        }
    fi

    # Restore Python requirements if available
    local requirements="${EXTRACT_DIR}/requirements.txt"
    if [[ -f "$requirements" ]]; then
        local req_target="${RESTORE_TARGET}/requirements.txt"
        [[ "$RESTORE_TARGET" == "/" ]] && req_target="${HOME}/requirements.txt"
        cp "$requirements" "$req_target"
        log_info "Python requirements saved to: $req_target"
    fi

    fsm_transition "restore_verify"
}

# Verify restoration
restore_verify() {
    log_state "Verifying restoration"

    if [[ "${DRY_RUN:-false}" == "true" ]]; then
        log_info "[DRY RUN] Would verify restoration"
        fsm_transition "cleanup_restore"
        return 0
    fi

    local verified=0
    local failed=0

    # Verify restored files if manifest available
    if [[ -n "$MANIFEST_FILE" && -f "$MANIFEST_FILE" ]] && command -v jq &>/dev/null; then
        log_info "Verifying restored files..."

        while IFS= read -r source; do
            [[ -z "$source" ]] && continue

            local path type
            path=$(echo "$source" | jq -r '.path')
            type=$(echo "$source" | jq -r '.type')

            local check_path
            if [[ "$RESTORE_TARGET" == "/" ]]; then
                check_path="$path"
            else
                check_path="${RESTORE_TARGET}${path}"
            fi

            if [[ "$type" == "directory" ]]; then
                if [[ -d "$check_path" ]]; then
                    ((verified++)) || true
                    log_debug "Verified directory: $check_path"
                else
                    ((failed++)) || true
                    log_warn "Directory not found: $check_path"
                fi
            elif [[ "$type" == "file" ]]; then
                if [[ -f "$check_path" ]]; then
                    ((verified++)) || true
                    log_debug "Verified file: $check_path"
                else
                    ((failed++)) || true
                    log_warn "File not found: $check_path"
                fi
            fi
        done < <(jq -c '.sources[]' "$MANIFEST_FILE" 2>/dev/null)

        log_info "Verification: $verified passed, $failed failed"
    else
        log_info "Verification skipped (no manifest)"
    fi

    if [[ $failed -gt 0 ]]; then
        log_warn "Some files could not be verified"
    fi

    fsm_transition "cleanup_restore"
}

# Cleanup after restore
cleanup_restore() {
    log_state "Cleaning up"

    if [[ "${DRY_RUN:-false}" == "true" ]]; then
        log_info "[DRY RUN] Would clean up work directory"
        fsm_transition "restore_done"
        return 0
    fi

    # Keep work directory if KEEP_RESTORE_TEMP is set
    if [[ "${KEEP_RESTORE_TEMP:-false}" != "true" ]]; then
        if [[ -n "$WORK_DIR" && -d "$WORK_DIR" ]]; then
            rm -rf "$WORK_DIR"
            log_info "Cleaned up work directory"
        fi
    else
        log_info "Work directory preserved: $WORK_DIR"
    fi

    fsm_transition "restore_done"
}

# Restore complete
restore_done() {
    log_state "Restore complete"

    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - START_TIME))

    log_info "================================================"
    log_info "Restore completed successfully!"
    log_info "Source: $BACKUP_SOURCE"
    log_info "Target: $RESTORE_TARGET"
    log_info "Duration: ${duration}s"
    log_info "================================================"

    # Provide next steps
    if [[ "${RESTORE_ENV:-true}" == "true" ]]; then
        local env_target="${HOME}/environment-restore.sh"
        [[ "$RESTORE_TARGET" != "/" ]] && env_target="${RESTORE_TARGET}/environment-restore.sh"
        if [[ -f "$env_target" ]]; then
            echo ""
            log_info "To restore environment packages, run:"
            log_info "  bash $env_target"
        fi
    fi

    # Send notification
    send_notification "Restore Complete" "Restore from $BACKUP_SOURCE completed in ${duration}s"

    fsm_set_state "idle"
}

# Main restore loop
run_restore() {
    local state

    while true; do
        state=$(fsm_get_state)

        case "$state" in
            idle)
                restore_init
                ;;
            restore_init)
                # Handled in restore_init function
                ;;
            download)
                # Handled by transition
                ;;
            verify_download)
                # Handled by transition
                ;;
            decrypt)
                # Handled by transition
                ;;
            decompress)
                # Handled by transition
                ;;
            restore_apply)
                # Handled by transition
                ;;
            restore_environment)
                # Handled by transition
                ;;
            restore_verify)
                # Handled by transition
                ;;
            cleanup_restore)
                # Handled by transition
                ;;
            restore_done)
                return 0
                ;;
            error|error_recoverable)
                log_error "Restore failed in error state"
                local error_msg
                error_msg=$(fsm_get_error)
                log_error "Error: $error_msg"
                return 1
                ;;
            error_fatal)
                log_error "Fatal error occurred, cannot continue"
                return 2
                ;;
            *)
                log_error "Unknown state: $state"
                return 1
                ;;
        esac
    done
}

# Main entry point
main() {
    START_TIME=$(date +%s)

    log_info "Murray's FSM Restore System"
    log_info "==========================="

    parse_args "$@"

    # Check dependencies
    check_dependencies || exit 1

    # Run restore
    if run_restore; then
        exit 0
    else
        exit 1
    fi
}

# Run main if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
