// supabase/functions/gemini-proxy/index.ts
//
// Deploy: supabase functions deploy gemini-proxy
// Set the key as a secret (never in this file, never in git):
//
//   supabase secrets set GEMINI_API_KEY=AIza...
//
// Get a free key (no card required) at https://aistudio.google.com/apikey
//
// Response is normalized to {content: [{type: "text", text}]} so the
// client-side callAI() in the app has one shape to parse regardless of
// which model is actually answering.
//
// Hardening (v7: retries Google 5xx "high demand" errors and falls back from the strong to the default model; v6 raised limits so multi-slide notes generation is never throttled):
//  - API key sent in the x-goog-api-key header, not in the URL (URLs end up in logs)
//  - model allowlist: callers can no longer request an arbitrary/expensive model
//  - input size cap, and type validation
//  - best-effort per-IP rate limiting. NOTE: counters live in this isolate's
//    memory, so the limit is per running instance, not global. It stops a casual
//    script from burning the free quota; it is not a substitute for a shared
//    store (e.g. a Postgres counter table) if the app ever faces determined abuse.
//  - upstream error bodies are logged server-side, not echoed to the browser

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

// Fast/cheap default for the frequent, real-time calls during a live lecture.
// The "strong" model is used for curriculum authoring and post-lecture notes.
// Both IDs must match GEMINI_MODEL_DEFAULT / GEMINI_MODEL_STRONG usage in the
// app. gemini-2.5-flash shuts down on October 16, 2026 — don't use it. Check
// https://ai.google.dev/gemini-api/docs/models for the current lineup.
const GEMINI_MODEL_DEFAULT = "gemini-3.5-flash-lite";
const GEMINI_MODEL_STRONG = "gemini-3.5-flash";
const ALLOWED_MODELS = new Set([GEMINI_MODEL_DEFAULT, GEMINI_MODEL_STRONG]);

const MAX_INPUT_CHARS = 400_000; // system + prompt combined
const WINDOW_MS = 60_000;
const LIMIT_ALL_PER_WINDOW = 120; // any model
const LIMIT_STRONG_PER_WINDOW = 40; // strong model: lecture notes make one call per slide in quick succession

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---- best-effort in-memory rate limiter --------------------------------------
const hits = new Map<string, number[]>();

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (
    req.headers.get("cf-connecting-ip") ||
    (fwd ? fwd.split(",")[0].trim() : "") ||
    "unknown"
  );
}

function overLimit(bucket: string, limit: number, now: number): boolean {
  const recent = (hits.get(bucket) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) {
    hits.set(bucket, recent);
    return true;
  }
  recent.push(now);
  hits.set(bucket, recent);
  return false;
}

function pruneOldBuckets(now: number) {
  if (hits.size < 500) return;
  for (const [k, v] of hits) {
    if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!GEMINI_API_KEY) {
    return jsonResponse({ error: "GEMINI_API_KEY secret is not set. Run: supabase secrets set GEMINI_API_KEY=AIza..." }, 500);
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }
    const { system, prompt, maxTokens, model } = body as {
      system?: unknown; prompt?: unknown; maxTokens?: unknown; model?: unknown;
    };

    if (typeof prompt !== "string" || !prompt.trim()) {
      return jsonResponse({ error: "prompt is required" }, 400);
    }
    if (system !== undefined && typeof system !== "string") {
      return jsonResponse({ error: "system must be a string" }, 400);
    }
    const systemText = typeof system === "string" ? system : "";
    if (systemText.length + prompt.length > MAX_INPUT_CHARS) {
      return jsonResponse({ error: "Input too large" }, 413);
    }

    const modelId = typeof model === "string" && model ? model : GEMINI_MODEL_DEFAULT;
    if (!ALLOWED_MODELS.has(modelId)) {
      return jsonResponse({ error: "Model not allowed" }, 400);
    }

    // Rate limit (per IP, per instance — see header note)
    const now = Date.now();
    pruneOldBuckets(now);
    const ip = clientIp(req);
    const tooMany =
      overLimit(`all:${ip}`, LIMIT_ALL_PER_WINDOW, now) ||
      (modelId === GEMINI_MODEL_STRONG && overLimit(`strong:${ip}`, LIMIT_STRONG_PER_WINDOW, now));
    if (tooMany) {
      // Same shape the client already handles for provider rate limits.
      return jsonResponse({ content: [], rateLimited: true }, 429);
    }

    // Both models support up to 65,536 output tokens; this ceiling is just
    // a sane upper bound for our use cases, not the model's real limit.
    const outputTokens = Math.max(200, Math.min(16000, Number(maxTokens) || 1000));

    const bodyJson = JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: systemText }] },
      generationConfig: { maxOutputTokens: outputTokens },
    });

    // Google answers 503 "high demand" in short spikes. Retry a couple of times
    // with a growing pause; if the strong model is still busy, fall back once to
    // the default model so the caller gets an answer instead of an error.
    const TRANSIENT = [500, 502, 503, 504];
    const callGemini = async (id: string): Promise<Response> => {
      let r: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt) await new Promise((resolve) => setTimeout(resolve, attempt * 2500));
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${id}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
          body: bodyJson,
        });
        if (!TRANSIENT.includes(r.status)) return r;
        console.error(`Gemini ${id} transient ${r.status} (attempt ${attempt + 1}/3)`);
      }
      return r as Response;
    };

    let res = await callGemini(modelId);
    if (TRANSIENT.includes(res.status) && modelId === GEMINI_MODEL_STRONG) {
      const fallback = await callGemini(GEMINI_MODEL_DEFAULT);
      if (fallback.ok) {
        console.error(`Fell back from ${GEMINI_MODEL_STRONG} to ${GEMINI_MODEL_DEFAULT}`);
        res = fallback;
      }
    }

    if (res.status === 429) {
      return jsonResponse({ content: [], rateLimited: true }, 429);
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`Gemini error ${res.status}: ${errText.slice(0, 500)}`);
      return jsonResponse({ content: [], error: `AI provider error (${res.status})` }, res.status);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
    return jsonResponse({ content: [{ type: "text", text }] }, 200);
  } catch (e) {
    console.error("gemini-proxy failure:", String(e));
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
