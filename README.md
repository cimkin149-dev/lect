# SEMAI — deployment guide

This is a real, buildable React project (Vite). It builds on the same code
you've been testing in chat, restructured into a proper project so it can
be hosted for real.

## What you need before deploying

1. A Supabase project (you already have one) with `supabase_schema.sql` run.
2. An Anthropic API account with some credit — see the cost note at the
   bottom before you assume you need to pay anything up front.
3. Free accounts on:
   - [Vercel](https://vercel.com) (hosts the frontend) — or Netlify, same idea.
   - The [Supabase CLI](https://supabase.com/docs/guides/cli) (deploys the AI proxy).

## Step 1 — Deploy the AI proxy (keeps your Anthropic key off the browser)

This is the one part that *must* run somewhere other than the browser — a
raw Anthropic API key can't safely live in client-side code (unlike the
Supabase anon key, it isn't protected by Row Level Security; anyone who
found it in your site's network requests could spend your money). We're
using a Supabase Edge Function for this since you already have the project.

```bash
# from this folder
npx supabase login
npx supabase link --project-ref rodwpttdegrfwqioyoci
npx supabase functions deploy claude-proxy

# set your real key as a server-side secret — never commit this anywhere
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-real-key-here
```

After this, note the function's URL — it'll be:
```
https://rodwpttdegrfwqioyoci.supabase.co/functions/v1/claude-proxy
```

## Step 2 — Point the app at the proxy

Open `src/App.jsx`, find this near the top:

```js
const AI_PROXY_URL = "";
```

and set it to the URL from Step 1:

```js
const AI_PROXY_URL = "https://rodwpttdegrfwqioyoci.supabase.co/functions/v1/claude-proxy";
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` just above it should already be
filled in with your project's values.

## Step 3 — Deploy the frontend

Easiest path with Vercel:

```bash
npm install -g vercel
vercel
```

Follow the prompts (accept the defaults — Vercel auto-detects Vite). That's
it; you'll get a live URL. Every subsequent `vercel --prod` redeploys.

Netlify works the same way if you'd rather use that — `netlify deploy`,
build command `npm run build`, publish directory `dist`.

## Local testing before you deploy

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. Note: `AI_PROXY_URL` must already be set
(Steps 1–2) for the AI lecturer to work locally too — the direct
`api.anthropic.com` fallback in the code only works inside the Claude.ai
chat's own artifact preview, not in a real browser tab.

## About the Anthropic API cost

New Anthropic API accounts (console.anthropic.com — separate from a Claude
Pro/Max subscription) get a one-time free credit on signup, no purchase
required. Availability varies by region and this can change, so check the
Console yourself rather than assume — but if it's available to you, that
covers a real amount of usage for a small app like this, especially since
the proxy defaults to Haiku (the cheapest current Claude model), not
Sonnet. If you want higher-quality explanations later and are willing to
pay more per call, change `MODEL` in
`supabase/functions/claude-proxy/index.ts` to `"claude-sonnet-4-6"` and
redeploy the function.

## Known limitations, unchanged from before

- No lecturer authentication yet — the Supabase RLS policies are wide open
  (see the comments in `supabase_schema.sql`). Fine solo/demo, not fine the
  moment more than one real lecturer uses it.
- ElevenLabs API key (if you use it) stays in the browser tab only, by
  design — never sent to Supabase, never proxied. Re-enter it each time you
  configure a course's voice.
