#!/bin/bash
# Murray's FSM - Service Management Library
# ==========================================
# Handles quiescing and restarting services for consistent backups

# Configuration
QUIESCE_DOCKER="${QUIESCE_DOCKER:-true}"
QUIESCE_SYSTEMD="${QUIESCE_SYSTEMD:-false}"
DOCKER_CONTAINERS="${DOCKER_CONTAINERS:-}"  # Space-separated list, empty = all
SYSTEMD_SERVICES="${SYSTEMD_SERVICES:-}"    # Space-separated list
QUIESCE_TIMEOUT="${QUIESCE_TIMEOUT:-60}"

# Track stopped services for restart
declare -a STOPPED_CONTAINERS=()
declare -a STOPPED_SERVICES=()

# ============================================
# Docker Management
# ============================================

# Check if Docker is available
docker_available() {
    command -v docker &>/dev/null && docker info &>/dev/null
}

# Get list of running containers
docker_list_running() {
    local filter="${1:-}"

    if [[ -n "$filter" ]]; then
        # Filter by name patterns
        for pattern in $filter; do
            docker ps --format '{{.Names}}' --filter "name=$pattern" 2>/dev/null
        done | sort -u
    else
        docker ps --format '{{.Names}}' 2>/dev/null
    fi
}

# Stop Docker containers
docker_stop_containers() {
    local containers="${1:-$DOCKER_CONTAINERS}"

    if [[ "$QUIESCE_DOCKER" != "true" ]]; then
        log_debug "Docker quiescing disabled"
        return 0
    fi

    if ! docker_available; then
        log_debug "Docker not available, skipping"
        return 0
    fi

    local running_containers
    if [[ -n "$containers" ]]; then
        running_containers=$(docker_list_running "$containers")
    else
        running_containers=$(docker_list_running)
    fi

    if [[ -z "$running_containers" ]]; then
        log_info "No Docker containers to stop"
        return 0
    fi

    log_info "Stopping Docker containers for consistent backup..."

    local count=0
    while IFS= read -r container; do
        [[ -z "$container" ]] && continue

        log_debug "Stopping container: $container"
        if docker stop "$container" --time "$QUIESCE_TIMEOUT" &>/dev/null; then
            STOPPED_CONTAINERS+=("$container")
            ((count++)) || true
        else
            log_warn "Failed to stop container: $container"
        fi
    done <<< "$running_containers"

    log_info "Stopped $count Docker containers"
    return 0
}

