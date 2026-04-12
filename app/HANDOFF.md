# Frontend Handoff — Hire Flow

Welcome. You're picking up the frontend for **Fiverr for OpenClaw**, a hackathon project. This brief exists so you don't have to re-derive decisions that were already made. Skim it top to bottom once, then start on "First 5 tasks" at the bottom.

---

## What this is in one paragraph

A managed platform that lets a non-technical buyer hire a real, containerized OpenClaw-powered AI employee in two clicks. The backend already spins up OpenClaw containers, dispatches tasks to them over HTTP, and stores OAuth credentials. Your job is the UI that takes a buyer from "I'd like a Code Review Engineer" to "my Code Review Engineer is running." For the full product thinking, read `../PROJECT_CONTEXT.md`. For the go-forward plan, read `../ROADMAP.md` (start at the 🏁 Hackathon Scope callout at the top). For day-to-day conventions, read `../CLAUDE.md`.

## Hackathon scope — what to build and what to skip

**Build (in order):**

1. **Landing page** (`/`) — already a placeholder; turn it into a real pitch page with the two starter employees featured.
2. **Talent directory** (`/directory`) — filterable grid of hireable employees. For v1 it's just two cards from `lib/employees.ts`.
3. **Employee profile** (`/directory/[role]`) — the Fiverr gig-detail analogue. "I will…" hero, autonomy tiers, sample outputs, required tools, Hire CTA.
4. **Hire flow** (`/hire/[role]`) — 4-step wizard. See "Hire flow step-by-step" below.
5. **Confirmation** (`/hire/[role]/confirm`) — "Meet your new employee." That's the demo bar. Don't build further.

**Skip (explicitly out of scope for the hackathon):**

- `/team` (post-hire employee roster)
- Employee workspace / work log / audit trail
- Performance review screens
- Offboarding UI
- Billing, Stripe, payment gates, trial logic
- Any employee role beyond the two in `lib/employees.ts`
- Real OAuth for Slack or Gmail (stay stubbed)

**The hackathon demo bar:** *"hired and running is enough."* A user clicks Hire → OAuth consent (real for GitHub, simulated for Slack/Gmail) → brief → confirm → container spins up and the confirmation screen says the employee is live. The employee does not have to actually do work in the demo.

---

## Non-negotiable rules

### Terminology — these are banned

The product enforces a hiring metaphor. These words must not appear in routes, components, variable names, UI copy, or commit messages:

| Use | Never use |
|---|---|
| AI employee / digital teammate | agent |
| talent directory / hiring board | marketplace |
| onboarding | configuration / setup |
| role and access policy | ACL / permissions |
| performance review / work log | dashboard / monitoring |
| work style / playbook | prompt / system prompt |
| offboarding | deprovisioning / teardown |

The **backend still uses `agent` in its routes** (`POST /agents`, etc.) because renaming the Python/SQL is a separate cleanup. Translate at the Next.js API-route boundary: your frontend exposes `/api/employees`, `/api/directory`, `/api/hire`, and those handlers proxy to the backend's `/agents` routes. Users never see the banned words.

### Next.js 16 has breaking changes

Read `app/AGENTS.md`. APIs, conventions, and file structure may all differ from what you remember. Before writing anything non-trivial, check `node_modules/next/dist/docs/`.

### Persona style: role-only, iconographic

No human names, no photos, no illustrated avatars. Clean role icons and role names. "Code Review Engineer," not "Maya." Keeps the vibe professional and avoids the uncanny-valley debate. Persona depth can come later.

---

## Hire flow step-by-step

Four steps. Happy path feels like two clicks.

### Step 1 — Profile + autonomy tier

- Reuses the employee profile page content (hero, "I will…" tagline, sample outputs).
- Below that, three tier cards: **Observer / Assistant / Operator**. Tier definitions live in `lib/employees.ts` → `tiers`.
- User picks one, clicks Next.
- **No backend call yet** — just local wizard state.

### Step 2 — Connect tools

