-- Applied to the live database as "ai_timings". Durations only — no prompts, answers, names, emails or IPs.
create table if not exists public.ai_timings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null,
  provider text,
  model text,
  ok boolean,
  status integer,
  client_ms integer not null,
  server_ms integer,
  chars integer,
  app_version text,
  extra jsonb
);
alter table public.ai_timings enable row level security;
create policy "app can log timings" on public.ai_timings
  for insert to anon, authenticated
  with check (
    char_length(kind) <= 30
    and (provider is null or char_length(provider) <= 20)
    and (model is null or char_length(model) <= 60)
    and client_ms between 0 and 600000
    and (server_ms is null or server_ms between 0 and 600000)
    and (chars is null or chars between 0 and 100000)
    and (app_version is null or char_length(app_version) <= 40)
    and (extra is null or pg_column_size(extra) <= 1000)
  );
create index if not exists ai_timings_created_at_idx on public.ai_timings (created_at desc);
create index if not exists ai_timings_kind_idx on public.ai_timings (kind, created_at desc);
revoke select, update, delete, truncate, trigger, references on public.ai_timings from anon, authenticated;

-- Handy summary (run in the SQL editor):
--   select kind, provider, count(*) n,
--          percentile_cont(0.5) within group (order by client_ms) p50_ms,
--          percentile_cont(0.95) within group (order by client_ms) p95_ms
--   from public.ai_timings where created_at > now() - interval '7 days'
--   group by 1,2 order by 1,2;
-- Retention: delete from public.ai_timings where created_at < now() - interval '90 days';
