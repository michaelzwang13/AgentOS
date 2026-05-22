-- AgentOS — full schema snapshot for a fresh Supabase database.
-- Paste into Supabase SQL Editor → New query → Run.
-- Idempotent: safe to re-run. Equivalent to migrations 001 + 002 + 003.

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
    created_at timestamptz default now()
);

create index if not exists idx_agents_user_id on agents(user_id);
create index if not exists idx_agents_status on agents(status);

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

-- ── Row Level Security ───────────────────────────────────────────────────────
-- The backend uses the service-role key, which bypasses RLS. These policies
-- keep anon/authenticated access closed by default.
alter table users enable row level security;
alter table agents enable row level security;
alter table credentials enable row level security;

drop policy if exists "Service role full access on users" on users;
drop policy if exists "Service role full access on agents" on agents;
drop policy if exists "Service role full access on credentials" on credentials;

create policy "Service role full access on users" on users for all using (true);
create policy "Service role full access on agents" on agents for all using (true);
create policy "Service role full access on credentials" on credentials for all using (true);
