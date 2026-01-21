#!/bin/bash
# Murray's FSM - Backup System Common Library
# ============================================
# Shared functions for backup and restore operations

set -euo pipefail

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Default config location
CONFIG_FILE="${SCRIPT_DIR}/../config/backup.conf"

# Logging functions
log_debug() {
    if [[ "${LOG_LEVEL:-INFO}" == "DEBUG" ]]; then
        echo -e "${CYAN}[DEBUG]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*" | tee -a "${LOG_FILE:-/dev/null}"
    fi
}

log_info() {
    if [[ "${LOG_LEVEL:-INFO}" =~ ^(DEBUG|INFO)$ ]]; then
        echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*" | tee -a "${LOG_FILE:-/dev/null}"
    fi
}

log_warn() {
    if [[ "${LOG_LEVEL:-INFO}" =~ ^(DEBUG|INFO|WARN)$ ]]; then
        echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*" | tee -a "${LOG_FILE:-/dev/null}"
    fi
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*" | tee -a "${LOG_FILE:-/dev/null}" >&2
}

log_state() {
    echo -e "${BLUE}[STATE]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $*" | tee -a "${LOG_FILE:-/dev/null}"
}

# Load configuration
load_config() {
    local config_file="${1:-$CONFIG_FILE}"

    if [[ ! -f "$config_file" ]]; then
        log_error "Configuration file not found: $config_file"
        return 1
    fi

    log_debug "Loading configuration from: $config_file"
    # shellcheck source=/dev/null
    source "$config_file"

    # Create necessary directories
    mkdir -p "$(dirname "${LOG_FILE:-/tmp/backup.log}")"
    mkdir -p "$(dirname "${FSM_STATE_FILE:-/tmp/fsm_state.json}")"
    mkdir -p "${LOCAL_BACKUP_DIR:-/tmp/backups}"

    return 0
}

# Detect operating system
detect_os() {
    local os=""
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if [[ -f /etc/debian_version ]]; then
            os="debian"
        elif [[ -f /etc/redhat-release ]]; then
            os="redhat"
        elif [[ -f /etc/arch-release ]]; then
            os="arch"
        else
            os="linux"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        os="macos"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        os="windows"
    else
        os="unknown"
    fi
    echo "$os"
}

# Check if command exists
command_exists() {
    command -v "$1" &> /dev/null
}

# Ensure required commands are available
check_dependencies() {
    local deps=("tar" "gzip" "date" "mkdir" "cp" "rm")
    local missing=()

    for dep in "${deps[@]}"; do
        if ! command_exists "$dep"; then
            missing+=("$dep")
        fi
    done

    # Check compression tool
    case "${COMPRESSION:-gzip}" in
        gzip)   command_exists gzip || missing+=("gzip") ;;
        bzip2)  command_exists bzip2 || missing+=("bzip2") ;;
        xz)     command_exists xz || missing+=("xz") ;;
        zstd)   command_exists zstd || missing+=("zstd") ;;
    esac

    # Check cloud tools if needed
    case "${STORAGE_TYPE:-local}" in
        s3)     command_exists aws || missing+=("aws-cli") ;;
        gcs)    command_exists gsutil || missing+=("gsutil") ;;
        azure)  command_exists az || missing+=("azure-cli") ;;
    esac

    # Check encryption tool if needed
    if [[ "${ENCRYPTION_ENABLED:-false}" == "true" ]]; then
        command_exists openssl || missing+=("openssl")
    fi

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "Missing required dependencies: ${missing[*]}"
        return 1
    fi

    log_debug "All dependencies satisfied"
    return 0
}

# Generate timestamp
generate_timestamp() {
    date +"%Y-%m-%d_%H-%M-%S"
}

# Generate backup filename
generate_backup_filename() {
    local timestamp="${1:-$(generate_timestamp)}"
    local prefix="${BACKUP_PREFIX:-backup}"
    echo "${prefix}_${timestamp}"
}

