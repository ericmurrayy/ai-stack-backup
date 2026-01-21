# Operational Integration Guide

This guide covers how to integrate Murray's FSM Backup System into your production environment.

## Automated Backup Scheduling

### Using Cron (Linux/macOS)

Edit your crontab:

```bash
crontab -e
```

Add scheduled backups:

```cron
# Daily backup at 2:00 AM
0 2 * * * /path/to/murray-fsm/backup-system/scripts/backup.sh -c /path/to/backup.conf >> /var/log/backup.log 2>&1

# Weekly full backup on Sunday at 3:00 AM
0 3 * * 0 /path/to/murray-fsm/backup-system/scripts/backup.sh -c /path/to/backup.conf -n weekly >> /var/log/backup.log 2>&1

# Monthly backup on the 1st at 4:00 AM
0 4 1 * * /path/to/murray-fsm/backup-system/scripts/backup.sh -c /path/to/backup.conf -n monthly >> /var/log/backup.log 2>&1
```

### Using Systemd (Linux)

Create a systemd service unit:

```bash
sudo nano /etc/systemd/system/murray-backup.service
```

```ini
[Unit]
Description=Murray's FSM Backup Service
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=backup
Group=backup
ExecStart=/path/to/murray-fsm/backup-system/scripts/backup.sh -c /etc/murray-backup/backup.conf
StandardOutput=journal
StandardError=journal

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/backups /tmp
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Create a systemd timer:

```bash
sudo nano /etc/systemd/system/murray-backup.timer
```

```ini
[Unit]
Description=Run Murray's FSM Backup Daily

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
```

Enable and start the timer:

```bash
sudo systemctl daemon-reload
sudo systemctl enable murray-backup.timer
sudo systemctl start murray-backup.timer

# Check status
sudo systemctl list-timers murray-backup.timer
```

### Using Windows Task Scheduler (WSL)

Create a batch file to run backup in WSL:

```batch
@echo off
wsl -d Ubuntu -u root -- /path/to/murray-fsm/backup-system/scripts/backup.sh -c /path/to/backup.conf
```

Then create a scheduled task using Task Scheduler to run this batch file.

## Monitoring and Alerting

### Log Monitoring

Backup logs are stored in `backup-system/logs/`. Monitor them with:

```bash
# Watch latest backup log
tail -f backup-system/logs/backup-*.log

# Check for errors
grep -r "ERROR" backup-system/logs/

# Recent backup status
./scripts/fsm-controller.sh history
```

### Health Checks

Create a simple health check script:

```bash
#!/bin/bash
# health-check.sh

# Check if backup ran in last 24 hours
LAST_BACKUP=$(./scripts/fsm-controller.sh list | jq -r '.data.backups[0]' 2>/dev/null)

if [[ -z "$LAST_BACKUP" ]]; then
    echo "CRITICAL: No backups found"
    exit 2
fi

# Extract date from backup name
BACKUP_DATE=$(echo "$LAST_BACKUP" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}')
BACKUP_TIMESTAMP=$(date -d "$BACKUP_DATE" +%s 2>/dev/null || date -j -f "%Y-%m-%d" "$BACKUP_DATE" +%s 2>/dev/null)
CURRENT_TIMESTAMP=$(date +%s)
AGE_HOURS=$(( (CURRENT_TIMESTAMP - BACKUP_TIMESTAMP) / 3600 ))

if [[ $AGE_HOURS -gt 24 ]]; then
    echo "WARNING: Last backup is ${AGE_HOURS} hours old: $LAST_BACKUP"
    exit 1
else
    echo "OK: Last backup is ${AGE_HOURS} hours old: $LAST_BACKUP"
    exit 0
fi
```

### Webhook Notifications

Configure webhook notifications in `backup.conf`:

```bash
NOTIFY_ENABLED=true
NOTIFY_CHANNELS="webhook slack"

# Generic webhook
WEBHOOK_URL="https://your-monitoring-system.com/webhook"

# Slack integration
SLACK_WEBHOOK_URL="<your-slack-webhook-url>"
SLACK_CHANNEL="#ops-alerts"

# Discord integration
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
```

## Production Configuration Template

Create `/etc/murray-backup/backup.conf`:

```bash
# Murray's FSM Backup - Production Configuration
# ==============================================

# Backup Sources
BACKUP_DIRS="/home/deploy/app /var/lib/app-data"
BACKUP_FILES="/etc/app/config.yml"
EXCLUDE_PATTERNS="node_modules .git __pycache__ *.log *.tmp"

# Storage Configuration
STORAGE_TYPE="s3"
S3_BUCKET="company-backups"
S3_PREFIX="app/production"
S3_REGION="us-east-1"

# Also keep local copies
LOCAL_BACKUP_DIR="/var/backups/murray"

# Compression (gzip for speed, xz for size)
COMPRESSION="gzip"

# Security
ENCRYPTION_ENABLED=true
ENCRYPTION_KEY_FILE="/etc/murray-backup/encryption.key"
CHECKSUM_ALGORITHM="sha256"

# Retention Policy
RETENTION_ENABLED=true
RETENTION_DAILY=7
RETENTION_WEEKLY=4
RETENTION_MONTHLY=12

