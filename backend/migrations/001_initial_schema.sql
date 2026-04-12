-- Run this in Supabase SQL Editor to set up the schema

-- Users table
create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    email text unique not null,
    name text not null,
    api_key text unique not null,
    created_at timestamptz default now()
);

-- Agents table
create table if not exists agents (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references users(id) on delete cascade not null,
    role text not null,
    container_id text,
    status text not null default 'pending' check (status in ('pending', 'running', 'stopped', 'error')),
    config_json jsonb default '{}'::jsonb,
    created_at timestamptz default now()
);

create index if not exists idx_agents_user_id on agents(user_id);
create index if not exists idx_agents_status on agents(status);

-- Credentials table
create table if not exists credentials (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references users(id) on delete cascade not null,
    service text not null check (service in ('gmail', 'slack', 'discord')),
    encrypted_token text not null,
    scopes text[] default '{}',
    created_at timestamptz default now(),
    unique(user_id, service)
);

create index if not exists idx_credentials_user_id on credentials(user_id);

-- Enable Row Level Security
alter table users enable row level security;
alter table agents enable row level security;
alter table credentials enable row level security;

-- Policies (service-role key bypasses RLS, so these are for anon/authenticated access)
create policy "Service role full access on users" on users for all using (true);
create policy "Service role full access on agents" on agents for all using (true);
create policy "Service role full access on credentials" on credentials for all using (true);
