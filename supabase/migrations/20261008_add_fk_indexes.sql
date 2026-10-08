-- Applied to the live database as "add_fk_indexes".
create index if not exists courses_owner_id_idx on public.courses (owner_id);
create index if not exists modules_course_id_idx on public.modules (course_id);
create index if not exists flagged_questions_course_id_idx on public.flagged_questions (course_id);
create index if not exists flagged_questions_module_id_idx on public.flagged_questions (module_id);
create index if not exists sessions_course_id_idx on public.sessions (course_id);
create index if not exists sessions_module_id_idx on public.sessions (module_id);
create index if not exists sessions_student_id_idx on public.sessions (student_id);
