-- LectureI persistence schema
-- Run this once in your Supabase project's SQL editor (Dashboard > SQL Editor > New query).

create table if not exists courses (
  id text primary key,                          -- generated client-side, e.g. "course-1721..."
  code text not null,
  title text not null,
  institution text,
  tone text not null default 'conversational',
  voice_provider text not null default 'browser',
  elevenlabs_voice_id text,                      -- ok to store: not a secret
  created_at timestamptz not null default now()
  -- NOTE: no elevenlabs_api_key column on purpose. Course rows are public
  -- read (students need them to browse for a session to join), so a secret
  -- key stored here would be exposed to every visitor. The app keeps that
  -- key local to the lecturer's browser tab instead.
);

create table if not exists modules (
  id text primary key,                           -- generated client-side, e.g. "module-1721..."
  course_id text not null references courses(id) on delete cascade,
  unit text not null,
  duration_minutes int not null default 45,
  pace text not null default 'standard',
  allow_live_code boolean not null default true,
  slides jsonb not null,                          -- the full slide array (title/bullets/notes/code per slide)
  created_at timestamptz not null default now()
);

alter table courses enable row level security;
alter table modules enable row level security;

-- ---------------------------------------------------------------------
-- PROTOTYPE-ONLY POLICIES. These allow anyone holding the public anon key
-- (i.e. anyone who's loaded the app) to read AND write every course and
-- module. That's fine for a personal build or a demo, but it means any
-- visitor could edit or delete another lecturer's content. Before this is
-- used with real, separate lecturer accounts, add Supabase Auth and
-- replace the write policies below with ones scoped to auth.uid(), e.g.:
--
--   create table courses (... , owner_id uuid references auth.users default auth.uid());
--   create policy "owners can write their own courses" on courses
--     for insert with check (owner_id = auth.uid());
--   create policy "owners can update their own courses" on courses
--     for update using (owner_id = auth.uid());
--
-- and similarly scope `modules` writes through their parent course's
-- owner_id. Reads can stay public so students can still browse and join.
-- ---------------------------------------------------------------------

create policy "public read courses" on courses for select using (true);
create policy "public write courses" on courses for insert with check (true);
create policy "public update courses" on courses for update using (true);

create policy "public read modules" on modules for select using (true);
create policy "public write modules" on modules for insert with check (true);

-- Added for the AI confidence/escalation feature: when the AI isn't
-- confident in an answer, the question gets flagged here for the owning
-- lecturer to review and follow up on directly.
create table if not exists flagged_questions (
  id text primary key,
  course_id text not null references courses(id) on delete cascade,
  module_id text not null references modules(id) on delete cascade,
  student_name text,
  slide_title text,
  question text not null,
  ai_answer text,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table flagged_questions enable row level security;

create policy "anyone can flag a question" on flagged_questions
  for insert with check (true);

create policy "owners can read flags for their own courses" on flagged_questions
  for select using (course_id in (select id from courses where owner_id = auth.uid()));

create policy "owners can resolve flags for their own courses" on flagged_questions
  for update using (course_id in (select id from courses where owner_id = auth.uid()));

-- Added for Phase 2 (lecturer analytics/session history): one row per
-- completed or abandoned lecture session, written once at the end by the
-- (possibly anonymous) student's browser.
create table if not exists sessions (
  id text primary key,
  course_id text not null references courses(id) on delete cascade,
  module_id text not null references modules(id) on delete cascade,
  student_name text,
  completed boolean not null default false,
  slides_reached int not null default 0,
  total_slides int not null default 0,
  question_count int not null default 0,
  transcript jsonb,
  summary text,
  started_at timestamptz,
  ended_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table sessions enable row level security;

create policy "anyone can record a session" on sessions
  for insert with check (true);

create policy "owners can read sessions for their own courses" on sessions
  for select using (course_id in (select id from courses where owner_id = auth.uid()));
