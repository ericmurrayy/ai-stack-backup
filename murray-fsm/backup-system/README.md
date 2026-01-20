# Murray's FSM - Backup & Restore System

A robust, FSM-based backup and restore system designed for AI agent coordination (Claude/Open Interpreter).

## Features

- **FSM State Management**: Reliable state tracking for backup/restore operations
- **Multi-Backend Storage**: Local, AWS S3, Google Cloud Storage, Azure Blob Storage
- **Encryption**: AES-256-CBC encryption with configurable keys
- **Integrity Verification**: SHA-256/SHA-512/MD5 checksums
- **Environment Capture**: Python packages, Node.js, system packages, environment variables
- **Idempotent Restore**: Safe restoration with backup of existing files
- **AI Agent Interface**: JSON-based controller for Claude/Open Interpreter

## Quick Start

### 1. Configure

Edit `config/backup.conf`:

```bash
# What to backup
BACKUP_DIRS="/home/user/projects /home/user/configs"
BACKUP_FILES="/home/user/.bashrc /home/user/.gitconfig"

# Storage (local, s3, gcs, azure)
STORAGE_TYPE="local"
LOCAL_BACKUP_DIR="$HOME/backups"

# Enable encryption
ENCRYPTION_ENABLED=true
ENCRYPTION_KEY="your-secret-key"
```

### 2. Run Backup

```bash
./scripts/backup.sh
```

### 3. List Backups

```bash
./scripts/restore.sh -l
```

### 4. Restore

```bash
./scripts/restore.sh              # Latest backup
./scripts/restore.sh backup-2024-01-15.tar.gz  # Specific backup
```

## AI Agent Interface

The FSM controller provides a JSON interface for AI agents:

```bash
# Check system status
./scripts/fsm-controller.sh status

# Start backup
./scripts/fsm-controller.sh backup

# List available backups
./scripts/fsm-controller.sh list

# Restore from backup
./scripts/fsm-controller.sh restore backup-2024-01-15.tar.gz

# Handle errors
./scripts/fsm-controller.sh error
./scripts/fsm-controller.sh clear-error
```

### Example AI Agent Workflow

```python
import subprocess
import json

def run_controller(command):
    result = subprocess.run(
        ['./scripts/fsm-controller.sh', command],
        capture_output=True, text=True
    )
    return json.loads(result.stdout)

# Check status
status = run_controller('status')
print(f"Current state: {status['data']['state']}")

# Start backup if idle
if status['data']['state'] == 'idle':
    backup_result = run_controller('backup')
    print(f"Backup PID: {backup_result['data']['pid']}")

# Monitor progress
while True:
    status = run_controller('status')
    state = status['data']['state']

    if state == 'backup_done':
        print("Backup complete!")
        break
    elif state.startswith('error'):
        print(f"Error: {status['data']['error']}")
        break

    time.sleep(5)
```

## FSM States

### Backup States

```
idle → backup_init → collect_sources → capture_environment → compress
  → encrypt → upload → verify_upload → cleanup_backup → backup_done
```

### Restore States

```
idle → restore_init → download → verify_download → decrypt → decompress
  → restore_apply → restore_environment → restore_verify → cleanup_restore → restore_done
```

### Error States

- `error_recoverable`: Retry possible
- `error_fatal`: Manual intervention required

## Configuration Reference

### Backup Sources

```bash
# Directories to backup (space-separated)
BACKUP_DIRS="/path/to/dir1 /path/to/dir2"

# Individual files to backup
BACKUP_FILES="/path/to/file1 /path/to/file2"

# Patterns to exclude
EXCLUDE_PATTERNS="node_modules .git __pycache__ *.log"

# Capture environment (pip, npm, dpkg)
CAPTURE_ENVIRONMENT=true
```

### Storage Backends

#### Local Storage

```bash
STORAGE_TYPE="local"
LOCAL_BACKUP_DIR="$HOME/backups"
```

#### AWS S3

```bash
STORAGE_TYPE="s3"
S3_BUCKET="my-backup-bucket"
S3_PREFIX="backups"
S3_REGION="us-east-1"
```

#### Google Cloud Storage

```bash
STORAGE_TYPE="gcs"
GCS_BUCKET="my-backup-bucket"
GCS_PREFIX="backups"
```

#### Azure Blob Storage

