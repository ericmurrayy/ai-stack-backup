#!/bin/bash
# Murray's FSM - Backup Script
# ============================
# FSM-based backup with state management, checksums, and multi-backend storage

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
# shellcheck source=../lib/lock.sh
source "${LIB_DIR}/lock.sh"
# shellcheck source=../lib/services.sh
source "${LIB_DIR}/services.sh"
# shellcheck source=../lib/notify.sh
source "${LIB_DIR}/notify.sh"

# Globals
BACKUP_NAME=""
WORK_DIR=""
MANIFEST_FILE=""
SOURCES_DIR=""
ENV_FILE=""
ARCHIVE_FILE=""

# Show usage
usage() {
    cat << EOF
Murray's FSM Backup System
==========================

Usage: $(basename "$0") [OPTIONS]

Options:
    -c, --config FILE     Config file (default: config/backup.conf)
    -n, --name NAME       Backup name prefix (default: backup)
    -o, --output DIR      Output directory (default: from config)
    -r, --resume          Resume from last state
    -d, --dry-run         Show what would be done
    -v, --verbose         Verbose output
    -h, --help            Show this help

Examples:
    $(basename "$0")                          # Standard backup
    $(basename "$0") -n weekly               # Named backup
    $(basename "$0") -r                       # Resume interrupted backup
    $(basename "$0") -c custom.conf          # Use custom config

EOF
}

# Parse arguments
parse_args() {
    local config_file="${BACKUP_SYSTEM_DIR}/config/backup.conf"
    local resume=false
    local dry_run=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            -c|--config)
                config_file="$2"
                shift 2
                ;;
            -n|--name)
                export BACKUP_PREFIX="$2"
                shift 2
                ;;
            -o|--output)
                export LOCAL_BACKUP_DIR="$2"
                shift 2
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
            *)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done

    # Load configuration
    load_config "$config_file"

    # Initialize FSM
    fsm_init

    # Handle resume
    if [[ "$resume" == "true" ]]; then
        local current_state
        current_state=$(fsm_get_state)
        if [[ "$current_state" != "idle" && "$current_state" != "backup_done" ]]; then
            log_info "Resuming backup from state: $current_state"
        else
            log_info "No backup to resume, starting fresh"
            fsm_set_state "idle"
        fi
    fi

    export DRY_RUN="$dry_run"
}

# Initialize backup
backup_init() {
    log_state "Initializing backup"

    # Generate backup name with timestamp
    local timestamp
    timestamp=$(generate_timestamp)
    BACKUP_NAME="${BACKUP_PREFIX:-backup}-${timestamp}"

    # Create work directory
    WORK_DIR="${TEMP_DIR:-/tmp}/${BACKUP_NAME}"
    SOURCES_DIR="${WORK_DIR}/sources"
    MANIFEST_FILE="${WORK_DIR}/manifest.json"
    ENV_FILE="${WORK_DIR}/environment.sh"

    mkdir -p "$SOURCES_DIR"

    log_info "Backup name: $BACKUP_NAME"
    log_info "Work directory: $WORK_DIR"

    # Initialize manifest
    cat > "$MANIFEST_FILE" << EOF
{
    "backup_name": "$BACKUP_NAME",
    "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "hostname": "$(hostname)",
    "os": "$(detect_os)",
    "version": "1.0.0",
    "sources": [],
    "checksums": {},
    "environment": {}
}
EOF

    fsm_transition "collect_sources"
}

