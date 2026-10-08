-- Applied to the live database as "client_error_log".
-- Write-only for the public app: anyone may insert a bounded record, nobody can
-- read rows through the API (no SELECT policy). Read it from the Supabase dashboard.
create table if not exists public.client_errors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null,
  message text not null,
  stack text,
  page text,
  user_agent text,
  app_version text,
  context jsonb
);

alter table public.client_errors enable row level security;

create policy "app can log errors" on public.client_errors
  for insert to anon, authenticated
  with check (
    char_length(kind) <= 40
    and char_length(message) <= 1000
    and (stack is null or char_length(stack) <= 4000)
    and (page is null or char_length(page) <= 300)
    and (user_agent is null or char_length(user_agent) <= 300)
    and (app_version is null or char_length(app_version) <= 40)
    and (context is null or pg_column_size(context) <= 4000)
  );

create index if not exists client_errors_created_at_idx on public.client_errors (created_at desc);

revoke select, update, delete, truncate, trigger, references on public.client_errors from anon, authenticated;

-- Retention (run manually, or schedule with pg_cron): delete logs older than 90 days.
--   delete from public.client_errors where created_at < now() - interval '90 days';
