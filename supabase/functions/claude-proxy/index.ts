// supabase/functions/claude-proxy/index.ts
//
// Deploy: supabase functions deploy claude-proxy
// Then set the real key as a secret (never in this file, never in git):
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// This function receives {system, prompt} from the browser, attaches the
// real Anthropic API key server-side, calls the actual Claude API, and
// returns the response unmodified — so the client-side callClaude() in the
// app doesn't need to know or care whether it's talking to this proxy or
// (inside the Claude.ai artifact preview) directly to Anthropic.

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

// Cheap + fast model by default — a good fit for short spoken lecture
// snippets and a $5 trial-credit budget. Swap for "claude-sonnet-4-6" if
// you want higher-quality explanations and don't mind the higher cost.
const MODEL = "claude-haiku-4-5-20251001";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY secret is not set on this function. Run: supabase secrets set ANTHROPIC_API_KEY=sk-ant-..." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { system, prompt } = await req.json();

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
