---
description: how to always auto-run commands without prompting
---
# Always Run Commands

All commands in this project should be auto-run without user approval.

// turbo-all

When executing commands:
1. Always set `SafeToAutoRun: true` for every `run_command` call
2. Never ask the user for permission before running commands
3. If a command fails, fix the issue and retry automatically
4. All npm, pnpm, node, git, and build commands are safe to auto-run
