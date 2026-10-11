-- Applied to the live database as "analytics_phase_b".

-- B1: which wrong answers do students choose? SECURITY INVOKER: a lecturer only aggregates their own courses' events.
create or replace function public.module_check_breakdown(p_module_id text)
returns table (slide_index integer, concept text, option_text text, correct boolean, answers bigint, confident_answers bigint, students bigint)
language sql stable security invoker set search_path = public as $$
  select e.slide_index, e.payload->>'concept', e.payload->>'option_text',
         coalesce((e.payload->>'correct') = 'true', false), count(*),
         count(*) filter (where e.payload->>'confidence' = 'sure'),
         count(distinct coalesce(e.student_id::text, e.student_key, e.session_id))
  from public.learning_events e
  where e.module_id = p_module_id and e.event_type = 'check_answer' and e.slide_index is not null
  group by 1, 2, 3, 4 order by 1, 5 desc;
$$;
revoke all on function public.module_check_breakdown(text) from public, anon;
grant execute on function public.module_check_breakdown(text) to authenticated;

-- B3: the lecturer teaches the AI. Only lecturer-written, lecturer-approved text is shared with other students' lectures.
alter table public.flagged_questions
  add column if not exists approved_question text,
  add column if not exists lecturer_answer text,
  add column if not exists approved_at timestamptz;
alter table public.flagged_questions
  add constraint flagged_approved_question_len check (approved_question is null or char_length(approved_question) <= 300),
  add constraint flagged_lecturer_answer_len check (lecturer_answer is null or char_length(lecturer_answer) <= 1500);

-- SECURITY DEFINER on purpose (students cannot read flagged_questions): returns ONLY approved pairs.
create or replace function public.module_corrections(p_module_id text)
returns table (approved_question text, lecturer_answer text)
language sql stable security definer set search_path = public as $$
  select f.approved_question, f.lecturer_answer
  from public.flagged_questions f
  where f.module_id = p_module_id
    and f.approved_question is not null and f.lecturer_answer is not null
    and char_length(trim(f.approved_question)) > 0 and char_length(trim(f.lecturer_answer)) > 0
  order by f.approved_at desc nulls last
  limit 40;
$$;
revoke all on function public.module_corrections(text) from public;
grant execute on function public.module_corrections(text) to anon, authenticated;