# Collect backup sources
collect_sources() {
    log_state "Collecting backup sources"

    local collected=0
    local failed=0

    # Process backup directories
    if [[ -n "${BACKUP_DIRS:-}" ]]; then
        for dir in $BACKUP_DIRS; do
            if [[ -d "$dir" ]]; then
                log_info "Collecting directory: $dir"

                local target_name
                target_name=$(echo "$dir" | tr '/' '_' | sed 's/^_//')

                # Build rsync exclude args
                local exclude_args=""
                for pattern in ${EXCLUDE_PATTERNS:-}; do
                    exclude_args+=" --exclude=$pattern"
                done

                # Copy with rsync for efficiency
                if [[ "${DRY_RUN:-false}" != "true" ]]; then
                    rsync -a $exclude_args "$dir/" "${SOURCES_DIR}/${target_name}/" 2>/dev/null || {
                        log_warn "Failed to collect directory: $dir"
                        ((failed++)) || true
                        continue
                    }
                fi

                ((collected++)) || true

                # Update manifest
                update_manifest_source "$dir" "directory"
            else
                log_warn "Directory not found: $dir"
                ((failed++)) || true
            fi
        done
    fi

    # Process backup files
    if [[ -n "${BACKUP_FILES:-}" ]]; then
        for file in $BACKUP_FILES; do
            if [[ -f "$file" ]]; then
                log_info "Collecting file: $file"

                local target_dir="${SOURCES_DIR}/files"
                mkdir -p "$target_dir"

                if [[ "${DRY_RUN:-false}" != "true" ]]; then
                    cp "$file" "$target_dir/" || {
                        log_warn "Failed to collect file: $file"
                        ((failed++)) || true
                        continue
                    }
                fi

                ((collected++)) || true
                update_manifest_source "$file" "file"
            else
                log_warn "File not found: $file"
                ((failed++)) || true
            fi
        done
    fi

    log_info "Collected $collected sources ($failed failed)"

    if [[ $collected -eq 0 ]]; then
        log_error "No sources collected"
        fsm_set_error "No backup sources found" "recoverable"
        return 1
    fi

    fsm_transition "capture_environment"
}

# Update manifest with source
update_manifest_source() {
    local source="$1"
    local type="$2"

    [[ "${DRY_RUN:-false}" == "true" ]] && return 0

    local tmp_manifest="${MANIFEST_FILE}.tmp"

    # Using jq if available, otherwise use simple append
    if command -v jq &>/dev/null; then
        jq --arg src "$source" --arg type "$type" \
            '.sources += [{"path": $src, "type": $type}]' \
            "$MANIFEST_FILE" > "$tmp_manifest" && mv "$tmp_manifest" "$MANIFEST_FILE"
    else
        # Fallback: simple text manipulation
        sed -i 's/"sources": \[\]/"sources": [{"path": "'"$source"'", "type": "'"$type"'"}]/' "$MANIFEST_FILE" 2>/dev/null || true
    fi
}