# Calculate checksum
calculate_checksum() {
    local file="$1"
    local algorithm="${CHECKSUM_ALGORITHM:-sha256}"

    case "$algorithm" in
        md5)    md5sum "$file" | cut -d' ' -f1 ;;
        sha1)   sha1sum "$file" | cut -d' ' -f1 ;;
        sha256) sha256sum "$file" | cut -d' ' -f1 ;;
        sha512) sha512sum "$file" | cut -d' ' -f1 ;;
        *)      sha256sum "$file" | cut -d' ' -f1 ;;
    esac
}

# Verify checksum
verify_checksum() {
    local file="$1"
    local expected_checksum="$2"
    local actual_checksum

    actual_checksum=$(calculate_checksum "$file")

    if [[ "$actual_checksum" == "$expected_checksum" ]]; then
        log_debug "Checksum verified: $file"
        return 0
    else
        log_error "Checksum mismatch for $file"
        log_error "Expected: $expected_checksum"
        log_error "Actual: $actual_checksum"
        return 1
    fi
}

# Get compression extension
get_compression_ext() {
    case "${COMPRESSION:-gzip}" in
        gzip)   echo ".gz" ;;
        bzip2)  echo ".bz2" ;;
        xz)     echo ".xz" ;;
        zstd)   echo ".zst" ;;
        none)   echo "" ;;
        *)      echo ".gz" ;;
    esac
}

# Get compression command
get_compression_cmd() {
    local level="${COMPRESSION_LEVEL:-6}"
    case "${COMPRESSION:-gzip}" in
        gzip)   echo "gzip -${level}" ;;
        bzip2)  echo "bzip2 -${level}" ;;
        xz)     echo "xz -${level}" ;;
        zstd)   echo "zstd -${level}" ;;
        none)   echo "cat" ;;
        *)      echo "gzip -${level}" ;;
    esac
}

# Get decompression command
get_decompression_cmd() {
    case "${COMPRESSION:-gzip}" in
        gzip)   echo "gzip -d" ;;
        bzip2)  echo "bzip2 -d" ;;
        xz)     echo "xz -d" ;;
        zstd)   echo "zstd -d" ;;
        none)   echo "cat" ;;
        *)      echo "gzip -d" ;;
    esac
}

# Encrypt file
encrypt_file() {
    local input="$1"
    local output="$2"
    local key_file="${ENCRYPTION_KEY_FILE:-}"

    if [[ ! -f "$key_file" ]]; then
        log_error "Encryption key file not found: $key_file"
        return 1
    fi

    openssl enc -aes-256-cbc -salt -pbkdf2 \
        -in "$input" \
        -out "$output" \
        -pass "file:$key_file"

    log_debug "Encrypted: $input -> $output"
    return 0
}

# Decrypt file
decrypt_file() {
    local input="$1"
    local output="$2"
    local key_file="${ENCRYPTION_KEY_FILE:-}"

    if [[ ! -f "$key_file" ]]; then
        log_error "Encryption key file not found: $key_file"
        return 1
    fi

    openssl enc -aes-256-cbc -d -pbkdf2 \
        -in "$input" \
        -out "$output" \
        -pass "file:$key_file"

    log_debug "Decrypted: $input -> $output"
    return 0
}

# Format file size
format_size() {
    local size="$1"
    local units=("B" "KB" "MB" "GB" "TB")
    local unit=0

    while [[ $size -gt 1024 && $unit -lt 4 ]]; do
        size=$((size / 1024))
        unit=$((unit + 1))
    done

    echo "${size}${units[$unit]}"
}

# Get file size
get_file_size() {
    local file="$1"
    if [[ -f "$file" ]]; then
        stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "0"
    else
        echo "0"
    fi
}

