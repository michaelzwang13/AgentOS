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
