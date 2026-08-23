// supabase/functions/claude-proxy/index.ts
//
// Deploy: supabase functions deploy claude-proxy
// Then set ONE of these as a secret (never in this file, never in git):
//
//   supabase secrets set GEMINI_API_KEY=AIza...
//   -- or --
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// If both are set, GEMINI_API_KEY wins (that's the free-tier path). This
// lets you switch providers later just by changing which secret is set —
// no redeploy of the frontend needed.
//
// Both providers' responses are normalized to Anthropic's {content: [{type,
// text}]} shape before returning, so the client-side callClaude() in the
// app doesn't need to know or care which provider is actually answering.

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

// gemini-2.5-flash-lite has the highest free-tier request limits of the
// current models if you're hitting quota often; swap in "gemini-2.5-flash"
// for noticeably better quality at a lower daily/per-minute allowance.
// gemini-2.5-flash (the original default here) is scheduled to shut down
// October 16, 2026 — moved to the current 3.5 line instead. Flash-Lite is
// the cost/latency-optimized variant, a good fit for a free-tier app doing
// many small requests; swap in "gemini-3.6-flash" for noticeably better
// quality at higher cost and lower free-tier headroom. Check
// https://ai.google.dev/gemini-api/docs/models for the current lineup
// before you rely on either long-term — Google ships new Flash versions
// every few months and deprecates old ones on a similar cadence.
const GEMINI_MODEL = "gemini-3.5-flash-lite";
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

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

async function callGemini(system: string, prompt: string) {
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
    return { normalized: { content: [], rateLimited: true }, status: 429 };
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return { normalized: { content: [], error: `Gemini error ${res.status}: ${errText.slice(0, 200)}` }, status: res.status };
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
  return { normalized: { content: [{ type: "text", text }] }, status: 200 };
}

async function callAnthropic(system: string, prompt: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1000,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (res.status === 429) {
    return { normalized: { content: [], rateLimited: true }, status: 429 };
  }
  const data = await res.json();
  if (!res.ok) {
    return { normalized: { content: [], error: `Anthropic error ${res.status}` }, status: res.status };
  }
  return { normalized: data, status: 200 }; // already in the target shape
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!GEMINI_API_KEY && !ANTHROPIC_API_KEY) {
    return jsonResponse(
      { error: "No AI provider configured. Run: supabase secrets set GEMINI_API_KEY=AIza... (or ANTHROPIC_API_KEY=sk-ant-...)" },
      500
    );
  }

  try {
    const { system, prompt } = await req.json();
    const { normalized, status } = GEMINI_API_KEY ? await callGemini(system, prompt) : await callAnthropic(system, prompt);
    return jsonResponse(normalized, status);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
