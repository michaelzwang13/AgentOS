-- Expand the service allowlist to include github and hubspot
-- Run in Supabase SQL Editor

alter table credentials
  drop constraint if exists credentials_service_check;

alter table credentials
  add constraint credentials_service_check
  check (service in ('gmail', 'slack', 'discord', 'github', 'hubspot'));
