-- AgentOS — Code Review Engineer migration.
-- Run this in the Supabase SQL Editor.

-- ── Phase B — enforced action policy ─────────────────────────────────────────
-- Persist the per-agent bearer token. The orchestrator mints it for every
-- agent and injects it into the container; persisting it here lets the gateway
-- authenticate agent-side callers and resolve them to a role for the policy
-- check. The token is cleared when the agent is stopped, so a unique index
-- (NULLs allowed) keeps live tokens distinct without blocking stopped agents.
alter table agents add column if not exists agent_token text;

create unique index if not exists idx_agents_agent_token on agents(agent_token);

-- ── Phase D — agent memory & work log ────────────────────────────────────────
-- Three tables added together. agent_memory is the per-agent key/value store
-- the update-memory skill writes to, injected into role_context at dispatch.
-- agent_action_log is the append-only audit stream every agent-authed gateway
-- call writes a row to (allow + deny). reviewed_prs is Phase C's dedup index,
-- written server-side on a successful POST /github/review.

create table if not exists agent_memory (
    id uuid primary key default gen_random_uuid(),
    agent_id uuid references agents(id) on delete cascade not null,
    key text not null,
    value text not null,
    updated_at timestamptz default now(),
    unique(agent_id, key)
);

create index if not exists idx_agent_memory_agent_id on agent_memory(agent_id);

create table if not exists agent_action_log (
    id uuid primary key default gen_random_uuid(),
    agent_id uuid references agents(id) on delete cascade not null,
    action text not null,
    outcome text not null check (outcome in ('allowed', 'denied')),
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz default now()
);

create index if not exists idx_agent_action_log_agent_id on agent_action_log(agent_id);
create index if not exists idx_agent_action_log_created_at on agent_action_log(created_at desc);

create table if not exists reviewed_prs (
    id uuid primary key default gen_random_uuid(),
    agent_id uuid references agents(id) on delete cascade not null,
    owner text not null,
    repo text not null,
    pr_number int not null,
    reviewed_at timestamptz default now(),
    unique(agent_id, owner, repo, pr_number)
);

create index if not exists idx_reviewed_prs_agent_id on reviewed_prs(agent_id);

-- RLS — same closed-by-default pattern as the existing tables.
alter table agent_memory enable row level security;
alter table agent_action_log enable row level security;
alter table reviewed_prs enable row level security;

drop policy if exists "Service role full access on agent_memory" on agent_memory;
drop policy if exists "Service role full access on agent_action_log" on agent_action_log;
drop policy if exists "Service role full access on reviewed_prs" on reviewed_prs;

create policy "Service role full access on agent_memory" on agent_memory for all using (true);
create policy "Service role full access on agent_action_log" on agent_action_log for all using (true);
create policy "Service role full access on reviewed_prs" on reviewed_prs for all using (true);