# Capture environment
capture_environment() {
    log_state "Capturing environment"

    [[ "${CAPTURE_ENVIRONMENT:-true}" != "true" ]] && {
        log_info "Environment capture disabled"
        fsm_transition "compress"
        return 0
    }

    if [[ "${DRY_RUN:-false}" == "true" ]]; then
        log_info "[DRY RUN] Would capture environment"
        fsm_transition "compress"
        return 0
    fi

    cat > "$ENV_FILE" << 'EOF'
#!/bin/bash
# Murray's FSM - Environment Restoration Script
# Generated automatically during backup
# Run this script to restore the captured environment

set -euo pipefail

echo "Restoring environment..."

EOF

    # Capture system info
    {
        echo "# System Information"
        echo "# Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
        echo "export BACKUP_HOSTNAME=\"$(hostname)\""
        echo "export BACKUP_OS=\"$(detect_os)\""
        echo "export BACKUP_KERNEL=\"$(uname -r)\""
        echo ""
    } >> "$ENV_FILE"

    # Capture Python packages
    if command -v pip &>/dev/null || command -v pip3 &>/dev/null; then
        log_info "Capturing Python packages"
        local pip_cmd="pip"
        command -v pip3 &>/dev/null && pip_cmd="pip3"

        {
            echo "# Python packages"
            echo "install_python_packages() {"
            echo "    $pip_cmd install -q \\"
            $pip_cmd freeze 2>/dev/null | while read -r pkg; do
                echo "        \"$pkg\" \\"
            done
            echo "        || true"
            echo "}"
            echo ""
        } >> "$ENV_FILE"

        # Save requirements separately
        $pip_cmd freeze > "${WORK_DIR}/requirements.txt" 2>/dev/null || true
    fi

    # Capture Node.js version and global packages
    if command -v node &>/dev/null; then
        log_info "Capturing Node.js info"

        {
            echo "# Node.js"
            echo "export NODE_VERSION=\"$(node --version 2>/dev/null || echo 'unknown')\""
            if command -v npm &>/dev/null; then
                echo "export NPM_VERSION=\"$(npm --version 2>/dev/null || echo 'unknown')\""
            fi
            echo ""
        } >> "$ENV_FILE"

        # Save global packages
        if command -v npm &>/dev/null; then
            npm list -g --depth=0 2>/dev/null > "${WORK_DIR}/npm-global.txt" || true
        fi
    fi

    # Capture system packages (Debian/Ubuntu)
    if command -v dpkg &>/dev/null; then
        log_info "Capturing system packages (dpkg)"

        {
            echo "# System packages (Debian/Ubuntu)"
            echo "restore_dpkg_selections() {"
            echo "    sudo dpkg --set-selections << 'SELECTIONS'"
            dpkg --get-selections 2>/dev/null
            echo "SELECTIONS"
            echo "    sudo apt-get -y dselect-upgrade"
            echo "}"
            echo ""
        } >> "$ENV_FILE"

        # Save selections separately
        dpkg --get-selections > "${WORK_DIR}/dpkg-selections.txt" 2>/dev/null || true
    fi

    # Capture homebrew packages (macOS)
    if command -v brew &>/dev/null; then
        log_info "Capturing Homebrew packages"

        {
            echo "# Homebrew packages"
            echo "restore_homebrew() {"
            echo "    brew install \\"
            brew list --formula 2>/dev/null | while read -r pkg; do
                echo "        \"$pkg\" \\"
            done
            echo "        || true"
            echo "}"
            echo ""
        } >> "$ENV_FILE"

        # Save Brewfile
        brew bundle dump --file="${WORK_DIR}/Brewfile" 2>/dev/null || true
    fi

    # Capture environment variables (filtered)
    {
        echo "# Environment variables"
        echo "restore_env_vars() {"
        env | grep -E '^(PATH|HOME|USER|SHELL|LANG|LC_|EDITOR|VISUAL|TERM)=' | while read -r var; do
            echo "    export $var"
        done
        echo "}"
        echo ""
    } >> "$ENV_FILE"

    # Capture current working directory structure
    if [[ -n "${PROJECT_ROOT:-}" && -d "${PROJECT_ROOT:-}" ]]; then
        log_info "Capturing project structure"
        {
            echo "# Project structure"
            echo "# Root: $PROJECT_ROOT"
            tree -L 3 "$PROJECT_ROOT" 2>/dev/null || find "$PROJECT_ROOT" -maxdepth 3 -type d 2>/dev/null || true
        } > "${WORK_DIR}/project-structure.txt"
    fi

    # Add restoration entry point
    cat >> "$ENV_FILE" << 'EOF'

# Main restoration function
restore_all() {
    echo "Starting full environment restoration..."

    if declare -f install_python_packages &>/dev/null; then
        echo "Installing Python packages..."
        install_python_packages
    fi

    if declare -f restore_homebrew &>/dev/null; then
        echo "Installing Homebrew packages..."
        restore_homebrew
    fi

    if declare -f restore_env_vars &>/dev/null; then
        echo "Restoring environment variables..."
        restore_env_vars
    fi

    echo "Environment restoration complete!"
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    restore_all
fi
EOF

    chmod +x "$ENV_FILE"
    log_info "Environment captured to: $ENV_FILE"

    fsm_transition "compress"
}

# Compress backup
compress() {
    log_state "Compressing backup"

    local compression="${COMPRESSION:-gzip}"
    local archive_ext

    case "$compression" in
        gzip)
            archive_ext="tar.gz"
            ;;
        bzip2)
            archive_ext="tar.bz2"
            ;;
        xz)
            archive_ext="tar.xz"
            ;;
        zstd)
            archive_ext="tar.zst"
            ;;
        none)
            archive_ext="tar"
            ;;
        *)
            log_warn "Unknown compression: $compression, using gzip"
            compression="gzip"
            archive_ext="tar.gz"
            ;;
    esac

    ARCHIVE_FILE="${WORK_DIR}/${BACKUP_NAME}.${archive_ext}"

    if [[ "${DRY_RUN:-false}" == "true" ]]; then
        log_info "[DRY RUN] Would create archive: $ARCHIVE_FILE"
        fsm_transition "encrypt"
        return 0
    fi

    log_info "Creating archive: $ARCHIVE_FILE"

    local tar_opts="-cf"
    case "$compression" in
        gzip)
            tar_opts="-czf"
            ;;
        bzip2)
            tar_opts="-cjf"
            ;;
        xz)
            tar_opts="-cJf"
            ;;
        zstd)
            if command -v zstd &>/dev/null; then
                tar -cf - -C "$WORK_DIR" sources environment.sh manifest.json \
                    requirements.txt npm-global.txt dpkg-selections.txt Brewfile project-structure.txt 2>/dev/null \
                    | zstd -o "$ARCHIVE_FILE"
            else
                log_warn "zstd not available, falling back to gzip"
                tar_opts="-czf"
                ARCHIVE_FILE="${WORK_DIR}/${BACKUP_NAME}.tar.gz"
            fi
            ;;
    esac

    # Create archive with available files
    if [[ "$compression" != "zstd" ]] || ! command -v zstd &>/dev/null; then
        local files_to_archive=()
        [[ -d "${WORK_DIR}/sources" ]] && files_to_archive+=("sources")
        [[ -f "${WORK_DIR}/environment.sh" ]] && files_to_archive+=("environment.sh")
        [[ -f "${WORK_DIR}/manifest.json" ]] && files_to_archive+=("manifest.json")
        [[ -f "${WORK_DIR}/requirements.txt" ]] && files_to_archive+=("requirements.txt")
        [[ -f "${WORK_DIR}/npm-global.txt" ]] && files_to_archive+=("npm-global.txt")
        [[ -f "${WORK_DIR}/dpkg-selections.txt" ]] && files_to_archive+=("dpkg-selections.txt")
        [[ -f "${WORK_DIR}/Brewfile" ]] && files_to_archive+=("Brewfile")
        [[ -f "${WORK_DIR}/project-structure.txt" ]] && files_to_archive+=("project-structure.txt")

        tar $tar_opts "$ARCHIVE_FILE" -C "$WORK_DIR" "${files_to_archive[@]}"
    fi

    local archive_size
    archive_size=$(get_file_size "$ARCHIVE_FILE")
    log_info "Archive created: $(format_size "$archive_size")"

    # Calculate checksum
    local checksum
    checksum=$(calculate_checksum "$ARCHIVE_FILE")
    log_info "Archive checksum (${CHECKSUM_ALGORITHM:-sha256}): $checksum"

    # Update manifest
    if command -v jq &>/dev/null; then
        local tmp_manifest="${MANIFEST_FILE}.tmp"
        jq --arg size "$archive_size" --arg checksum "$checksum" --arg algo "${CHECKSUM_ALGORITHM:-sha256}" \
            '.archive_size = ($size | tonumber) | .checksums.archive = {"algorithm": $algo, "value": $checksum}' \
            "$MANIFEST_FILE" > "$tmp_manifest" && mv "$tmp_manifest" "$MANIFEST_FILE"
    fi

    fsm_transition "encrypt"
}

