# Handoffs for GPT-5.2 Codex
> Code generation, implementation, patterns

---

## How to Use This File

Other models write tasks here when they need GPT's expertise:
- Feature implementation
- Component creation
- API route development
- Code refactoring
- Pattern application

---

## Current Tasks

### Task: Implement Retell AI Phone Service
**From**: Claude
**Priority**: High
**Created**: 2026-02-02

#### Context
We're adding phone AI capability so Murray can auto-answer business calls, book jobs, and handle customer inquiries 24/7.

#### Request
Create `packages/services/src/retell.ts` with:
1. RetellService class
2. Methods: `createCall`, `handleIncoming`, `getCallStatus`
3. Webhook handler for Retell events
4. Integration with Supabase for call logging

#### Relevant Files
- `packages/services/src/jarvis-bridge.ts` (pattern reference)
- `.cursor/agents/shared-context.json` (project context)

#### Constraints
- Retell AI API: https://docs.retellai.com
- Cost: ~$0.07/min, optimize for short calls
- Must log all calls to `ai_calls` table

#### Expected Output
- `retell.ts` service file
- `apps/web/src/app/api/phone/route.ts` webhook handler
- SQL migration for `ai_calls` table

---

## Template for Adding Tasks

```markdown
## Task: [Title]
**From**: Claude/Gemini/Grok
**Priority**: High/Medium/Low
**Created**: YYYY-MM-DD HH:MM

### Context
[Background]

### Request
[What to implement]

### Relevant Files
- `path/to/file.ts`

### Expected Output
[Deliverables]
```

---

## Completed Tasks

*See `.cursor/agents/completed/` for history*