- Read `employees[role].requiredTools` — an ordered list like `["github"]` or `["slack", "gmail"]`.
- For each tool, render a row: tool name, scope disclosure ("can read PRs and post comments, cannot merge"), Connect button.
- **GitHub uses real OAuth:** Connect button opens the GitHub consent URL (you'll need to build the callback — see "Backend contract" below). Callback stores the token via backend `POST /credentials`.
- **Slack and Gmail use a simulated consent screen:** clicking Connect opens a modal that looks like an OAuth consent screen, user clicks Approve, we write a placeholder token via `POST /credentials` with `service: "slack"` / `"gmail"`.
- All tools must be connected before Next becomes active.

### Step 3 — Brief (work style)

- Read `employees[role].briefFields` — an array like `[{key, label, placeholder, helper}]`. Render each as a text input.
- The three fields are always: **scope** (repos / channels / labels), **cadence** (when to work), **nickname** (optional display name).
- No per-action autonomy overrides, no advanced settings, no power-user mode. Three fields, that's it.

### Step 4 — Confirm

- Summary card: role, tier, connected tools, brief values.
- **Hire button hits `POST /api/employees`** which proxies to backend `POST /agents` with body `{ role: "code-review-engineer", config: { tier, ...briefValues } }`.
- On success, redirect to `/hire/[role]/confirm` which shows "Meet your new employee" + container status polling. Poll `GET /api/employees/[id]` until `status === "running"`, then show success. This is the hackathon demo bar.

---

## Backend contract

The FastAPI backend lives at `../backend/`. It already handles OAuth token storage, container lifecycle, and task dispatch. You only talk to it through Next.js API routes (translation boundary).

| Frontend route | Method | Proxies to backend | Purpose |
|---|---|---|---|
| `/api/directory` | GET | (stub, read from `lib/employees.ts`) | List hireable roles. **Backend `GET /roles` does not exist yet** — stub from `employees.ts` until it lands. |
| `/api/credentials/[service]/connect` | GET | GitHub OAuth URL (redirect) | Start real OAuth for GitHub. |
| `/api/credentials/[service]/callback` | GET | `POST /credentials` | Receive OAuth callback, store token. |
| `/api/credentials/[service]/simulate` | POST | `POST /credentials` | Simulated OAuth write for Slack/Gmail. |
| `/api/employees` | POST | `POST /agents` | Hire. Body `{ role, config }`. |
| `/api/employees/[id]` | GET | `GET /agents/{id}` | Status poll. |
| `/api/employees/[id]` | DELETE | `DELETE /agents/{id}` | Offboard. Out of scope for v1 but wire the route. |

### Example: hire request shapes

```ts
// POST /api/employees
// Request body:
{
  role: "code-review-engineer",
  config: {
    tier: "assistant",
    repos: "acme/frontend, acme/backend",
    cadence: "on PR open",
    nickname: "Reviewer #1"
  }
}

// Proxied to backend POST /agents:
{
  role: "code-review-engineer",
  config: { /* same */ }
}

// Backend responds with AgentResponse:
{
  id: "a_abc123",
  user_id: "u_xyz",
  role: "code-review-engineer",
  container_id: "docker_...",
  status: "pending" | "running" | "stopped" | "error",
  config_json: { /* echoed */ },
  created_at: "2026-04-12T..."
}
```

### What the backend still needs before you can fully wire this

The backend engineer is in parallel adding:

1. **Role templates:** `backend/agent-config/templates/code-review-engineer.yaml` and `customer-support.yaml`. Only `secretary.yaml` exists today. Until those land, hiring will fail because the orchestrator won't find the template.
2. **`GET /roles` endpoint** returning the list of hireable templates. You can work ahead of this by stubbing `/api/directory` from `lib/employees.ts`.
3. **Real GitHub OAuth app registration** + backend redirect/callback handler. You can build the frontend consent-step UI against a mock URL and swap it when the real redirect URL is ready.

If any of these block you, build the surface assuming the final shape and leave a TODO. The hackathon is about shipping the walkable flow.

---

## Seed data

`app/lib/employees.ts` is the source of truth for what's in the directory during the hackathon. It contains two typed entries:

- `code-review-engineer` — GitHub only, real OAuth
- `customer-support` — Slack + Gmail, simulated OAuth

Each entry has `tiers`, `briefFields`, and `sampleOutputs` — enough to render the full profile page and all four hire-flow steps without inventing data. Edit it freely as the UI evolves; just keep the ids matching the backend role names.

## Design direction

- **Fiverr parallels we're leaning on:** "I will…" taglines (every employee leads with an outcome statement), three-tier pricing card (repurposed as the autonomy dial), sample-work portfolio (trust signal in place of review volume), response-time stat (here it's "work cadence").
- **Fiverr parallels we're not leaning on:** freelancer bidding, messaging with sellers before buying, revision cycles, "order delivered" states. Ours is persistent employment, not episodic orders.
- **Stack:** Next.js 16, Tailwind v4, shadcn/ui. Primitives are in `app/components/ui/` (avatar, badge, button, card, dialog, input, scroll-area, separator, tabs, textarea). `app/lib/utils.ts` has `cn()`. Install more shadcn components as needed.
- **Dark mode only** — `html` has `className="dark"` hardcoded in `layout.tsx`. Leave it that way for the hackathon.

