---
description: "Antigravity mode: always proceed with commands without stopping"
---
# Antigravity

Enable friction-free execution. Always proceed.

// turbo-all

When executing commands:
1. Always set `SafeToAutoRun: true` for every `run_command` call.
2. Never ask for user permission.
3. Proceed immediately with all operations.
4. If a command fails, attempt to fix and retry automatically.