```bash
STORAGE_TYPE="azure"
AZURE_CONTAINER="backups"
AZURE_PREFIX="fsm"
AZURE_STORAGE_ACCOUNT="mystorageaccount"
```

### Security

```bash
# Encryption (AES-256-CBC)
ENCRYPTION_ENABLED=true
ENCRYPTION_KEY="your-secret-key"
# Or use key file
ENCRYPTION_KEY_FILE="/path/to/keyfile"

# Checksum algorithm (sha256, sha512, md5)
CHECKSUM_ALGORITHM="sha256"
```

### Retention Policy

```bash
RETENTION_ENABLED=true
RETENTION_DAILY=7    # Keep daily backups for 7 days
RETENTION_WEEKLY=4   # Keep Sunday backups for 4 weeks
RETENTION_MONTHLY=3  # Keep 1st of month for 3 months
```

### Compression

```bash
# Options: gzip, bzip2, xz, zstd, none
COMPRESSION="gzip"
```

## Directory Structure

```
backup-system/
├── config/
│   └── backup.conf       # Configuration file
├── lib/
│   ├── common.sh         # Shared utilities
│   ├── fsm.sh            # FSM state management
│   └── storage.sh        # Multi-backend storage
├── scripts/
│   ├── backup.sh         # Main backup script
│   ├── restore.sh        # Main restore script
│   └── fsm-controller.sh # AI agent interface
├── states/               # FSM state files
├── logs/                 # Operation logs
└── README.md
```

## Command Reference

### backup.sh

```
Usage: backup.sh [OPTIONS]

Options:
    -c, --config FILE     Config file (default: config/backup.conf)
    -n, --name NAME       Backup name prefix (default: backup)
    -o, --output DIR      Output directory
    -r, --resume          Resume from last state
    -d, --dry-run         Show what would be done
    -v, --verbose         Verbose output
    -h, --help            Show this help
```

### restore.sh

```
Usage: restore.sh [OPTIONS] [BACKUP_SOURCE]

Options:
    -c, --config FILE     Config file (default: config/backup.conf)
    -t, --target DIR      Restore target directory
    -l, --list            List available backups
    -L, --latest          Use latest backup
    -e, --env-only        Only restore environment
    -f, --files-only      Only restore files
    -r, --resume          Resume from last state
    -d, --dry-run         Show what would be done
    -v, --verbose         Verbose output
    -h, --help            Show this help
```

### fsm-controller.sh

```
Usage: fsm-controller.sh <COMMAND> [OPTIONS]

Commands:
    status              Get current FSM state and system status
    backup              Start a new backup
    restore [SOURCE]    Start a restore
    list                List available backups
    transition STATE    Manually transition to a state
    error               Get current error information
    clear-error         Clear error state
    config              Show current configuration
    validate            Validate system configuration
    history             Show state transition history
```

## Environment Restoration

The backup captures:
- Python packages (pip freeze)
- Node.js version and global packages
- System packages (dpkg on Debian/Ubuntu, Homebrew on macOS)
- Environment variables (filtered)

To restore environment after file restore:

```bash
bash ~/environment-restore.sh
```

## Error Handling

### Recoverable Errors

- Network failures during upload/download
- Temporary storage unavailability
- Checksum verification retry

These errors can be retried:

```bash
./scripts/fsm-controller.sh clear-error
./scripts/backup.sh -r  # Resume
```

### Fatal Errors

- Decryption failure (wrong key)
- Archive corruption
- Invalid checksum

Require manual intervention:

```bash
./scripts/fsm-controller.sh error  # Check error details
./scripts/fsm-controller.sh transition idle  # Reset to idle
```

## Logging

Logs are stored in `logs/` directory:
- `backup-YYYYMMDDHHMMSS.log` - Backup operations
- `restore-YYYYMMDDHHMMSS.log` - Restore operations

Log levels: DEBUG, INFO, WARN, ERROR, STATE

Set verbose mode:

```bash
./scripts/backup.sh -v
# or
export LOG_LEVEL=DEBUG
```

## Integration with Murray's FSM

This backup system is designed to work with the main Murray's FSM application:

```bash
# Backup Murray's FSM data
BACKUP_DIRS="/path/to/murray-fsm/apps /path/to/murray-fsm/supabase"
BACKUP_FILES="/path/to/murray-fsm/.env /path/to/murray-fsm/package.json"
```

## License

MIT License - Part of Murray's FSM project.
