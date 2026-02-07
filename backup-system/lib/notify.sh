#!/bin/bash
# Murray's FSM - Notification Library
# ====================================
# Supports multiple notification channels: webhook, email, desktop, log

# Configuration
NOTIFY_ENABLED="${NOTIFY_ENABLED:-true}"
NOTIFY_CHANNELS="${NOTIFY_CHANNELS:-log}"  # Space-separated: log webhook email desktop slack discord
NOTIFY_ON_SUCCESS="${NOTIFY_ON_SUCCESS:-true}"
NOTIFY_ON_FAILURE="${NOTIFY_ON_FAILURE:-true}"

# Webhook configuration
WEBHOOK_URL="${WEBHOOK_URL:-}"
WEBHOOK_METHOD="${WEBHOOK_METHOD:-POST}"
WEBHOOK_HEADERS="${WEBHOOK_HEADERS:-Content-Type: application/json}"

# Slack configuration
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
SLACK_CHANNEL="${SLACK_CHANNEL:-}"
SLACK_USERNAME="${SLACK_USERNAME:-Murray FSM Backup}"

# Discord configuration
DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"

# Email configuration
EMAIL_TO="${EMAIL_TO:-}"
EMAIL_FROM="${EMAIL_FROM:-backup@localhost}"
EMAIL_SUBJECT_PREFIX="${EMAIL_SUBJECT_PREFIX:-[Murray FSM Backup]}"

# ============================================
# Core Notification Functions
# ============================================

# Send notification to all configured channels
notify_send() {
    local title="$1"
    local message="$2"
    local level="${3:-info}"  # info, success, warning, error

    if [[ "$NOTIFY_ENABLED" != "true" ]]; then
        return 0
    fi

    # Check if we should send based on level
    if [[ "$level" == "success" && "$NOTIFY_ON_SUCCESS" != "true" ]]; then
        return 0
    fi
    if [[ "$level" == "error" && "$NOTIFY_ON_FAILURE" != "true" ]]; then
        return 0
    fi

    log_debug "Sending notification: $title ($level)"

    for channel in $NOTIFY_CHANNELS; do
        case "$channel" in
            log)
                notify_log "$title" "$message" "$level"
                ;;
            webhook)
                notify_webhook "$title" "$message" "$level"
                ;;
            email)
                notify_email "$title" "$message" "$level"
                ;;
            desktop)
                notify_desktop "$title" "$message" "$level"
                ;;
            slack)
                notify_slack "$title" "$message" "$level"
                ;;
            discord)
                notify_discord "$title" "$message" "$level"
                ;;
            *)
                log_warn "Unknown notification channel: $channel"
                ;;
        esac
    done
}

# ============================================
# Channel Implementations
# ============================================

# Log notification
notify_log() {
    local title="$1"
    local message="$2"
    local level="$3"

    local log_func="log_info"
    case "$level" in
        error) log_func="log_error" ;;
        warning) log_func="log_warn" ;;
        success) log_func="log_info" ;;
    esac

    $log_func "[NOTIFY] $title: $message"
}

# Generic webhook notification
notify_webhook() {
    local title="$1"
    local message="$2"
    local level="$3"

    if [[ -z "$WEBHOOK_URL" ]]; then
        log_debug "Webhook URL not configured"
        return 0
    fi

    local timestamp
    timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    local hostname
    hostname=$(hostname)

    local payload
    payload=$(cat << EOF
{
    "title": "$title",
    "message": "$message",
    "level": "$level",
    "timestamp": "$timestamp",
    "hostname": "$hostname",
    "source": "murray-fsm-backup"
}
EOF
)

    curl -s -X "$WEBHOOK_METHOD" \
        -H "$WEBHOOK_HEADERS" \
        -d "$payload" \
        "$WEBHOOK_URL" &>/dev/null || {
        log_warn "Failed to send webhook notification"
    }
}

# Slack notification
notify_slack() {
    local title="$1"
    local message="$2"
    local level="$3"

    if [[ -z "$SLACK_WEBHOOK_URL" ]]; then
        log_debug "Slack webhook URL not configured"
        return 0
    fi

    local color="good"
    local emoji=":information_source:"
    case "$level" in
        error)
            color="danger"
            emoji=":x:"
            ;;
        warning)
            color="warning"
            emoji=":warning:"
            ;;
        success)
            color="good"
            emoji=":white_check_mark:"
            ;;
    esac

    local payload
    payload=$(cat << EOF
{
    "username": "$SLACK_USERNAME",
    "icon_emoji": "$emoji",
    "attachments": [{
        "color": "$color",
        "title": "$title",
        "text": "$message",
        "footer": "Murray's FSM Backup System",
        "ts": $(date +%s)
    }]
}
EOF
)

    if [[ -n "$SLACK_CHANNEL" ]]; then
        payload=$(echo "$payload" | jq --arg ch "$SLACK_CHANNEL" '. + {channel: $ch}')
    fi

    curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$SLACK_WEBHOOK_URL" &>/dev/null || {
        log_warn "Failed to send Slack notification"
    }
}

