# SEMAI — Project Documentation

**An AI-led virtual lecture platform.** A lecturer uploads their own slides, notes,
or outline; SEMAI turns that into a structured curriculum and an AI delivers it
live — welcoming students by name, explaining slide by slide, switching to a
live code editor for practical content, checking understanding as it goes, and
pausing mid-sentence to answer questions whenever a student interrupts.

This document describes the system **as it currently exists and has been
verified working** (built, syntax-checked, and in most cases actually run/tested
during development). Where something was designed but not yet verified, or was
in progress and not yet finalized, that's called out explicitly rather than
implied as done — see **Status & Known Gaps** at the end.

---

## 1. Core concept

Two roles, one shared room:

- **Lecturer** — builds a *course* once (identity + voice/tone), then adds
  *modules* to it over time (one module = one session's worth of content,
  uploaded or pasted, AI-structured into slides). Saving a module publishes it;
  it does not start a live session.
- **Student** — picks a published course and module, gives a name, and joins.
  The AI lecturer takes it from there automatically: welcomes them, teaches
  through the slides, checks in periodically, and answers questions whenever
  raised — by voice or by typing.

## 2. Architecture

### Data model

```
Course
  ├─ code, title, institution           (identity)
  ├─ tone, voiceProvider, voice ID       (persona — shared across modules)
  └─ modules[]
       ├─ unit (topic), durationMinutes, pace, allowLiveCode
       └─ slides[] { title, bullets[], notes, hasCode, code }
```

Splitting course-level persona from module-level content was a deliberate
redesign partway through the build — it's what lets a lecturer come back
repeatedly and add module 2, module 3, etc. to the same course without
repeating setup, and it's what fixed an early bug where saving content would
accidentally drop the lecturer straight into a live session as if they were a
student.

### Screen flow

```
Role select ──┬── Lecturer → Dashboard ──┬── New course → Course details → Module setup → (back to Dashboard)
              │                          ├── Edit course
              │                          ├── Add module → Module setup
              │                          └── Preview module as student → Room
              │
              └── Student → Join (pick course → pick module → name) → Room
```

Every screen has a working way back — this was audited and fixed explicitly
after an early version left dead ends (e.g. creating a new course had no
cancel button at all).

### Tech stack

- **Frontend:** single-page React app (Vite), no router library — a simple
  `stage` state machine drives which screen renders.
- **AI:** Claude API (`claude-sonnet-4-6` for lecture content generation),
  called via `callClaude(system, prompt)`.
- **Voice:** browser `SpeechSynthesis` by default; optional ElevenLabs
  integration for natural-sounding speech (tuned voice settings: lower
  stability, added style, speaker boost — flat/robotic defaults were
  deliberately overridden).
- **Persistence:** Supabase Postgres via direct REST calls (PostgREST) — no
  `@supabase/supabase-js` SDK dependency, kept that way intentionally so the
  file has no required `npm install` for that piece.
- **File parsing:** PPTX and PDF ingestion are implemented with **zero external
  libraries** — a hand-rolled ZIP central-directory reader + the native
  `DecompressionStream` API for PPTX, and a byte-level PDF content-stream
  parser (including a `/ToUnicode` CMap decoder for font-subsetted PDFs) for
  PDF. This was a deliberate choice after discovering the intended libraries
  (`jszip`, `pdfjs-dist`) aren't in the sandboxed preview environment's
  allow-list — rather than degrade the feature, it was rebuilt dependency-free.

## 3. Feature breakdown

