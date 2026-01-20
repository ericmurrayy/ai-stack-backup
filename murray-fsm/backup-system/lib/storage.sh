#!/bin/bash
# Murray's FSM - Storage Library
# ===============================
# Multi-backend storage operations (local, S3, GCS, Azure)

set -euo pipefail

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! declare -f log_info &>/dev/null; then
    # shellcheck source=./common.sh
    source "${SCRIPT_DIR}/common.sh"
fi

# Upload file to storage
storage_upload() {
    local source_file="$1"
    local destination="${2:-}"
    local storage_type="${STORAGE_TYPE:-local}"

    if [[ ! -f "$source_file" ]]; then
        log_error "Source file not found: $source_file"
        return 1
    fi

    log_info "Uploading to $storage_type storage: $source_file"

    case "$storage_type" in
        local)
            storage_upload_local "$source_file" "$destination"
            ;;
        s3)
            storage_upload_s3 "$source_file" "$destination"
            ;;
        gcs)
            storage_upload_gcs "$source_file" "$destination"
            ;;
        azure)
            storage_upload_azure "$source_file" "$destination"
            ;;
        *)
            log_error "Unknown storage type: $storage_type"
            return 1
            ;;
    esac
}

# Download file from storage
storage_download() {
    local source="$1"
    local destination="$2"
    local storage_type="${STORAGE_TYPE:-local}"

    log_info "Downloading from $storage_type storage: $source"

    case "$storage_type" in
        local)
            storage_download_local "$source" "$destination"
            ;;
        s3)
            storage_download_s3 "$source" "$destination"
            ;;
        gcs)
            storage_download_gcs "$source" "$destination"
            ;;
        azure)
            storage_download_azure "$source" "$destination"
            ;;
        *)
            log_error "Unknown storage type: $storage_type"
            return 1
            ;;
    esac
}

# List backups in storage
storage_list() {
    local prefix="${1:-}"
    local storage_type="${STORAGE_TYPE:-local}"

    case "$storage_type" in
        local)
            storage_list_local "$prefix"
            ;;
        s3)
            storage_list_s3 "$prefix"
            ;;
        gcs)
            storage_list_gcs "$prefix"
            ;;
        azure)
            storage_list_azure "$prefix"
            ;;
        *)
            log_error "Unknown storage type: $storage_type"
            return 1
            ;;
    esac
}

# Delete file from storage
storage_delete() {
    local file="$1"
    local storage_type="${STORAGE_TYPE:-local}"

    log_info "Deleting from $storage_type storage: $file"

    case "$storage_type" in
        local)
            storage_delete_local "$file"
            ;;
        s3)
            storage_delete_s3 "$file"
            ;;
        gcs)
            storage_delete_gcs "$file"
            ;;
        azure)
            storage_delete_azure "$file"
            ;;
        *)
            log_error "Unknown storage type: $storage_type"
            return 1
            ;;
    esac
}

# === Local Storage ===

