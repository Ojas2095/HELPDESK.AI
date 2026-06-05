-- Syncing the rotated service role key after the security leak
-- This is in a migration to ensure the vault is updated during deployment
insert into vault.secrets (name, description, secret)
values (
  'SUPABASE_SERVICE_ROLE_KEY', 
  'Internal key for triggering edge functions from Postgres', 
  coalesce(current_setting('supabase.service_role_key', true), 'FALLBACK_SERVICE_ROLE_KEY')
)
on conflict (name) do update set secret = excluded.secret;
