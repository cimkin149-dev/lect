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

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

// Fast/cheap default for the frequent, real-time calls during a live
// lecture (one per slide, one per question). "Lite" tier models are tuned
// for speed/cost and — this turned out to matter — tend to under-shoot
// requests for longer, richer content even when explicitly instructed
// otherwise, which is why curriculum generation below overrides to the
// full (non-lite) model instead. gemini-2.5-flash is scheduled to shut
// down October 16, 2026 — don't use it. Check
// https://ai.google.dev/gemini-api/docs/models for the current lineup
// before relying on either long-term.
const GEMINI_MODEL_DEFAULT = "gemini-3.5-flash-lite";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!GEMINI_API_KEY) {
    return jsonResponse({ error: "GEMINI_API_KEY secret is not set. Run: supabase secrets set GEMINI_API_KEY=AIza..." }, 500);
  }

  try {
    const { system, prompt, maxTokens, model } = await req.json();
    // Both models support up to 65,536 output tokens; this ceiling is just
    // a sane upper bound for our use cases, not the model's real limit.
    const outputTokens = Math.max(200, Math.min(16000, Number(maxTokens) || 1000));
    const modelId = model || GEMINI_MODEL_DEFAULT;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: system }] },
        generationConfig: { maxOutputTokens: outputTokens },
      }),
    });

    if (res.status === 429) {
      return jsonResponse({ content: [], rateLimited: true }, 429);
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return jsonResponse({ content: [], error: `Gemini error ${res.status}: ${errText.slice(0, 200)}` }, res.status);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
    return jsonResponse({ content: [{ type: "text", text }] }, 200);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
