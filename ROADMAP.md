# SEMAI — Development Roadmap

**Purpose of this document:** an honest, ordered plan for taking SEMAI from
"working demo" to a system credible for (a) university adoption and (b) a
Y Combinator application. Phases are sequenced by what actually de-risks
each of those conversations fastest — not by novelty or difficulty.

A note on scope: this roadmap covers what's buildable in the codebase.
Things like running an actual pilot, legal review of policy documents, and
institutional sales conversations aren't engineering tasks — they're called
out explicitly below where they matter, but they're on the founder, not on
this list.

---

## Phase 0 — Harden what exists
**Size: small · Blocking: nothing, do this first**

Nothing here is a new feature — it's insurance against the product visibly
breaking in front of a dean or a YC partner.

- Client-side error logging (capture unhandled errors/rejections, persist
  enough context to debug after the fact instead of guessing)
- Final RLS/security review pass on the live database
- Cleanup of any remaining rough edges surfaced during real use

---

## Phase 1 — AI confidence & escalation
**Size: medium · Depends on: nothing**

Flagged as the trust-determining feature from the earliest planning of this
project and never actually built. Right now the AI answers every question
with identical, full confidence, with no mechanism to say "I'm not sure."
For an academic setting, this is the single biggest credibility gap — it's
also the first question a skeptical lecturer or department will ask.

- AI self-assesses confidence on generated answers (and pre-generated
  explanations, where relevant)
- Low-confidence answers are flagged honestly to the student rather than
  delivered as fact
- Flagged questions are recorded for the lecturer to review and correct
  later (feeds into Phase 2's session history)

---

## Phase 2 — Lecturer analytics & session history
**Size: medium-large · Depends on: nothing structurally, more useful after Phase 3**

A lecture currently happens and leaves no trace once the room closes. This
is what a lecturer or department will want to see in week one of any real
pilot, and it's also concrete evidence of usage/impact for a YC application.

- New database tables: persisted session records and transcripts
- AI-generated session summary (what was covered, common questions,
  rough engagement signal)
- Lecturer dashboard view: past sessions per module, transcripts, flagged
  questions from Phase 1, basic completion/engagement metrics

---

## Phase 3 — Student identity
**Size: small · Depends on: existing lecturer auth (already built)**

Students currently just type a name — no account, nothing persistent.
Analytics from Phase 2 are much weaker without real identity behind them.

- Extend the existing Supabase Auth setup to cover student accounts
- Keep quick anonymous name-entry as a fallback for casual/trial use

---

## Phase 4 — Accessibility pass
**Size: medium · Depends on: nothing**

Many public universities treat this as a hard procurement requirement
(WCAG/Section 508-style), not a preference.

- Keyboard navigation audit across every screen
- Screen-reader labels/landmarks
- Color contrast check against the current dark theme
- Visible running transcript during live lectures (the chat panel already
  covers most of this — needs auditing/finishing, not rebuilding)

---

## Phase 5 — Privacy policy, terms, and data controls
**Size: medium · Depends on: Phase 2 (need to know exactly what's stored first)**

- Draft privacy policy and terms of service reflecting exactly what data
  the system collects and stores (genuinely useful as a first draft for
  pilot conversations — **needs a lawyer's review before it's binding on
  anyone**, that part isn't something I can do)
- Real data export/delete functionality — a policy promising deletion
  needs an actual mechanism behind it, not just a paragraph

---

## Phase 6 — Multi-student real-time classrooms
**Size: large — the biggest single item on this roadmap · Depends on: nothing technically, but sequenced last on purpose**

Everything today is one student per session. A real classroom needs many
students in one room, sharing one lecture, one raised-hand queue, and one
lecturer able to moderate. This is a genuine rearchitecture — the AI's
state has to live in one shared place (server-synced) instead of running
independently inside each browser tab, the way it does now.

Deliberately sequenced after Phases 1-5: it's the most expensive thing on
this list to build, and a first pilot can reasonably start smaller than
this. Don't build it speculatively — build it once a real pilot says it's
the actual blocker.

---

## Phase 7 — LMS integration / SSO (Canvas, Moodle, etc.)
**Size: large · Depends on: having an actual institutional sandbox to test against**

The LTI/SSO handshake code itself is buildable in isolation, but it can't
be genuinely validated without a real institution's test environment. This
phase is realistically gated on having a pilot partner in hand — build it
with them, not blind ahead of them.

---

## What's explicitly NOT on this list (and why)

- **Running a pilot.** The single highest-leverage thing for a YC
  application is real usage evidence, not more features. That's a
  founder-led conversation, not an engineering task.
- **Legal review of any policy document.** I can draft; a lawyer needs to
  sign off before it's relied on.
- **Institutional sales / procurement conversations.** Same as above —
  this roadmap makes the product ready for those conversations, it doesn't
  replace having them.