---

## First 5 tasks

1. **Boot the project.** `cd app && npm install && npm run dev`. You should land on the placeholder at `http://localhost:3000` showing two employee cards from `lib/employees.ts`. If the import breaks, the scaffold scrub commit (`2ecedd0` or the commit labeled `chore(app): scrap wrong-concept reader scaffold`) is your reference point.
2. **Build `/directory`.** Filterable grid of cards from `employees.ts`. Filter by department (engineering / support) and required tools. Each card links to `/directory/[role]`.
3. **Build `/directory/[role]`.** Employee profile page. Hero with icon + tagline + department chip; three tier cards in a row; sample outputs as a stack; required tools list; prominent "Hire" CTA linking to `/hire/[role]`.
4. **Build the hire flow shell** at `/hire/[role]`. Wizard with 4 stepper segments, local state for tier / credentials / brief. Stub backend calls with console logs for now; confirmation screen is a hardcoded "Meet your new employee" until the API wiring is ready.
5. **Wire the Next.js API routes** per "Backend contract" above. Proxy `/api/employees` to the backend at whatever URL is in `NEXT_PUBLIC_PLATFORM_URL` (add to `.env.local` with a sane local default). When the backend engineer merges the role templates + GitHub OAuth + `GET /roles`, flip the stub off.

When all 5 are done you have a walkable hire flow. Everything else is polish.

---

## Questions the brainstorm left open for you

These didn't block the handoff but are yours to call:

- **Hire button success animation.** Fiverr does nothing special. We probably want the "meet your new employee" moment to feel like a moment — what's the payoff animation? Container spin-up progress bar? Confetti? Your call.
- **Empty state for `/directory`.** Only two employees exist. Do we lean into that ("hand-curated starter roster") or pad with "coming soon" cards? Recommendation: lean in. Two polished cards beat four cluttered ones.
- **Autonomy tier comparison.** Fiverr shows three columns side by side. Our tiers are conceptually different — a dial rather than a menu. Is a three-column card row still the right metaphor, or should we experiment with a slider + dynamic description? Start with the three columns, iterate if time allows.

---

## If you get stuck

- Read `../CLAUDE.md` and `../ROADMAP.md` (especially the 🏁 Hackathon Scope callout).
- Check recent commits for context: `git log --oneline -20`.
- Backend source lives at `../backend/` — `backend/app/routers/agents.py` and `backend/app/routers/credentials.py` are the two files you need to understand the contract.
- The plan that led to this handoff is at `~/.claude/plans/goofy-yawning-spring.md` if you want the reasoning trail.
