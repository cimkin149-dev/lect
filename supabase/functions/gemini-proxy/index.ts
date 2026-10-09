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
// Multi-provider failover (v8): if Gemini is overloaded (5xx), rate limiting us (429)
// or unreachable, the SAME request is sent to Groq (OpenAI-compatible API, model
// openai/gpt-oss-120b by default) so a lecture never stops on one provider's bad
// minute. Needs a second secret, and is simply skipped if it isn't set:
//
//   supabase secrets set GROQ_API_KEY=gsk_...      (optional: GROQ_MODEL=openai/gpt-oss-120b)
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
// Backup provider. Groq retired llama-3.3-70b-versatile on 2026-08-16; openai/gpt-oss-120b
// is its recommended production replacement. Override with the GROQ_MODEL secret.
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_MODEL = Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-120b";

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

// ---- Groq (OpenAI-compatible chat completions) ----------------------------------
async function callGroq(systemText: string, prompt: string, outputTokens: number): Promise<{ ok: boolean; status: number; text?: string }> {
  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: systemText || "You are a helpful assistant." },
          { role: "user", content: prompt },
        ],
        // gpt-oss models "think" first and those tokens count toward the cap, so leave headroom.
        max_completion_tokens: Math.min(16000, outputTokens + 1500),
        reasoning_effort: "low",
        temperature: 0.7,
      }),
    });
    if (!r.ok) {
      console.error(`Groq error ${r.status}: ${(await r.text().catch(() => "")).slice(0, 300)}`);
      return { ok: false, status: r.status };
    }
    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content || "";
    if (!text.trim()) {
      console.error("Groq returned an empty answer");
      return { ok: false, status: 502 };
    }
    return { ok: true, status: 200, text };
  } catch (e) {
    console.error(`Groq unreachable: ${String(e).slice(0, 120)}`);
    return { ok: false, status: 0 };
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

    // Google answers 503 "high demand" in short spikes. Retry briefly; for the strong
    // model fall back once to the default model; if Gemini still can't answer
    // (5xx, 429 or unreachable) hand the request to Groq when a key is configured.
    const TRANSIENT = [500, 502, 503, 504];
    const callGemini = async (id: string, attempts: number, pauseMs: number): Promise<Response | null> => {
      let r: Response | null = null;
      for (let attempt = 0; attempt < attempts; attempt++) {
        if (attempt) await new Promise((resolve) => setTimeout(resolve, attempt * pauseMs));
        try {
          r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${id}:generateContent`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
            body: bodyJson,
          });
        } catch (e) {
          r = null; // network failure / timeout: treat like a transient error
          console.error(`Gemini ${id} unreachable (attempt ${attempt + 1}/${attempts}): ${String(e).slice(0, 120)}`);
          continue;
        }
        if (!TRANSIENT.includes(r.status)) return r;
        console.error(`Gemini ${id} transient ${r.status} (attempt ${attempt + 1}/${attempts})`);
      }
      return r;
    };
    const failed = (r: Response | null) => r === null || TRANSIENT.includes(r.status) || r.status === 429;

    // Live (default-model) calls must stay snappy, so they retry once quickly; authoring calls are patient.
    let res = modelId === GEMINI_MODEL_STRONG ? await callGemini(modelId, 3, 2500) : await callGemini(modelId, 2, 700);
    if (failed(res) && modelId === GEMINI_MODEL_STRONG) {
      const fallback = await callGemini(GEMINI_MODEL_DEFAULT, 2, 1200);
      if (fallback && fallback.ok) {
        console.error(`Fell back from ${GEMINI_MODEL_STRONG} to ${GEMINI_MODEL_DEFAULT}`);
        res = fallback;
      }
    }

    if (failed(res) && GROQ_API_KEY) {
      const g = await callGroq(systemText, prompt, outputTokens);
      if (g.ok) {
        console.error(`Fell back to Groq (${GROQ_MODEL}) after Gemini ${res ? res.status : "unreachable"}`);
        return jsonResponse({ content: [{ type: "text", text: g.text }], provider: "groq" }, 200);
      }
      if (g.status === 429 && (!res || res.status === 429)) return jsonResponse({ content: [], rateLimited: true }, 429);
    }

    if (!res) return jsonResponse({ content: [], error: "AI provider unreachable (503)" }, 503);
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
    return jsonResponse({ content: [{ type: "text", text }], provider: "gemini" }, 200);
  } catch (e) {
    console.error("gemini-proxy failure:", String(e));
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