# Encrypt backup
encrypt() {
    log_state "Encrypting backup"

    if [[ "${ENCRYPTION_ENABLED:-false}" != "true" ]]; then
        log_info "Encryption disabled"
        fsm_transition "upload"
        return 0
    fi

    if [[ -z "${ENCRYPTION_KEY:-}" && -z "${ENCRYPTION_KEY_FILE:-}" ]]; then
        log_warn "No encryption key configured, skipping encryption"
        fsm_transition "upload"
        return 0
    fi

    if [[ "${DRY_RUN:-false}" == "true" ]]; then
        log_info "[DRY RUN] Would encrypt archive"
        fsm_transition "upload"
        return 0
    fi

    local encrypted_file="${ARCHIVE_FILE}.enc"

    if encrypt_file "$ARCHIVE_FILE" "$encrypted_file"; then
        rm -f "$ARCHIVE_FILE"
        ARCHIVE_FILE="$encrypted_file"
        log_info "Archive encrypted: $ARCHIVE_FILE"
    else
        log_error "Encryption failed"
        fsm_set_error "Encryption failed" "recoverable"
        return 1
    fi

    fsm_transition "upload"
}

# Upload backup
upload() {
    log_state "Uploading backup"

    if [[ "${DRY_RUN:-false}" == "true" ]]; then
        log_info "[DRY RUN] Would upload: $ARCHIVE_FILE"
        fsm_transition "verify_upload"
        return 0
    fi

    local upload_result

    if fsm_execute_with_retry "storage_upload \"$ARCHIVE_FILE\""; then
        upload_result=$?
        log_info "Upload successful"

        # Also upload manifest
        storage_upload "$MANIFEST_FILE" "${BACKUP_NAME}.manifest.json" || true
    else
        log_error "Upload failed after retries"
        fsm_set_error "Upload failed" "recoverable"
        return 1
    fi

    fsm_transition "verify_upload"
}