# Send notification
send_notification() {
    local status="$1"
    local message="$2"
    local webhook_url="${NOTIFY_WEBHOOK_URL:-}"

    if [[ -z "$webhook_url" ]]; then
        log_debug "No webhook URL configured, skipping notification"
        return 0
    fi

    local payload
    payload=$(cat <<EOF
{
    "status": "$status",
    "message": "$message",
    "timestamp": "$(date -Iseconds)",
    "hostname": "$(hostname)",
    "backup_prefix": "${BACKUP_PREFIX:-backup}"
}
EOF
)

    if command_exists curl; then
        curl -s -X POST -H "Content-Type: application/json" \
            -d "$payload" "$webhook_url" &>/dev/null || true
    fi
}

# Cleanup function for trap
cleanup() {
    local exit_code=$?
    local temp_dir="${TEMP_BACKUP_DIR:-}"

    if [[ -n "$temp_dir" && -d "$temp_dir" ]]; then
        log_debug "Cleaning up temporary directory: $temp_dir"
        rm -rf "$temp_dir"
    fi

    exit $exit_code
}

# ============================================
# Production Hardening: Atomic File Operations
# ============================================

# Atomic file write (write to temp, then rename)
atomic_write() {
    local target_file="$1"
    local content="$2"

    local temp_file="${target_file}.tmp.$$"
    local dir
    dir=$(dirname "$target_file")

    # Ensure directory exists
    mkdir -p "$dir"

    # Write to temp file
    echo "$content" > "$temp_file" || {
        log_error "Failed to write temp file: $temp_file"
        rm -f "$temp_file"
        return 1
    }

    # Atomic rename
    mv "$temp_file" "$target_file" || {
        log_error "Failed to rename temp file to: $target_file"
        rm -f "$temp_file"
        return 1
    }

    log_debug "Atomically wrote: $target_file"
    return 0
}

# Atomic file copy (copy to temp, verify, then rename)
atomic_copy() {
    local source_file="$1"
    local target_file="$2"
    local verify="${3:-true}"

    local temp_file="${target_file}.tmp.$$"
    local dir
    dir=$(dirname "$target_file")

    # Ensure directory exists
    mkdir -p "$dir"

    # Copy to temp
    cp "$source_file" "$temp_file" || {
        log_error "Failed to copy to temp: $source_file -> $temp_file"
        rm -f "$temp_file"
        return 1
    }

    # Verify integrity if requested
    if [[ "$verify" == "true" ]]; then
        local src_checksum dst_checksum
        src_checksum=$(calculate_checksum "$source_file")
        dst_checksum=$(calculate_checksum "$temp_file")

        if [[ "$src_checksum" != "$dst_checksum" ]]; then
            log_error "Checksum mismatch during atomic copy"
            rm -f "$temp_file"
            return 1
        fi
    fi

    # Atomic rename
    mv "$temp_file" "$target_file" || {
        log_error "Failed to finalize atomic copy: $target_file"
        rm -f "$temp_file"
        return 1
    }

    log_debug "Atomically copied: $source_file -> $target_file"
    return 0
}

# Safe temp file creation
create_temp_file() {
    local prefix="${1:-backup}"
    local suffix="${2:-.tmp}"

    local temp_dir="${TEMP_DIR:-/tmp}"
    local temp_file
    temp_file=$(mktemp "${temp_dir}/${prefix}.XXXXXX${suffix}")

    if [[ -f "$temp_file" ]]; then
        echo "$temp_file"
        return 0
    else
        log_error "Failed to create temp file"
        return 1
    fi
}

# Safe temp directory creation
create_temp_dir() {
    local prefix="${1:-backup}"

    local temp_parent="${TEMP_DIR:-/tmp}"
    local temp_dir
    temp_dir=$(mktemp -d "${temp_parent}/${prefix}.XXXXXX")

    if [[ -d "$temp_dir" ]]; then
        echo "$temp_dir"
        return 0
    else
        log_error "Failed to create temp directory"
        return 1
    fi
}

# ============================================
# Production Hardening: Credential Validation
# ============================================

