-- Add password-based authentication to users.
-- Run this in the Supabase SQL Editor.

-- Nullable so existing rows survive the migration. New signups always set it;
-- accounts created before this migration have no password and cannot log in
-- via /users/login until a password is set.
alter table users add column if not exists password_hash text;