storage_upload_local() {
    local source_file="$1"
    local destination="${2:-}"
    local backup_dir="${LOCAL_BACKUP_DIR:-$HOME/backups}"

    mkdir -p "$backup_dir"

    if [[ -z "$destination" ]]; then
        destination="$backup_dir/$(basename "$source_file")"
    elif [[ ! "$destination" = /* ]]; then
        destination="$backup_dir/$destination"
    fi

    cp "$source_file" "$destination"

    local size
    size=$(get_file_size "$destination")
    log_info "Uploaded to local: $destination ($(format_size "$size"))"

    echo "$destination"
}

storage_download_local() {
    local source="$1"
    local destination="$2"
    local backup_dir="${LOCAL_BACKUP_DIR:-$HOME/backups}"

    # Resolve relative paths
    if [[ ! "$source" = /* ]]; then
        source="$backup_dir/$source"
    fi

    if [[ ! -f "$source" ]]; then
        log_error "Source file not found: $source"
        return 1
    fi

    cp "$source" "$destination"
    log_info "Downloaded from local: $source -> $destination"
}

storage_list_local() {
    local prefix="${1:-}"
    local backup_dir="${LOCAL_BACKUP_DIR:-$HOME/backups}"

    if [[ ! -d "$backup_dir" ]]; then
        return 0
    fi

    if [[ -n "$prefix" ]]; then
        find "$backup_dir" -maxdepth 1 -name "${prefix}*" -type f | sort -r
    else
        find "$backup_dir" -maxdepth 1 -type f -name "*.tar*" | sort -r
    fi
}

storage_delete_local() {
    local file="$1"
    local backup_dir="${LOCAL_BACKUP_DIR:-$HOME/backups}"

    if [[ ! "$file" = /* ]]; then
        file="$backup_dir/$file"
    fi

    if [[ -f "$file" ]]; then
        rm -f "$file"
        log_info "Deleted local file: $file"
    fi
}

# === AWS S3 Storage ===

storage_upload_s3() {
    local source_file="$1"
    local destination="${2:-$(basename "$source_file")}"
    local bucket="${S3_BUCKET:-}"
    local prefix="${S3_PREFIX:-backups}"
    local region="${S3_REGION:-us-east-1}"

    if [[ -z "$bucket" ]]; then
        log_error "S3_BUCKET not configured"
        return 1
    fi

    local s3_path="s3://${bucket}/${prefix}/${destination}"

    aws s3 cp "$source_file" "$s3_path" \
        --region "$region" \
        --only-show-errors

    log_info "Uploaded to S3: $s3_path"
    echo "$s3_path"
}

storage_download_s3() {
    local source="$1"
    local destination="$2"
    local bucket="${S3_BUCKET:-}"
    local prefix="${S3_PREFIX:-backups}"
    local region="${S3_REGION:-us-east-1}"

    if [[ -z "$bucket" ]]; then
        log_error "S3_BUCKET not configured"
        return 1
    fi

    local s3_path
    if [[ "$source" == s3://* ]]; then
        s3_path="$source"
    else
        s3_path="s3://${bucket}/${prefix}/${source}"
    fi

    aws s3 cp "$s3_path" "$destination" \
        --region "$region" \
        --only-show-errors

    log_info "Downloaded from S3: $s3_path -> $destination"
}

storage_list_s3() {
    local prefix="${1:-}"
    local bucket="${S3_BUCKET:-}"
    local s3_prefix="${S3_PREFIX:-backups}"
    local region="${S3_REGION:-us-east-1}"

    if [[ -z "$bucket" ]]; then
        log_error "S3_BUCKET not configured"
        return 1
    fi

    local search_prefix="${s3_prefix}/${prefix}"

    aws s3 ls "s3://${bucket}/${search_prefix}" \
        --region "$region" \
        | awk '{print $4}' \
        | sort -r
}

storage_delete_s3() {
    local file="$1"
    local bucket="${S3_BUCKET:-}"
    local prefix="${S3_PREFIX:-backups}"
    local region="${S3_REGION:-us-east-1}"

    if [[ -z "$bucket" ]]; then
        log_error "S3_BUCKET not configured"
        return 1
    fi

    local s3_path
    if [[ "$file" == s3://* ]]; then
        s3_path="$file"
    else
        s3_path="s3://${bucket}/${prefix}/${file}"
    fi

    aws s3 rm "$s3_path" --region "$region" --only-show-errors
    log_info "Deleted from S3: $s3_path"
}

# === Google Cloud Storage ===

storage_upload_gcs() {
    local source_file="$1"
    local destination="${2:-$(basename "$source_file")}"
    local bucket="${GCS_BUCKET:-}"
    local prefix="${GCS_PREFIX:-backups}"

    if [[ -z "$bucket" ]]; then
        log_error "GCS_BUCKET not configured"
        return 1
    fi

    local gcs_path="gs://${bucket}/${prefix}/${destination}"

    gsutil cp "$source_file" "$gcs_path"

    log_info "Uploaded to GCS: $gcs_path"
    echo "$gcs_path"
}

storage_download_gcs() {
    local source="$1"
    local destination="$2"
    local bucket="${GCS_BUCKET:-}"
    local prefix="${GCS_PREFIX:-backups}"

    if [[ -z "$bucket" ]]; then
        log_error "GCS_BUCKET not configured"
        return 1
    fi

    local gcs_path
    if [[ "$source" == gs://* ]]; then
        gcs_path="$source"
    else
        gcs_path="gs://${bucket}/${prefix}/${source}"
    fi

    gsutil cp "$gcs_path" "$destination"
    log_info "Downloaded from GCS: $gcs_path -> $destination"
}

storage_list_gcs() {
    local prefix="${1:-}"
    local bucket="${GCS_BUCKET:-}"
    local gcs_prefix="${GCS_PREFIX:-backups}"

    if [[ -z "$bucket" ]]; then
        log_error "GCS_BUCKET not configured"
        return 1
    fi

    local search_prefix="${gcs_prefix}/${prefix}"

    gsutil ls "gs://${bucket}/${search_prefix}*" 2>/dev/null \
        | sed "s|gs://${bucket}/${gcs_prefix}/||" \
        | sort -r
}

storage_delete_gcs() {
    local file="$1"
    local bucket="${GCS_BUCKET:-}"
    local prefix="${GCS_PREFIX:-backups}"

    if [[ -z "$bucket" ]]; then
        log_error "GCS_BUCKET not configured"
        return 1
    fi

    local gcs_path
    if [[ "$file" == gs://* ]]; then
        gcs_path="$file"
    else
        gcs_path="gs://${bucket}/${prefix}/${file}"
    fi

    gsutil rm "$gcs_path"
    log_info "Deleted from GCS: $gcs_path"
}

# === Azure Blob Storage ===

storage_upload_azure() {
    local source_file="$1"
    local destination="${2:-$(basename "$source_file")}"
    local container="${AZURE_CONTAINER:-}"
    local prefix="${AZURE_PREFIX:-backups}"
    local account="${AZURE_STORAGE_ACCOUNT:-}"

    if [[ -z "$container" ]] || [[ -z "$account" ]]; then
        log_error "Azure storage not configured"
        return 1
    fi

    az storage blob upload \
        --account-name "$account" \
        --container-name "$container" \
        --file "$source_file" \
        --name "${prefix}/${destination}" \
        --only-show-errors

    log_info "Uploaded to Azure: ${container}/${prefix}/${destination}"
}

storage_download_azure() {
    local source="$1"
    local destination="$2"
    local container="${AZURE_CONTAINER:-}"
    local prefix="${AZURE_PREFIX:-backups}"
    local account="${AZURE_STORAGE_ACCOUNT:-}"

    if [[ -z "$container" ]] || [[ -z "$account" ]]; then
        log_error "Azure storage not configured"
        return 1
    fi

    az storage blob download \
        --account-name "$account" \
        --container-name "$container" \
        --name "${prefix}/${source}" \
        --file "$destination" \
        --only-show-errors

    log_info "Downloaded from Azure: $source -> $destination"
}

storage_list_azure() {
    local prefix="${1:-}"
    local container="${AZURE_CONTAINER:-}"
    local azure_prefix="${AZURE_PREFIX:-backups}"
    local account="${AZURE_STORAGE_ACCOUNT:-}"

    if [[ -z "$container" ]] || [[ -z "$account" ]]; then
        log_error "Azure storage not configured"
        return 1
    fi

    az storage blob list \
        --account-name "$account" \
        --container-name "$container" \
        --prefix "${azure_prefix}/${prefix}" \
        --query "[].name" \
        --output tsv \
        | sed "s|${azure_prefix}/||" \
        | sort -r
}

storage_delete_azure() {
    local file="$1"
    local container="${AZURE_CONTAINER:-}"
    local prefix="${AZURE_PREFIX:-backups}"
    local account="${AZURE_STORAGE_ACCOUNT:-}"

    if [[ -z "$container" ]] || [[ -z "$account" ]]; then
        log_error "Azure storage not configured"
        return 1
    fi

    az storage blob delete \
        --account-name "$account" \
        --container-name "$container" \
        --name "${prefix}/${file}" \
        --only-show-errors

    log_info "Deleted from Azure: $file"
}

# Get latest backup
storage_get_latest() {
    local prefix="${BACKUP_PREFIX:-backup}"
    local latest

    latest=$(storage_list "$prefix" | head -n 1)

    if [[ -z "$latest" ]]; then
        log_warn "No backups found with prefix: $prefix"
        return 1
    fi

    echo "$latest"
}

# Apply retention policy
storage_apply_retention() {
    local prefix="${BACKUP_PREFIX:-backup}"
    local daily="${RETENTION_DAILY:-7}"
    local weekly="${RETENTION_WEEKLY:-4}"
    local monthly="${RETENTION_MONTHLY:-3}"

    log_info "Applying retention policy: daily=$daily, weekly=$weekly, monthly=$monthly"

    local backups
    backups=$(storage_list "$prefix")

    local count=0
    local kept=0
    local deleted=0

    # Sort backups by date (newest first) and apply retention
    while IFS= read -r backup; do
        [[ -z "$backup" ]] && continue

        count=$((count + 1))

        # Extract date from backup filename
        local backup_date
        backup_date=$(echo "$backup" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1)

        if [[ -z "$backup_date" ]]; then
            log_warn "Could not extract date from: $backup"
            continue
        fi

        local days_old
        days_old=$(( ($(date +%s) - $(date -d "$backup_date" +%s 2>/dev/null || date -j -f "%Y-%m-%d" "$backup_date" +%s 2>/dev/null || echo 0)) / 86400 ))

        # Keep if within retention period
        local keep=false

        # Daily retention
        if [[ $days_old -le $daily ]]; then
            keep=true
        fi

        # Weekly retention (keep Sunday backups)
        local day_of_week
        day_of_week=$(date -d "$backup_date" +%u 2>/dev/null || date -j -f "%Y-%m-%d" "$backup_date" +%u 2>/dev/null || echo 1)
        if [[ $day_of_week -eq 7 ]] && [[ $days_old -le $((weekly * 7)) ]]; then
            keep=true
        fi

        # Monthly retention (keep 1st of month)
        local day_of_month
        day_of_month=$(echo "$backup_date" | cut -d'-' -f3)
        if [[ "$day_of_month" == "01" ]] && [[ $days_old -le $((monthly * 30)) ]]; then
            keep=true
        fi

        if [[ "$keep" == "true" ]]; then
            kept=$((kept + 1))
            log_debug "Keeping backup: $backup ($days_old days old)"
        else
            deleted=$((deleted + 1))
            log_info "Deleting old backup: $backup ($days_old days old)"
            storage_delete "$backup" || true
        fi

    done <<< "$backups"

    log_info "Retention complete: $kept kept, $deleted deleted (of $count total)"
}

# Export functions
export -f storage_upload storage_download storage_list storage_delete
export -f storage_upload_local storage_download_local storage_list_local storage_delete_local
export -f storage_upload_s3 storage_download_s3 storage_list_s3 storage_delete_s3
export -f storage_upload_gcs storage_download_gcs storage_list_gcs storage_delete_gcs
export -f storage_upload_azure storage_download_azure storage_list_azure storage_delete_azure
export -f storage_get_latest storage_apply_retention