### Content ingestion (lecturer side)
- Upload `.pptx` (slide text **and** speaker notes — notes are the stronger
  signal, since they're closer to what a lecturer actually intends to say),
  `.pdf` (best-effort text extraction; scanned/image-only PDFs are honestly
  rejected with a clear message rather than silently producing garbage), or
  `.txt`/`.md`, or just paste raw text.
- AI structures the raw material into a slide deck: title, bullets, narration
  guidance ("notes" — instructions for the AI lecturer, not the narration
  itself), and optionally a live-code example per slide.
- Full editable preview before saving — every field (title, bullets, notes,
  code, even whether a slide has code at all) can be adjusted, or the slide
  deleted, before it's published.

### Pacing & tone control
- Duration (10–120 min), pacing (concise / standard / deep), and tone
  (conversational / formal / energetic) aren't cosmetic — they compute an
  actual word budget fed into every AI prompt at lecture time. The formula is
  anchored to a realistic *single spoken utterance* length (50–200 words),
  not a naive "total minutes ÷ slide count" division — that naive version was
  tried first, tested, and found to produce absurd per-slide lengths for
  normal slide counts, then redesigned.

### Autopilot delivery
- On joining, the AI generates and speaks a real welcome (by name, course
  overview), then proceeds through the deck unattended: explains a slide,
  types live code in sync with its own narration length, asks a short
  understanding check, briefly pauses, moves on — switching to the code-editor
  view automatically for practical slides.
- A student can interrupt at any point — raised hand (voice, via
  `SpeechRecognition`) or typed chat — which cancels the current speech
  mid-sentence, answers directly, then resumes teaching.
- Manual Prev/Next navigation is still available and explicitly pauses
  autopilot (rather than fighting it); a toggle resumes from the current
  slide, not from the start.

### Voice
- Default: free browser `speechSynthesis` (works everywhere, sounds robotic).
- Optional: ElevenLabs for natural speech, configured per-course (API key
  entered by the lecturer). **The key is deliberately never persisted to the
  database** — course rows are public-readable so students can browse them,
  and a secret key stored there would be exposed to every visitor. Voice
  provider and voice ID (not secrets) do persist.
- Browser autoplay policy handling: since autopilot speech starts from a
  `useEffect` rather than directly inside a click handler, most browsers
  silently block it by default. Mitigated with an audio-priming call inside
  the actual Join/Launch click, plus an always-visible manual "enable/replay
  voice" button as a guaranteed fallback.
- The spoken text itself is prompted toward sounding actually spoken —
  contractions, varied sentence rhythm, occasional natural filler — since a
  good voice reading stiff, uniform sentences still sounds robotic.

### Persistence (Supabase)
- `courses` and `modules` tables, Row Level Security enabled.
- App works with **zero configuration** if Supabase isn't set up — everything
  stays in-memory for that session, exactly as before this feature existed.
- Dashboard shows live connection status (connected / connecting / error /
  not configured).

## 4. Security posture (explicit, not assumed)

- **Supabase anon key**: safe for client-side code by design — protection
  comes from RLS policies, not secrecy of the key.
- **Supabase `service_role` key**: never used anywhere in this app — it
  bypasses RLS entirely and must never reach browser code.
- **Anthropic API key**: cannot safely live in deployed browser code at all
  (unlike the Supabase anon key, nothing protects it once exposed). Direct
  `api.anthropic.com` calls with no key attached work *only* inside the
  Claude.ai artifact preview, where Anthropic's own infrastructure
  authenticates the request invisibly — this does **not** work once deployed
  elsewhere. An `AI_PROXY_URL` config point exists for routing through a
  server-side proxy instead (a Supabase Edge Function was designed for this —
  see Status below for exactly what's finalized vs. in progress).
- **RLS policies as shipped are wide open** (any anon-key holder can read/write
  any course or module) — acceptable for solo/demo use, explicitly documented
  as *not* acceptable the moment more than one real lecturer uses the system.
  The schema file includes the exact `auth.uid()`-scoped policy pattern to
  replace them with once real lecturer accounts exist.

## 5. Setup & deployment

1. Run `supabase_schema.sql` in your Supabase project's SQL editor.
2. Fill in `SUPABASE_URL` and `SUPABASE_ANON_KEY` near the top of the app file.
3. Deploy the AI proxy (Supabase Edge Function) and point `AI_PROXY_URL` at it
   — required for the AI lecturer to function outside this chat's preview.
4. `npm install && npm run build`, deploy the `dist/` output (Vercel/Netlify).

Full step-by-step commands are in `README.md` in the project package.

## 6. Status & known gaps (honest accounting)

**Fully built, tested, and currently reflected in the downloadable project:**
course/module data model and dashboard, full ingestion pipeline (PPTX/PDF/text,
dependency-free), AI curriculum generation and editing, autopilot delivery with
interruption handling, ElevenLabs + browser voice with autoplay-policy
mitigation, complete screen navigation, Supabase persistence (Anthropic-only
proxy path).

**Designed and discussed, but not yet finalized/re-saved after an interrupted
work session (in progress, not yet in the downloadable files as of this
document):**
- Swapping the AI proxy to support Google Gemini's free tier (as a cost-free
  alternative to a paid Anthropic key), with Anthropic kept as a fallback
  option rather than removed.
- Graceful in-app handling for AI rate-limit errors (a visible "the AI is
  busy, one moment" notice instead of the lecturer just going quiet).
- Full PWA conversion (installable manifest, icons, service worker) for
  GitHub + Netlify deployment.

These will be completed and re-delivered as updated files next.

**Deliberately not built yet (scoped out, not forgotten):**
- Lecturer authentication and per-owner RLS scoping (see Security Posture).
- Multi-student real-time synchronized classrooms — the current architecture
  is single-student-per-session; true shared classrooms need a different,
  server-synced state model, not an incremental add-on.
- Real code execution/debugging during live-code slides (code is narrated and
  typed, not actually run).
- Lecturer-facing session analytics/summaries after a lecture ends.
- Confidence scoring / escalation to a human lecturer when the AI is unsure.