# Validate encryption key is available
validate_encryption_config() {
    if [[ "${ENCRYPTION_ENABLED:-false}" != "true" ]]; then
        return 0  # Encryption not enabled, skip validation
    fi

    # Check for key file
    if [[ -n "${ENCRYPTION_KEY_FILE:-}" ]]; then
        if [[ -f "$ENCRYPTION_KEY_FILE" ]]; then
            # Verify file is not empty
            if [[ ! -s "$ENCRYPTION_KEY_FILE" ]]; then
                log_error "Encryption key file is empty: $ENCRYPTION_KEY_FILE"
                return 1
            fi
            log_debug "Encryption key file validated: $ENCRYPTION_KEY_FILE"
            return 0
        else
            log_error "Encryption key file not found: $ENCRYPTION_KEY_FILE"
            return 1
        fi
    fi

    # Check for environment variable key
    if [[ -n "${ENCRYPTION_KEY:-}" ]]; then
        if [[ ${#ENCRYPTION_KEY} -lt 8 ]]; then
            log_error "Encryption key is too short (minimum 8 characters)"
            return 1
        fi
        log_debug "Encryption key validated from environment"
        return 0
    fi

    log_error "Encryption is enabled but no key configured"
    log_error "Set ENCRYPTION_KEY_FILE or ENCRYPTION_KEY environment variable"
    return 1
}

# Validate cloud storage credentials
validate_storage_credentials() {
    local storage_type="${STORAGE_TYPE:-local}"

    case "$storage_type" in
        local)
            # Check local backup directory is writable
            local backup_dir="${LOCAL_BACKUP_DIR:-$HOME/backups}"
            if [[ ! -d "$backup_dir" ]]; then
                mkdir -p "$backup_dir" || {
                    log_error "Cannot create backup directory: $backup_dir"
                    return 1
                }
            fi
            if [[ ! -w "$backup_dir" ]]; then
                log_error "Backup directory not writable: $backup_dir"
                return 1
            fi
            ;;

        s3)
            # Validate AWS credentials
            if ! aws sts get-caller-identity &>/dev/null; then
                log_error "AWS credentials not configured or invalid"
                log_error "Run 'aws configure' or set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY"
                return 1
            fi
            # Check bucket exists
            if [[ -n "${S3_BUCKET:-}" ]]; then
                if ! aws s3api head-bucket --bucket "$S3_BUCKET" &>/dev/null; then
                    log_error "S3 bucket not accessible: $S3_BUCKET"
                    return 1
                fi
            else
                log_error "S3_BUCKET not configured"
                return 1
            fi
            log_debug "AWS S3 credentials validated"
            ;;

        gcs)
            # Validate GCS credentials
            if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | grep -q .; then
                log_error "GCS credentials not configured"
                log_error "Run 'gcloud auth login' or set GOOGLE_APPLICATION_CREDENTIALS"
                return 1
            fi
            if [[ -z "${GCS_BUCKET:-}" ]]; then
                log_error "GCS_BUCKET not configured"
                return 1
            fi
            log_debug "GCS credentials validated"
            ;;

        azure)
            # Validate Azure credentials
            if ! az account show &>/dev/null; then
                log_error "Azure credentials not configured"
                log_error "Run 'az login' to authenticate"
                return 1
            fi
            if [[ -z "${AZURE_STORAGE_ACCOUNT:-}" ]]; then
                log_error "AZURE_STORAGE_ACCOUNT not configured"
                return 1
            fi
            if [[ -z "${AZURE_CONTAINER:-}" ]]; then
                log_error "AZURE_CONTAINER not configured"
                return 1
            fi
            log_debug "Azure credentials validated"
            ;;

        *)
            log_error "Unknown storage type: $storage_type"
            return 1
            ;;
    esac

    return 0
}

