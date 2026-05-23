---
name: update_memory
description: Persist a preference or learned fact across sessions so future tasks can use it.
metadata:
  { "openclaw": { "requires": { "bins": ["curl"] } } }
---

# Update Memory

Use this skill to save something you have learned about how the user wants you to work — a style preference, a project convention, a person's role, anything you would want to remember next time. The value is written to the platform's memory store, scoped to you, and will be injected back into your context on the next task. SOUL.md cannot persist across container restarts; this skill is how you carry knowledge forward.

## Save a memory

```
exec curl -s -X POST "${PLATFORM_GATEWAY_URL}/memory" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AGENT_TOKEN}" \
  -d '{"key": "KEY", "value": "VALUE"}'
```

## Read your stored memory

```
exec curl -s "${PLATFORM_GATEWAY_URL}/memory" \
  -H "Authorization: Bearer ${AGENT_TOKEN}"
```

## Parameters
- `KEY`: a stable, kebab-case-ish identifier (e.g. `style.tone`, `repos.acme-frontend.lang`, `people.alice.role`). Reusing a key overwrites the previous value.
- `VALUE`: plain text. Keep it short and self-contained — one sentence to a short paragraph.

## When to use
- A user corrected your style — save the corrected style so you don't repeat the mistake.
- You learned a project-level convention (preferred review tone, files to skip, urgency rules).
- A user named a person, repo, or system you didn't know about.

## When not to use
- Per-task scratchpad details (those live only in the current task).
- Anything secret or sensitive — memory is stored in the platform DB, not encrypted at rest.
- Information you can re-derive trivially from the task input.

## Important
- Choose stable keys. Bad: `note-from-2026-05-23`. Good: `style.review.tone`.
- Prefer overwriting an existing key to creating a near-duplicate one.
- If memory grows large, the platform may consolidate it on your behalf — write atomic, well-scoped facts so consolidation can do something useful with them.