# Verify upload
verify_upload() {
    log_state "Verifying upload"

    if [[ "${DRY_RUN:-false}" == "true" ]]; then
        log_info "[DRY RUN] Would verify upload"
        fsm_transition "cleanup_backup"
        return 0
    fi

    local storage_type="${STORAGE_TYPE:-local}"

    # Verify by listing and checking
    local archive_name
    archive_name=$(basename "$ARCHIVE_FILE")

    local found=false
    while IFS= read -r backup; do
        if [[ "$backup" == *"$archive_name"* ]]; then
            found=true
            break
        fi
    done < <(storage_list "${BACKUP_PREFIX:-backup}")

    if [[ "$found" == "true" ]]; then
        log_info "Upload verified: $archive_name"
    else
        log_warn "Could not verify upload, continuing anyway"
    fi

    fsm_transition "cleanup_backup"
}

# Cleanup after backup
cleanup_backup() {
    log_state "Cleaning up"

    if [[ "${DRY_RUN:-false}" == "true" ]]; then
        log_info "[DRY RUN] Would clean up work directory"
        fsm_transition "backup_done"
        return 0
    fi

    # Remove work directory
    if [[ -n "$WORK_DIR" && -d "$WORK_DIR" ]]; then
        rm -rf "$WORK_DIR"
        log_info "Cleaned up work directory"
    fi

    # Apply retention policy if configured
    if [[ "${RETENTION_ENABLED:-true}" == "true" ]]; then
        log_info "Applying retention policy"
        storage_apply_retention || true
    fi

    fsm_transition "backup_done"
}

# Backup complete
backup_done() {
    log_state "Backup complete"

    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - START_TIME))

    log_info "================================================"
    log_info "Backup completed successfully!"
    log_info "Name: $BACKUP_NAME"
    log_info "Duration: ${duration}s"
    log_info "Storage: ${STORAGE_TYPE:-local}"
    if [[ -f "$ARCHIVE_FILE" ]]; then
        log_info "Size: $(format_size "$(get_file_size "$ARCHIVE_FILE")")"
    fi
    log_info "================================================"

    # Send notification if configured
    send_notification "Backup Complete" "Backup $BACKUP_NAME completed successfully in ${duration}s"

    fsm_set_state "idle"
}

# Main backup loop
run_backup() {
    local state

    while true; do
        state=$(fsm_get_state)

        case "$state" in
            idle)
                backup_init
                ;;
            backup_init)
                # Already handled in backup_init function
                collect_sources
                ;;
            collect_sources)
                # Handled by transition
                ;;
            capture_environment)
                # Handled by transition
                ;;
            compress)
                # Handled by transition
                ;;
            encrypt)
                # Handled by transition
                ;;
            upload)
                # Handled by transition
                ;;
            verify_upload)
                # Handled by transition
                ;;
            cleanup_backup)
                # Handled by transition
                ;;
            backup_done)
                return 0
                ;;
            error|error_recoverable)
                log_error "Backup failed in error state"
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

    log_info "Murray's FSM Backup System"
    log_info "=========================="

    parse_args "$@"

    # Check dependencies
    check_dependencies || exit 1

    # Acquire lock to prevent concurrent runs
    if ! lock_acquire "backup"; then
        log_error "Another backup/restore operation is in progress"
        exit 1
    fi

    # Setup cleanup trap
    trap 'cleanup_on_exit' EXIT INT TERM

    # Notify backup started
    notify_backup_started "${BACKUP_PREFIX:-backup}"

    # Quiesce services for consistent backup
    if [[ "${QUIESCE_SERVICES:-true}" == "true" ]]; then
        services_quiesce_all || log_warn "Some services could not be quiesced"
    fi

    # Run backup
    local exit_code=0
    if run_backup; then
        local end_time
        end_time=$(date +%s)
        local duration=$((end_time - START_TIME))
        local size="unknown"
        [[ -f "${ARCHIVE_FILE:-}" ]] && size=$(format_size "$(get_file_size "$ARCHIVE_FILE")")
        notify_backup_completed "$BACKUP_NAME" "$duration" "$size"
    else
        exit_code=$?
        notify_backup_failed "${BACKUP_NAME:-backup}" "Backup failed with exit code $exit_code"
    fi

    exit $exit_code
}

# Cleanup on exit
cleanup_on_exit() {
    local exit_code=$?

    # Resume services if they were quiesced
    if [[ "${QUIESCE_SERVICES:-true}" == "true" ]]; then
        services_resume_all || log_warn "Some services could not be resumed"
    fi

    # Release lock
    lock_release

    exit $exit_code
}

# Run main if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