# Validate all required configuration before operation
validate_config() {
    local errors=0

    # Validate backup sources exist
    if [[ -z "${BACKUP_DIRS:-}" && -z "${BACKUP_FILES:-}" ]]; then
        log_error "No backup sources configured (BACKUP_DIRS or BACKUP_FILES)"
        ((errors++))
    fi

    # Check BACKUP_DIRS exist
    for dir in ${BACKUP_DIRS:-}; do
        if [[ ! -d "$dir" ]]; then
            log_warn "Backup directory does not exist: $dir"
        fi
    done

    # Check BACKUP_FILES exist
    for file in ${BACKUP_FILES:-}; do
        if [[ ! -f "$file" ]]; then
            log_warn "Backup file does not exist: $file"
        fi
    done

    # Validate encryption if enabled
    if ! validate_encryption_config; then
        ((errors++))
    fi

    # Validate storage credentials
    if ! validate_storage_credentials; then
        ((errors++))
    fi

    if [[ $errors -gt 0 ]]; then
        log_error "Configuration validation failed with $errors error(s)"
        return 1
    fi

    log_info "Configuration validated successfully"
    return 0
}

# ============================================
# Production Hardening: Retry Mechanism
# ============================================

# Retry a command with exponential backoff
retry_with_backoff() {
    local max_attempts="${1:-3}"
    local base_delay="${2:-2}"
    shift 2
    local cmd=("$@")

    local attempt=1
    local delay=$base_delay

    while [[ $attempt -le $max_attempts ]]; do
        log_debug "Attempt $attempt/$max_attempts: ${cmd[*]}"

        if "${cmd[@]}"; then
            return 0
        fi

        if [[ $attempt -lt $max_attempts ]]; then
            log_warn "Command failed, retrying in ${delay}s... (attempt $attempt/$max_attempts)"
            sleep "$delay"
            delay=$((delay * 2))  # Exponential backoff
        fi

        ((attempt++))
    done

    log_error "Command failed after $max_attempts attempts: ${cmd[*]}"
    return 1
}

# ============================================
# Production Hardening: Safe Restore Checks
# ============================================

# Check if restore target is safe (not system directories)
is_safe_restore_target() {
    local target="$1"

    # Dangerous paths that should not be directly restored to
    local dangerous_paths=(
        "/"
        "/bin"
        "/sbin"
        "/usr"
        "/etc"
        "/var"
        "/boot"
        "/dev"
        "/proc"
        "/sys"
    )

    # Resolve to absolute path
    local abs_target
    abs_target=$(realpath -m "$target" 2>/dev/null || echo "$target")

    for dangerous in "${dangerous_paths[@]}"; do
        if [[ "$abs_target" == "$dangerous" ]]; then
            return 1
        fi
    done

    return 0
}

# Check if target has existing files
target_has_existing_files() {
    local target="$1"

    if [[ -d "$target" ]]; then
        local file_count
        file_count=$(find "$target" -type f 2>/dev/null | wc -l)
        [[ $file_count -gt 0 ]]
    else
        return 1
    fi
}

# Prompt for confirmation (for interactive mode)
confirm_action() {
    local message="$1"
    local default="${2:-n}"

    # If not interactive, use default
    if [[ ! -t 0 ]]; then
        [[ "$default" == "y" ]]
        return $?
    fi

    local prompt
    if [[ "$default" == "y" ]]; then
        prompt="$message [Y/n]: "
    else
        prompt="$message [y/N]: "
    fi

    read -r -p "$prompt" response
    response=${response:-$default}

    [[ "$response" =~ ^[Yy] ]]
}

# Export functions
export -f log_debug log_info log_warn log_error log_state
export -f load_config detect_os command_exists check_dependencies
export -f generate_timestamp generate_backup_filename
export -f calculate_checksum verify_checksum
export -f get_compression_ext get_compression_cmd get_decompression_cmd
export -f encrypt_file decrypt_file
export -f format_size get_file_size send_notification cleanup
export -f atomic_write atomic_copy create_temp_file create_temp_dir
export -f validate_encryption_config validate_storage_credentials validate_config
export -f retry_with_backoff is_safe_restore_target target_has_existing_files confirm_action
