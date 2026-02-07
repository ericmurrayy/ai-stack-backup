# AI Model Routing Guide

This project uses 4 AI models that work together. Use this guide to choose the right model for each task.

## Model Overview

| Model | Strengths | Cost | Speed |
|-------|-----------|------|-------|
| **Claude Opus 4.5** | Complex reasoning, architecture | $$$$ | Medium |
| **GPT-5.2 Codex** | Code generation, patterns | $$$ | Fast |
| **Gemini 3 Pro** | Research, documentation | $$ | Fast |
| **Grok Code** | Quick fixes, debugging | $ | Fastest |

## Task Routing Matrix

| Task Type | Primary | Backup | Notes |
|-----------|---------|--------|-------|
| Architecture decisions | Claude | GPT | Best for trade-off analysis |
| New feature implementation | GPT | Grok | Fast, accurate code gen |
| Complex refactoring | Claude | GPT | Needs deep understanding |
| API integration | GPT | Claude | Pattern matching strength |
| Bug fixes | Grok | GPT | Speed is key |
| Unit tests | Grok | GPT | Quick coverage |
| Documentation | Gemini | Claude | Good prose, research |
| Research/comparison | Gemini | Claude | Web search capability |
| Type fixes | Grok | GPT | Fast, precise |
| Database schema | Claude | GPT | Architecture decision |
| UI components | GPT | Grok | Component patterns |
| Performance optimization | Claude | GPT | Needs analysis |

## Decision Tree

```
START
  │
  ├─ Is it a quick fix (<10 lines)?
  │   └─ YES → Grok
  │
  ├─ Does it need architecture decision?
  │   └─ YES → Claude
  │
  ├─ Is it documentation or research?
  │   └─ YES → Gemini
  │
  ├─ Is it code implementation?
  │   └─ YES → GPT
  │
  └─ Not sure?
      └─ Start with Grok (cheapest), escalate if needed
```

## Cost Optimization Rules

### Rule 1: Start Cheap
Always try the cheapest capable model first:
1. Grok ($0.01/task) - Quick fixes, tests
2. Gemini ($0.02/task) - Docs, research
3. GPT ($0.05/task) - Code generation
4. Claude ($0.10/task) - Complex decisions

### Rule 2: Escalate Smartly
Only escalate when:
- Grok → GPT: Fix is more complex than expected
- GPT → Claude: Architecture implications discovered
- Gemini → Claude: Research reveals complex trade-offs

### Rule 3: Batch Similar Tasks
Group tasks by model to maintain context:
- All quick fixes → Grok session
- All implementations → GPT session
- All docs → Gemini session

## Inter-Agent Communication

Models communicate via `.cursor/agents/`:

```
.cursor/agents/
├── shared-context.json    # Project state (all read)
├── handoffs/
│   ├── to-claude.md       # Architecture tasks
│   ├── to-gpt.md          # Implementation tasks
│   ├── to-gemini.md       # Documentation tasks
│   └── to-grok.md         # Quick fix tasks
└── completed/             # Finished handoffs
```

### Handoff Tags
Use these in code comments:
```typescript
// [HANDOFF:GPT] Implement the calculateTotal function
// [HANDOFF:CLAUDE] Need architecture decision for caching strategy
// [HANDOFF:GEMINI] Document this API endpoint
// [HANDOFF:GROK] Fix the type error on line 42
// [BLOCKED:waiting-for-api-key] Cannot proceed without credentials
// [COMPLETED:user-auth] Authentication feature done
```

## Model-Specific Prompts

Located in `.cursor/agents/prompts/`:
- `claude-architect.md` - Architecture decisions
- `gpt-coder.md` - Code generation
- `gemini-docs.md` - Documentation
- `grok-debug.md` - Quick fixes

## Example Workflow

**Task**: Add Stripe payment integration

1. **User asks Claude**: "Add Stripe payment to FSM"
2. **Claude (Architect)**:
   - Designs payment flow architecture
   - Decides on webhook strategy
   - Updates shared-context.json
   - Creates handoff: `[HANDOFF:GPT] Implement StripeService`

3. **GPT (Coder)**:
   - Reads shared context
   - Implements `packages/services/src/stripe.ts`
   - Creates API routes
   - Handoff: `[HANDOFF:GEMINI] Document Stripe integration`

4. **Gemini (Docs)**:
   - Writes API documentation
   - Creates setup guide
   - Handoff: `[HANDOFF:GROK] Add payment tests`

5. **Grok (Tester)**:
   - Writes unit tests
   - Marks `[COMPLETED:stripe-integration]`

**Total cost**: ~$0.18 (Claude $0.10 + GPT $0.05 + Gemini $0.02 + Grok $0.01)

## Cursor Settings

### Recommended Agent Config
In Cursor Settings > Agents, create these agents:
- **claude-architect**: Claude Opus, uses `claude-architect.md` prompt
- **gpt-coder**: GPT Codex, uses `gpt-coder.md` prompt
- **gemini-docs**: Gemini Pro, uses `gemini-docs.md` prompt
- **grok-debug**: Grok, uses `grok-debug.md` prompt

### Rules
Add these rules in Cursor Settings:
1. Always read `.cursor/agents/shared-context.json` first
2. Follow `.cursorrules` for project conventions
3. Update shared-context.json after major changes
4. Create handoffs for tasks outside your expertise
