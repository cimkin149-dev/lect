-- Applied to the live database (project rodwpttdegrfwqioyoci) as "rls_hardening_pass".
-- Kept here so the repo matches what is actually deployed.
-- Changes: owner policies -> authenticated + cached auth.uid(); anonymous flags
-- must be unresolved; anonymous sessions must reference a real module/course pair;
-- owners can delete flags; unneeded table privileges revoked from anon/authenticated.

-- courses
drop policy if exists "owners can insert their own courses" on public.courses;
drop policy if exists "owners can update their own courses" on public.courses;
drop policy if exists "owners can delete their own courses" on public.courses;
create policy "owners can insert their own courses" on public.courses for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "owners can update their own courses" on public.courses for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owners can delete their own courses" on public.courses for delete to authenticated using (owner_id = (select auth.uid()));

-- modules
drop policy if exists "owners can insert modules for their own courses" on public.modules;
drop policy if exists "owners can update modules for their own courses" on public.modules;
drop policy if exists "owners can delete modules for their own courses" on public.modules;
create policy "owners can insert modules for their own courses" on public.modules for insert to authenticated with check (course_id in (select c.id from public.courses c where c.owner_id = (select auth.uid())));
create policy "owners can update modules for their own courses" on public.modules for update to authenticated using (course_id in (select c.id from public.courses c where c.owner_id = (select auth.uid()))) with check (course_id in (select c.id from public.courses c where c.owner_id = (select auth.uid())));
create policy "owners can delete modules for their own courses" on public.modules for delete to authenticated using (course_id in (select c.id from public.courses c where c.owner_id = (select auth.uid())));

-- flagged_questions
drop policy if exists "anyone can flag a question" on public.flagged_questions;
drop policy if exists "owners can read flags for their own courses" on public.flagged_questions;
drop policy if exists "owners can resolve flags for their own courses" on public.flagged_questions;
create policy "anyone can flag a question" on public.flagged_questions for insert to anon, authenticated with check (resolved = false);
create policy "owners can read flags for their own courses" on public.flagged_questions for select to authenticated using (course_id in (select c.id from public.courses c where c.owner_id = (select auth.uid())));
create policy "owners can resolve flags for their own courses" on public.flagged_questions for update to authenticated using (course_id in (select c.id from public.courses c where c.owner_id = (select auth.uid()))) with check (course_id in (select c.id from public.courses c where c.owner_id = (select auth.uid())));
create policy "owners can delete flags for their own courses" on public.flagged_questions for delete to authenticated using (course_id in (select c.id from public.courses c where c.owner_id = (select auth.uid())));

-- sessions
drop policy if exists "record own session or anonymous session" on public.sessions;
drop policy if exists "read own sessions or sessions for owned courses" on public.sessions;
drop policy if exists "students can delete their own sessions" on public.sessions;
create policy "record own session or anonymous session" on public.sessions for insert to anon, authenticated with check ((student_id is null or student_id = (select auth.uid())) and exists (select 1 from public.modules m where m.id = sessions.module_id and m.course_id = sessions.course_id));
create policy "read own sessions or sessions for owned courses" on public.sessions for select to authenticated using (student_id = (select auth.uid()) or course_id in (select c.id from public.courses c where c.owner_id = (select auth.uid())));
create policy "students can delete their own sessions" on public.sessions for delete to authenticated using (student_id = (select auth.uid()));

revoke truncate, trigger, references on public.courses, public.modules, public.flagged_questions, public.sessions from anon, authenticated;
