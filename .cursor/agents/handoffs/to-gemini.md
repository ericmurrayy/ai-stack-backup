# Handoffs for Gemini 3 Pro
> Documentation, research, analysis

---

## How to Use This File

Other models write tasks here when they need Gemini's expertise:
- API documentation
- README updates
- Library research
- Requirements analysis
- User guides

---

## Current Tasks

### Task: Research Retell AI vs Alternatives
**From**: Claude
**Priority**: Medium
**Created**: 2026-02-02

#### Context
We chose Retell AI for phone answering, but should document why and any alternatives.

#### Request
Create comparison document:
1. Retell AI features and pricing
2. Alternatives: Bland AI, Vapi, Twilio Voice
3. Why Retell was chosen
4. Integration complexity comparison

#### Expected Output
Add to `docs/PHONE_AI_COMPARISON.md`

---

## Template for Adding Tasks

```markdown
## Task: [Title]
**From**: Claude/GPT/Grok
**Priority**: High/Medium/Low
**Created**: YYYY-MM-DD HH:MM

### Context
[Background]

### Request
[What to research/document]

### Expected Output
[Document location]
```

---

## Completed Tasks

*See `.cursor/agents/completed/` for history*
