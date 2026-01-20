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

# Export functions
export -f log_debug log_info log_warn log_error log_state
export -f load_config detect_os command_exists check_dependencies
export -f generate_timestamp generate_backup_filename
export -f calculate_checksum verify_checksum
export -f get_compression_ext get_compression_cmd get_decompression_cmd
export -f encrypt_file decrypt_file
export -f format_size get_file_size send_notification cleanup
