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

// gemini-2.5-flash is scheduled to shut down October 16, 2026 — don't use
// it. 3.5 Flash-Lite is the current cost/latency-optimized model, a good
// fit for a free-tier app doing many small requests; swap in
// "gemini-3.6-flash" for noticeably better quality at higher cost and lower
// free-tier headroom. Check https://ai.google.dev/gemini-api/docs/models
// for the current lineup before relying on either long-term — Google ships
// new Flash versions every few months and deprecates old ones on a similar
// cadence.
const GEMINI_MODEL = "gemini-3.5-flash-lite";

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
    const { system, prompt } = await req.json();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: system }] },
        generationConfig: { maxOutputTokens: 1000 },
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
