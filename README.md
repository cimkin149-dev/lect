# SEMAI — deployment guide

A real, buildable, installable (PWA) React project (Vite).

## What you need before deploying

1. A Supabase project with `supabase/schema.sql` run (already done for the
   project's live database, if you're using the one already connected).
2. A free Gemini API key — [aistudio.google.com/apikey](https://aistudio.google.com/apikey),
   no card required. (Anthropic works too if you have credit — see below.)
3. A [Netlify](https://netlify.com) account, connected to this GitHub repo.
4. The [Supabase CLI](https://supabase.com/docs/guides/cli) to deploy the AI proxy.

## Step 1 — Deploy the AI proxy

A raw AI API key can never safely live in browser code — unlike the Supabase
anon key, nothing protects it once exposed, and anyone reading it out of your
deployed site's network requests could run up charges on your account. This
Edge Function keeps it server-side.

```bash
npx supabase login
npx supabase link --project-ref rodwpttdegrfwqioyoci
npx supabase functions deploy claude-proxy

# Gemini (free tier) — this is what the function uses by default if set:
npx supabase secrets set GEMINI_API_KEY=AIza-your-real-key-here

# or, if you'd rather use Anthropic instead:
# npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-real-key-here
```

If both secrets are set, Gemini wins. Switching providers later is just
changing which secret is set — no code change or redeploy needed.

Function URL will be:
```
https://rodwpttdegrfwqioyoci.supabase.co/functions/v1/claude-proxy
```

## Step 2 — Point the app at the proxy

In `src/App.jsx`, near the top:

```js
const AI_PROXY_URL = "https://rodwpttdegrfwqioyoci.supabase.co/functions/v1/claude-proxy";
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` just below it should already be filled in.

## Step 3 — Deploy via GitHub + Netlify

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. In Netlify: **Add new site → Import an existing project → GitHub** → pick this repo.
3. Build settings (Netlify usually auto-detects these from Vite):
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Deploy. Every push to `main` auto-redeploys from then on.

## Local testing

```bash
npm install
npm run dev
```

`AI_PROXY_URL` must be set (Steps 1–2) for the AI lecturer to work in a real
browser tab — the direct `api.anthropic.com` fallback in the code only works
inside the Claude.ai chat's own artifact preview.

## About Gemini's free tier — know before you rely on it

- Free-tier prompts/responses **are used by Google to improve their
  products** — different from the paid tier. Worth knowing if any lecture
  content or student questions should stay private.
- Rate limits are real (roughly single-to-low-double-digit requests/minute,
  a few hundred/day depending on model) — fine for solo testing or a small
  pilot, not for many simultaneous sessions. The app now shows a visible
  "AI lecturer is getting a lot of requests" notice instead of silently going
  quiet when this happens.
- Terms have shifted a few times through 2026 (quota changes, a paywalled
  model tier) — don't assume today's exact limits are permanent.

## PWA

The app is installable — desktop and mobile browsers will offer an "Install"
prompt. `npm run build` generates a service worker and manifest
automatically (`vite-plugin-pwa`). App-shell assets are cached for fast
reloads; AI/voice/database calls always need a live connection regardless, so
there's no meaningful "offline lecture" mode — this is about install +
fast load, not offline use.

## Known limitations, unchanged from before

- No lecturer authentication yet — Supabase RLS policies are wide open (see
  comments in `supabase/schema.sql`). Fine solo/demo, not fine the moment
  more than one real lecturer uses it.
- ElevenLabs API key (if used) stays in the browser tab only, by design —
  never sent to Supabase, never proxied. Re-enter it each session.
- Free-tier Supabase projects pause after about a week of inactivity — if the
  dashboard shows "Couldn't reach Supabase," that's almost always why. Restore
  it from the Supabase dashboard (or ask me to).