# Discord notification
notify_discord() {
    local title="$1"
    local message="$2"
    local level="$3"

    if [[ -z "$DISCORD_WEBHOOK_URL" ]]; then
        log_debug "Discord webhook URL not configured"
        return 0
    fi

    local color=3447003  # Blue
    case "$level" in
        error) color=15158332 ;;    # Red
        warning) color=15105570 ;;  # Orange
        success) color=3066993 ;;   # Green
    esac

    local payload
    payload=$(cat << EOF
{
    "embeds": [{
        "title": "$title",
        "description": "$message",
        "color": $color,
        "footer": {
            "text": "Murray's FSM Backup System"
        },
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    }]
}
EOF
)

    curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$DISCORD_WEBHOOK_URL" &>/dev/null || {
        log_warn "Failed to send Discord notification"
    }
}

# Email notification
notify_email() {
    local title="$1"
    local message="$2"
    local level="$3"

    if [[ -z "$EMAIL_TO" ]]; then
        log_debug "Email recipient not configured"
        return 0
    fi

    if ! command -v mail &>/dev/null && ! command -v sendmail &>/dev/null; then
        log_debug "No mail command available"
        return 0
    fi

    local subject="$EMAIL_SUBJECT_PREFIX $title"
    local body="$message

---
Level: $level
Timestamp: $(date)
Hostname: $(hostname)
Source: Murray's FSM Backup System
"

    if command -v mail &>/dev/null; then
        echo "$body" | mail -s "$subject" -r "$EMAIL_FROM" "$EMAIL_TO" 2>/dev/null || {
            log_warn "Failed to send email notification"
        }
    elif command -v sendmail &>/dev/null; then
        {
            echo "To: $EMAIL_TO"
            echo "From: $EMAIL_FROM"
            echo "Subject: $subject"
            echo ""
            echo "$body"
        } | sendmail -t 2>/dev/null || {
            log_warn "Failed to send email notification"
        }
    fi
}

# Desktop notification (Linux/macOS)
notify_desktop() {
    local title="$1"
    local message="$2"
    local level="$3"

    local urgency="normal"
    case "$level" in
        error) urgency="critical" ;;
        warning) urgency="normal" ;;
    esac

    # Linux (notify-send)
    if command -v notify-send &>/dev/null; then
        notify-send -u "$urgency" "$title" "$message" 2>/dev/null || true
        return 0
    fi

    # macOS (osascript)
    if command -v osascript &>/dev/null; then
        osascript -e "display notification \"$message\" with title \"$title\"" 2>/dev/null || true
        return 0
    fi

    log_debug "No desktop notification tool available"
}

# ============================================
# Convenience Functions
# ============================================

# Notify backup started
notify_backup_started() {
    local backup_name="${1:-backup}"
    notify_send "Backup Started" "Starting backup: $backup_name" "info"
}

# Notify backup completed
notify_backup_completed() {
    local backup_name="${1:-backup}"
    local duration="${2:-unknown}"
    local size="${3:-unknown}"

    notify_send "Backup Completed" \
        "Backup '$backup_name' completed successfully. Duration: ${duration}s, Size: $size" \
        "success"
}

# Notify backup failed
notify_backup_failed() {
    local backup_name="${1:-backup}"
    local error="${2:-Unknown error}"

    notify_send "Backup Failed" \
        "Backup '$backup_name' failed: $error" \
        "error"
}

# Notify restore started
notify_restore_started() {
    local source="${1:-unknown}"
    notify_send "Restore Started" "Starting restore from: $source" "info"
}

# Notify restore completed
notify_restore_completed() {
    local source="${1:-unknown}"
    local duration="${2:-unknown}"

    notify_send "Restore Completed" \
        "Restore from '$source' completed successfully. Duration: ${duration}s" \
        "success"
}

# Notify restore failed
notify_restore_failed() {
    local source="${1:-unknown}"
    local error="${2:-Unknown error}"

    notify_send "Restore Failed" \
        "Restore from '$source' failed: $error" \
        "error"
}

# Notify state transition
notify_state_transition() {
    local from_state="$1"
    local to_state="$2"

    if [[ "$to_state" == error* ]]; then
        notify_send "State Error" \
            "Transitioned to error state: $from_state -> $to_state" \
            "error"
    fi
}

# Test notification configuration
notify_test() {
    notify_send "Test Notification" \
        "This is a test notification from Murray's FSM Backup System" \
        "info"

    echo "Test notification sent to channels: $NOTIFY_CHANNELS"
}
