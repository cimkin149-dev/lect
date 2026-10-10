-- Applied to the live database as "learning_events" (analytics Phase A).
-- Append-only event log. De-identified by design: no names/emails, only session_id, a random browser
-- pseudonym (student_key) and, for signed-in students, student_id (cascade-deleted with the account).
create table if not exists public.learning_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_ts timestamptz,
  session_id text not null,
  course_id text not null references public.courses(id) on delete cascade,
  module_id text not null references public.modules(id) on delete cascade,
  student_id uuid references auth.users(id) on delete cascade,
  student_key text,
  research_consent boolean not null default false,
  slide_index integer,
  slide_key text,
  event_type text not null check (event_type in (
    'session_start','session_end','slide_view','slide_leave','slide_nav','autopilot_toggle','interrupt',
    'question','ai_answer','flag','signal','check_shown','check_answer','check_skip','notes_download','replay'
  )),
  payload jsonb
);
alter table public.learning_events enable row level security;
create policy "learners and anonymous students can log events" on public.learning_events
  for insert to anon, authenticated
  with check (
    (student_id is null or student_id = (select auth.uid()))
    and char_length(session_id) <= 80
    and (student_key is null or char_length(student_key) <= 80)
    and (slide_index is null or slide_index between 0 and 500)
    and (slide_key is null or char_length(slide_key) <= 60)
    and (payload is null or pg_column_size(payload) <= 2000)
    and exists (select 1 from public.modules m where m.id = module_id and m.course_id = learning_events.course_id)
  );
create policy "lecturers read events of their own courses; students read their own" on public.learning_events
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or course_id in (select c.id from public.courses c where c.owner_id = (select auth.uid()))
  );
create index if not exists learning_events_module_type_idx on public.learning_events (module_id, event_type);
create index if not exists learning_events_course_created_idx on public.learning_events (course_id, created_at desc);
create index if not exists learning_events_student_idx on public.learning_events (student_id, created_at desc);
create index if not exists learning_events_session_idx on public.learning_events (session_id);
revoke update, delete, truncate, trigger, references on public.learning_events from anon, authenticated;
revoke select on public.learning_events from anon;

alter table public.sessions add column if not exists research_consent boolean not null default false;

create or replace function public.module_slide_stats(p_module_id text)
returns table (
  slide_index integer, slide_key text, viewers bigint, avg_dwell_ms integer,
  checks bigint, checks_correct bigint, got_it bigint, unsure bigint, lost bigint, questions bigint, low_confidence bigint
)
language sql stable security invoker set search_path = public as $$
  select
    e.slide_index,
    max(e.slide_key) as slide_key,
    count(distinct e.session_id) filter (where e.event_type = 'slide_view') as viewers,
    round(avg((e.payload->>'dwell_ms')::numeric) filter (where e.event_type = 'slide_leave'))::integer as avg_dwell_ms,
    count(*) filter (where e.event_type = 'check_answer') as checks,
    count(*) filter (where e.event_type = 'check_answer' and (e.payload->>'correct') = 'true') as checks_correct,
    count(*) filter (where e.event_type = 'signal' and e.payload->>'value' = 'got_it') as got_it,
    count(*) filter (where e.event_type = 'signal' and e.payload->>'value' = 'unsure') as unsure,
    count(*) filter (where e.event_type = 'signal' and e.payload->>'value' = 'lost') as lost,
    count(*) filter (where e.event_type = 'question') as questions,
    count(*) filter (where e.event_type = 'ai_answer' and e.payload->>'confidence' = 'low') as low_confidence
  from public.learning_events e
  where e.module_id = p_module_id and e.slide_index is not null
  group by e.slide_index
  order by e.slide_index;
$$;
revoke all on function public.module_slide_stats(text) from public, anon;
grant execute on function public.module_slide_stats(text) to authenticated;
