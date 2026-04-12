# Fiverr for OpenClaw — AI Employee Platform

> **Hackathon scope.** This document is the full brainstorming context, much of which describes the post-hackathon product. For the hackathon demo we ship a single path: landing → talent directory → employee profile → hire flow wired to the backend. Two starter employees (Code Review Engineer, Customer Support). Real OAuth for GitHub only. No billing. See `ROADMAP.md` for the hackathon callout and `CLAUDE.md` for decisions.

## One-liner
A managed platform that packages OpenClaw instances as specialized, containerized AI employees that companies hire in two clicks — no code, no setup, no self-hosting.

## The Problem
1. OpenClaw is powerful but the setup threshold is too high for most teams
2. The "AI employee" market right now is just automated workflows with better branding (Lindy, Sintra, Relevance)
3. No product treats AI agents as actual persistent teammates with memory, initiative, and judgment

## The Core Insight
Fiverr works because a bakery owner can't make their own logo. The parallel here: teams that need specialized capacity (triage, CRM cleanup, support routing) but can't justify a hire and don't have time to configure OpenClaw themselves.

## What Makes an "Employee" Different from a Workflow
A workflow runs when triggered. An employee owns an outcome.

Each AI employee has:
- **Memory** — remembers past interactions, learns preferences, builds context over time
- **Initiative** — notices things without being triggered, follows up on its own work
- **Judgment** — prioritizes, decides what's worth mentioning vs ignoring
- **Relationships** — communicates differently with different people based on history
- **Role boundaries** — the Code Review Engineer doesn't start triaging issues
- **Coachability** — gets better at its specific job based on feedback

This is the differentiation. Not prompt templates. Persistent identity with evolving understanding.

## Architecture

```
OpenClaw (open-source engine)
    | packaged into
Pre-configured "employees" (containerized + specialized skills + isolated memory)
    | hosted on
Platform (auth gateway, permissions, billing, audit trail)
    | customer clicks "hire"
AI employee shows up in their Slack/GitHub/tools
```

### Platform → Agent Communication (Implemented)
Each agent container runs a lightweight FastAPI server on port 8080. The platform dispatches tasks to agents via HTTP POST to the container's internal IP on the Docker bridge network (`openclaw-agents`). All containers run on a single VPS.

```
Platform API                    Agent Container
POST /agents/{id}/tasks    →    POST :8080/task       (assign work)
GET  /agents/{id}/tasks/status → GET :8080/status     (check progress)
POST /agents/{id}/tasks/cancel → POST :8080/cancel    (cancel work)
```

Key components:
- `backend/agent-runtime/server.py` — Task server sidecar (receives tasks, forwards to OpenClaw)
- `backend/agent-runtime/entrypoint.sh` — Bootstraps OpenClaw config and starts both services
- `backend/app/services/dispatcher.py` — Platform-side HTTP client that sends tasks to containers
- `backend/app/services/orchestrator.py` — Manages container lifecycle, resolves container IPs via Docker SDK

### OpenClaw + Kimi Integration (Implemented)
Each agent container is built on top of the official OpenClaw Docker image (`ghcr.io/openclaw/openclaw:latest`). The entrypoint script bootstraps OpenClaw with:
- `openclaw.json` — configures Kimi K2.5 (Moonshot AI) as the LLM provider
- `SOUL.md` — agent persona and role boundaries, generated from env vars
- `AGENTS.md` — operating instructions for task handling

```
Agent Container
├── OpenClaw Gateway (port 18789) ← runs Kimi K2.5 via Moonshot API
└── Task Server (port 8080) ← receives tasks from platform, forwards to OpenClaw
```

When a task arrives, the task server sends the instruction to OpenClaw's local `/api/v1/chat` endpoint. OpenClaw processes it using Kimi K2.5 and returns the result.

### Auth Model (OAuth Gateway Pattern)
- Platform registers as OAuth App with each provider (GitHub, Slack, Linear, etc.)
- Customer clicks "Connect GitHub" -> standard OAuth consent flow -> platform stores tokens
- OpenClaw containers NEVER hold raw tokens
- Auth gateway sits between container and external APIs:
  1. Validates request
  2. Checks role permissions ("can comment but NOT merge")
  3. Injects OAuth token
  4. Logs action (audit trail)
  5. Forwards to API
