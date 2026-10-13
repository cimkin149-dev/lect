-- Applied to the live database as "pause_events_and_stats".
alter table public.learning_events drop constraint if exists learning_events_event_type_check;
alter table public.learning_events add constraint learning_events_event_type_check check (event_type in (
  'session_start','session_end','slide_view','slide_leave','slide_nav','autopilot_toggle','interrupt',
  'question','ai_answer','flag','signal','check_shown','check_answer','check_skip','notes_download','replay',
  'adapt_applied','adapt_request','practice_answer','pause','resume','break_nudge'
));

-- Manual pauses on a slide suggest "dense / needs more time"; "away" pauses (screen locked, tab left) say nothing about the slide.
drop function if exists public.module_slide_stats(text);
create or replace function public.module_slide_stats(p_module_id text)
returns table (
  slide_index integer, slide_key text, viewers bigint, avg_dwell_ms integer,
  checks bigint, checks_correct bigint, got_it bigint, unsure bigint, lost bigint, questions bigint, low_confidence bigint,
  manual_pauses bigint, manual_pausers bigint, avg_manual_pause_ms integer, away_pauses bigint
)
language sql stable security invoker set search_path = public as $$
  select
    e.slide_index, max(e.slide_key),
    count(distinct e.session_id) filter (where e.event_type = 'slide_view'),
    round(avg((e.payload->>'dwell_ms')::numeric) filter (where e.event_type = 'slide_leave'))::integer,
    count(*) filter (where e.event_type = 'check_answer'),
    count(*) filter (where e.event_type = 'check_answer' and (e.payload->>'correct') = 'true'),
    count(*) filter (where e.event_type = 'signal' and e.payload->>'value' = 'got_it'),
    count(*) filter (where e.event_type = 'signal' and e.payload->>'value' = 'unsure'),
    count(*) filter (where e.event_type = 'signal' and e.payload->>'value' = 'lost'),
    count(*) filter (where e.event_type = 'question'),
    count(*) filter (where e.event_type = 'ai_answer' and e.payload->>'confidence' = 'low'),
    count(*) filter (where e.event_type = 'pause' and coalesce(e.payload->>'reason','manual') = 'manual'),
    count(distinct e.session_id) filter (where e.event_type = 'pause' and coalesce(e.payload->>'reason','manual') = 'manual'),
    round(avg((e.payload->>'pause_ms')::numeric) filter (where e.event_type = 'resume' and coalesce(e.payload->>'reason','manual') = 'manual'))::integer,
    count(*) filter (where e.event_type = 'pause' and e.payload->>'reason' = 'away')
  from public.learning_events e
  where e.module_id = p_module_id and e.slide_index is not null
  group by e.slide_index
  order by e.slide_index;
$$;
revoke all on function public.module_slide_stats(text) from public, anon;
grant execute on function public.module_slide_stats(text) to authenticated;
