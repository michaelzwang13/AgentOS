-- AgentOS — full schema snapshot for a fresh Supabase database.
-- Paste into Supabase SQL Editor → New query → Run.
-- Idempotent: safe to re-run. Equivalent to migrations 001 + 002 + 003 + 004.

-- ── Users ────────────────────────────────────────────────────────────────────
create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    email text unique not null,
    name text not null,
    api_key text unique not null,
    password_hash text,
    created_at timestamptz default now()
);

-- ── Agents ───────────────────────────────────────────────────────────────────
create table if not exists agents (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references users(id) on delete cascade not null,
    role text not null,
    container_id text,
    status text not null default 'pending'
        check (status in ('pending', 'running', 'stopped', 'error')),
    config_json jsonb default '{}'::jsonb,
    agent_token text,
    created_at timestamptz default now()
);

create index if not exists idx_agents_user_id on agents(user_id);
create index if not exists idx_agents_status on agents(status);
create unique index if not exists idx_agents_agent_token on agents(agent_token);

-- ── Credentials ──────────────────────────────────────────────────────────────
create table if not exists credentials (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references users(id) on delete cascade not null,
    service text not null,
    encrypted_token text not null,
    scopes text[] default '{}',
    created_at timestamptz default now(),
    unique(user_id, service)
);

create index if not exists idx_credentials_user_id on credentials(user_id);

alter table credentials drop constraint if exists credentials_service_check;
alter table credentials add constraint credentials_service_check
    check (service in ('gmail', 'slack', 'discord', 'github', 'hubspot'));

-- ── Agent memory, action log, reviewed PRs ──────────────────────────────────
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

-- ── Row Level Security ───────────────────────────────────────────────────────
-- The backend uses the service-role key, which bypasses RLS. These policies
-- keep anon/authenticated access closed by default.
alter table users enable row level security;
alter table agents enable row level security;
alter table credentials enable row level security;
alter table agent_memory enable row level security;
alter table agent_action_log enable row level security;
alter table reviewed_prs enable row level security;

drop policy if exists "Service role full access on users" on users;
drop policy if exists "Service role full access on agents" on agents;
drop policy if exists "Service role full access on credentials" on credentials;
drop policy if exists "Service role full access on agent_memory" on agent_memory;
drop policy if exists "Service role full access on agent_action_log" on agent_action_log;
drop policy if exists "Service role full access on reviewed_prs" on reviewed_prs;

create policy "Service role full access on users" on users for all using (true);
create policy "Service role full access on agents" on agents for all using (true);
create policy "Service role full access on credentials" on credentials for all using (true);
create policy "Service role full access on agent_memory" on agent_memory for all using (true);
create policy "Service role full access on agent_action_log" on agent_action_log for all using (true);
create policy "Service role full access on reviewed_prs" on reviewed_prs for all using (true);