# Service Quiescing
QUIESCE_SERVICES=true
QUIESCE_DOCKER=true
DOCKER_CONTAINERS="app-web app-worker"
QUIESCE_SYSTEMD=false

# Notifications
NOTIFY_ENABLED=true
NOTIFY_CHANNELS="log slack"
NOTIFY_ON_SUCCESS=true
NOTIFY_ON_FAILURE=true
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
SLACK_CHANNEL="#ops-alerts"

# Safety
PRE_RESTORE_BACKUP=true

# Storage retry configuration
STORAGE_MAX_RETRIES=5
STORAGE_RETRY_DELAY=5
```

## Disaster Recovery Procedures

### Full System Recovery

1. **Provision new infrastructure**
   ```bash
   # Set up new server with required dependencies
   sudo apt-get install -y tar gzip rsync openssl jq awscli
   ```

2. **Deploy backup system**
   ```bash
   git clone https://github.com/your-repo/murray-fsm.git
   cd murray-fsm/backup-system
   chmod +x scripts/*.sh lib/*.sh
   ```

3. **Configure for restore**
   ```bash
   # Set up credentials
   aws configure

   # Create config pointing to your backup storage
   cp config/backup.conf.example config/restore.conf
   # Edit config with your S3 bucket, encryption key, etc.
   ```

4. **List available backups**
   ```bash
   ./scripts/restore.sh -c config/restore.conf -l
   ```

5. **Restore from backup**
   ```bash
   # Restore latest
   ./scripts/restore.sh -c config/restore.conf -L -t /home/deploy

   # Or specific backup
   ./scripts/restore.sh -c config/restore.conf backup-2024-01-15.tar.gz -t /home/deploy
   ```

6. **Restore environment**
   ```bash
   # Run environment restoration script
   bash /home/deploy/environment-restore.sh
   ```

7. **Start services**
   ```bash
   docker-compose up -d
   # or
   sudo systemctl start app
   ```

### Partial Recovery (Single Directory)

```bash
# Extract specific directory from backup
./scripts/restore.sh -L -t /tmp/partial-restore -f  # files only

# Copy what you need
cp -r /tmp/partial-restore/sources/home_deploy_app/specific-dir /home/deploy/app/
```

## Security Hardening

### Encryption Key Management

1. **Generate a strong encryption key**
   ```bash
   openssl rand -base64 32 > /etc/murray-backup/encryption.key
   chmod 600 /etc/murray-backup/encryption.key
   ```

2. **Store key securely** (in a different location than backups)
   - Use a secrets manager (AWS Secrets Manager, HashiCorp Vault)
   - Store on a separate encrypted drive
   - Keep printed copy in secure physical location

3. **Never commit encryption keys to git**
   ```bash
   echo "encryption.key" >> .gitignore
   ```

### File Permissions

```bash
# Restrict backup configuration
chmod 600 /etc/murray-backup/backup.conf
chmod 600 /etc/murray-backup/encryption.key
chown root:root /etc/murray-backup/*

# Restrict backup directory
chmod 700 /var/backups/murray
chown backup:backup /var/backups/murray
```

### Cloud Storage Security

For S3:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:ListBucket",
                "s3:DeleteObject"
            ],
            "Resource": [
                "arn:aws:s3:::company-backups",
                "arn:aws:s3:::company-backups/*"
            ]
        }
    ]
}
```

Enable S3 bucket encryption and versioning:
```bash
aws s3api put-bucket-encryption --bucket company-backups \
    --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

aws s3api put-bucket-versioning --bucket company-backups \
    --versioning-configuration Status=Enabled
```

## Troubleshooting

### Common Issues

**Lock stuck after crash**
```bash
# Check lock status
./scripts/fsm-controller.sh lock

# If stale, clear it (locks auto-expire after 1 hour)
rm /tmp/murray-fsm/backup.lock
```

**Backup fails with "No sources collected"**
```bash
# Verify paths exist
./scripts/fsm-controller.sh validate

# Check configuration
./scripts/fsm-controller.sh config
```

**Cloud upload fails**
```bash
# Check credentials
aws sts get-caller-identity  # for S3

# Check network
curl -I https://s3.amazonaws.com

# Increase retry attempts
export STORAGE_MAX_RETRIES=5
```

**Restore fails checksum verification**
```bash
# The backup may be corrupted, try a different backup
./scripts/restore.sh -l
./scripts/restore.sh backup-2024-01-14.tar.gz  # older backup
```

### Debug Mode

Enable verbose logging:
```bash
export LOG_LEVEL=DEBUG
./scripts/backup.sh -v
```

Check FSM state history:
```bash
./scripts/fsm-controller.sh history
```

## Performance Tuning

### For Large Backups

```bash
# Use faster compression
COMPRESSION="gzip"  # fastest
# or
COMPRESSION="zstd"  # good balance of speed/ratio

# Increase buffer sizes for cloud uploads
export AWS_MAX_CONCURRENT_REQUESTS=10
```

### For Slow Networks

```bash
# Increase retry settings
STORAGE_MAX_RETRIES=5
STORAGE_RETRY_DELAY=10

# Use chunked uploads for large files (S3)
aws configure set default.s3.multipart_threshold 64MB
aws configure set default.s3.multipart_chunksize 16MB
```