- Configurable autonomy: gateway can hold actions for customer approval or pass through
- Offboarding = revoke token, one click

### Per-Employee Isolation
- One container per employee per customer
- Own memory store (what this employee has learned about this job)
- Own role policy (what actions are allowed)
- Own communication style and context

## Hackathon Starter Employees (2)

The hackathon demo ships exactly two employees — one engineering, one non-engineering — to prove the hiring metaphor end-to-end without drowning in role authoring.

1. **Code Review Engineer** — engineering side. "I will review every PR within 10 minutes of it opening." GitHub OAuth (real). Sample output: inline review comments on a real PR.
2. **Customer Support** — non-engineering side. "I will triage every incoming support message and draft a reply." Slack + Gmail (simulated OAuth for the hackathon). Sample output: categorized ticket + draft response.

Both roles need YAML templates in `backend/agent-config/templates/` before the hire flow can actually create agents. Only `secretary.yaml` exists today.

## Post-Hackathon Employee Candidate Pool (10)
Preserved from the pre-hackathon brainstorm. Optimized for visible impact within 24 hours, text-in/text-out, replacing $500-2k/month freelancer work. The hackathon's two starter employees are drawn/adapted from this list.

1. **Code Review Engineer** — reviews every PR automatically *(hackathon starter)*
2. **Standup Reporter** — posts daily summary of what changed across repos/channels
3. **Issue Triage Engineer** — labels, prioritizes, routes incoming issues
4. **CRM Cleanup Manager** — deduplicates, fills missing fields, flags dead leads
5. **Support Ticket Router** — reads incoming tickets, categorizes, routes to right person *(basis for hackathon Customer Support)*
6. **Changelog Writer** — turns merged PRs into customer-facing release notes
7. **Meeting Notes Summarizer** — joins calls or reads transcripts, posts structured summaries
8. **Expense Categorizer** — reads receipts/invoices, categorizes, flags policy violations
9. **Content Repurposer** — takes blog posts and generates social posts, email snippets, threads
10. **Competitor Monitor** — watches competitor sites/changelogs, posts weekly digest

## Terminology (enforced throughout product)
- AI employees / digital teammates — NOT "agents"
- Talent directory / hiring board — NOT "marketplace"
- Onboarding — NOT "configuration" or "setup"
- Role and access policy — NOT "ACL" or "permissions"
- Performance review / work log — NOT "dashboard" or "monitoring"
- Work style / playbook — NOT "prompt" or "system prompt"
- Offboarding — NOT "deprovisioning" or "teardown"

## Business Model
- Monthly "salary" per AI employee (consider value-based or usage-based pricing over flat salary)
- Phase 1: First-party flagship employees to establish trust and quality
- Phase 2: Curated creator marketplace (App Store model) — third-party devs define employee behavior, platform handles infra/auth/billing, platform takes a cut

## Key Risks (acknowledged)
1. **OpenClaw launches their own cloud** — biggest existential risk, need defensible layers beyond just hosting
2. **Platform giants absorb the use case** — GitHub Copilot, Cursor, OpenAI Codex all converging on "AI teammate"
3. **Thin moat if value is only "easier setup"** — real moat must be: skill packages, memory/coaching layer, trust infrastructure, and marketplace network effects
4. **LLM costs vs low price point tension** — container + API calls + memory = $30-50/month floor per employee

## Defensible Layers (in order of priority)
1. **Skill marketplace** — curated, tested skill packages that specialize raw OpenClaw into roles
2. **Trust infrastructure** — permissions, audit, approval flows
3. **Memory/coaching layer** — employees that get better at their specific job over time, cross-customer learnings

## Target Customer
20-80 person teams (Series A-C startups). Big enough to have real pain, small enough to not have dedicated specialists for every function, culturally open to trying new tools.

## Open Questions
- What is the actual technical moat beyond packaging?
- Can the "teammate" experience work reliably with current model capabilities?
- Who is the buyer — eng manager, VP, individual contributor?
- What is the creator marketplace flywheel for Phase 2?
- Can we reach $1M ARR before the competitive window closes (12-18 months)?