# Start previously stopped Docker containers
docker_start_containers() {
    if [[ ${#STOPPED_CONTAINERS[@]} -eq 0 ]]; then
        log_debug "No containers to restart"
        return 0
    fi

    log_info "Restarting ${#STOPPED_CONTAINERS[@]} Docker containers..."

    local count=0
    for container in "${STOPPED_CONTAINERS[@]}"; do
        log_debug "Starting container: $container"
        if docker start "$container" &>/dev/null; then
            ((count++)) || true
        else
            log_warn "Failed to start container: $container"
        fi
    done

    log_info "Restarted $count Docker containers"
    STOPPED_CONTAINERS=()
    return 0
}

# Pause Docker containers (alternative to stop)
docker_pause_containers() {
    local containers="${1:-$DOCKER_CONTAINERS}"

    if [[ "$QUIESCE_DOCKER" != "true" ]]; then
        return 0
    fi

    if ! docker_available; then
        return 0
    fi

    local running_containers
    if [[ -n "$containers" ]]; then
        running_containers=$(docker_list_running "$containers")
    else
        running_containers=$(docker_list_running)
    fi

    if [[ -z "$running_containers" ]]; then
        return 0
    fi

    log_info "Pausing Docker containers..."

    while IFS= read -r container; do
        [[ -z "$container" ]] && continue
        docker pause "$container" &>/dev/null && STOPPED_CONTAINERS+=("$container")
    done <<< "$running_containers"

    return 0
}

# Unpause Docker containers
docker_unpause_containers() {
    if [[ ${#STOPPED_CONTAINERS[@]} -eq 0 ]]; then
        return 0
    fi

    log_info "Unpausing Docker containers..."

    for container in "${STOPPED_CONTAINERS[@]}"; do
        docker unpause "$container" &>/dev/null || true
    done

    STOPPED_CONTAINERS=()
    return 0
}

# Export Docker container data
docker_export_volumes() {
    local output_dir="$1"
    local containers="${2:-$DOCKER_CONTAINERS}"

    if ! docker_available; then
        return 0
    fi

    mkdir -p "$output_dir/docker"

    # Export docker-compose files if present
    for compose_file in docker-compose.yml docker-compose.yaml compose.yml compose.yaml; do
        if [[ -f "$compose_file" ]]; then
            cp "$compose_file" "$output_dir/docker/"
        fi
    done

    # List all containers and their volumes
    docker ps -a --format '{{.Names}}\t{{.Image}}\t{{.Status}}' > "$output_dir/docker/containers.txt" 2>/dev/null || true

    # Export volume list
    docker volume ls --format '{{.Name}}\t{{.Driver}}' > "$output_dir/docker/volumes.txt" 2>/dev/null || true

    log_info "Docker metadata exported to: $output_dir/docker"
    return 0
}

# ============================================
# Systemd Service Management
# ============================================

# Check if systemd is available
systemd_available() {
    command -v systemctl &>/dev/null && systemctl --version &>/dev/null 2>&1
}

# Stop systemd services
systemd_stop_services() {
    local services="${1:-$SYSTEMD_SERVICES}"

    if [[ "$QUIESCE_SYSTEMD" != "true" ]]; then
        log_debug "Systemd quiescing disabled"
        return 0
    fi

    if ! systemd_available; then
        log_debug "Systemd not available, skipping"
        return 0
    fi

    if [[ -z "$services" ]]; then
        log_debug "No systemd services configured to stop"
        return 0
    fi

    log_info "Stopping systemd services for consistent backup..."

    local count=0
    for service in $services; do
        if systemctl is-active --quiet "$service" 2>/dev/null; then
            log_debug "Stopping service: $service"
            if sudo systemctl stop "$service" 2>/dev/null; then
                STOPPED_SERVICES+=("$service")
                ((count++)) || true
            else
                log_warn "Failed to stop service: $service"
            fi
        fi
    done

    log_info "Stopped $count systemd services"
    return 0
}

# Start previously stopped systemd services
systemd_start_services() {
    if [[ ${#STOPPED_SERVICES[@]} -eq 0 ]]; then
        log_debug "No services to restart"
        return 0
    fi

    log_info "Restarting ${#STOPPED_SERVICES[@]} systemd services..."

    local count=0
    for service in "${STOPPED_SERVICES[@]}"; do
        log_debug "Starting service: $service"
        if sudo systemctl start "$service" 2>/dev/null; then
            ((count++)) || true
        else
            log_warn "Failed to start service: $service"
        fi
    done

    log_info "Restarted $count systemd services"
    STOPPED_SERVICES=()
    return 0
}

# Export systemd service configs
systemd_export_configs() {
    local output_dir="$1"
    local services="${2:-$SYSTEMD_SERVICES}"

    if ! systemd_available; then
        return 0
    fi

    mkdir -p "$output_dir/systemd"

    if [[ -n "$services" ]]; then
        for service in $services; do
            local unit_file
            unit_file=$(systemctl show -p FragmentPath "$service" 2>/dev/null | cut -d= -f2)
            if [[ -n "$unit_file" && -f "$unit_file" ]]; then
                cp "$unit_file" "$output_dir/systemd/"
            fi
        done
    fi

    log_info "Systemd configs exported to: $output_dir/systemd"
    return 0
}

# ============================================
# Database Quiescing
# ============================================

# PostgreSQL - create consistent snapshot
postgres_quiesce() {
    local db_name="${1:-}"
    local output_dir="$2"

    if ! command -v pg_dump &>/dev/null; then
        return 0
    fi

    if [[ -n "$db_name" ]]; then
        log_info "Creating PostgreSQL dump: $db_name"
        pg_dump "$db_name" > "$output_dir/postgres_${db_name}.sql" 2>/dev/null || {
            log_warn "Failed to dump PostgreSQL database: $db_name"
            return 1
        }
    fi

    return 0
}

# MySQL/MariaDB - create consistent snapshot
mysql_quiesce() {
    local db_name="${1:-}"
    local output_dir="$2"

    if ! command -v mysqldump &>/dev/null; then
        return 0
    fi

    if [[ -n "$db_name" ]]; then
        log_info "Creating MySQL dump: $db_name"
        mysqldump --single-transaction "$db_name" > "$output_dir/mysql_${db_name}.sql" 2>/dev/null || {
            log_warn "Failed to dump MySQL database: $db_name"
            return 1
        }
    fi

    return 0
}

# SQLite - copy database safely
sqlite_quiesce() {
    local db_path="$1"
    local output_dir="$2"

    if [[ ! -f "$db_path" ]]; then
        return 0
    fi

    if command -v sqlite3 &>/dev/null; then
        local db_name
        db_name=$(basename "$db_path")
        log_info "Creating SQLite backup: $db_name"
        sqlite3 "$db_path" ".backup '$output_dir/$db_name'" 2>/dev/null || {
            # Fallback to copy
            cp "$db_path" "$output_dir/"
        }
    else
        cp "$db_path" "$output_dir/"
    fi

    return 0
}

# ============================================
# Combined Operations
# ============================================

# Quiesce all configured services
services_quiesce_all() {
    log_state "Quiescing services for backup"

    # Stop Docker containers
    docker_stop_containers || true

    # Stop systemd services
    systemd_stop_services || true

    log_info "All services quiesced"
    return 0
}

# Resume all stopped services
services_resume_all() {
    log_state "Resuming services after backup"

    # Start systemd services first
    systemd_start_services || true

    # Start Docker containers
    docker_start_containers || true

    log_info "All services resumed"
    return 0
}

# Get service status as JSON
services_status_json() {
    local docker_status="unavailable"
    local systemd_status="unavailable"
    local docker_containers="[]"

    if docker_available; then
        docker_status="available"
        docker_containers=$(docker ps --format '{"name":"{{.Names}}","image":"{{.Image}}","status":"{{.Status}}"}' 2>/dev/null | jq -s '.' 2>/dev/null || echo "[]")
    fi

    if systemd_available; then
        systemd_status="available"
    fi

    cat << EOF
{
    "docker": {
        "status": "$docker_status",
        "quiesce_enabled": $QUIESCE_DOCKER,
        "containers": $docker_containers
    },
    "systemd": {
        "status": "$systemd_status",
        "quiesce_enabled": $QUIESCE_SYSTEMD,
        "services": "${SYSTEMD_SERVICES:-none}"
    },
    "stopped_containers": ${#STOPPED_CONTAINERS[@]},
    "stopped_services": ${#STOPPED_SERVICES[@]}
}
EOF
}
