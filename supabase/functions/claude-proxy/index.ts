// supabase/functions/claude-proxy/index.ts

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const GEMINI_MODEL = "gemini-2.5-flash-lite";
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function callGemini(system: string, prompt: string) {
  if (!GEMINI_API_KEY) {
    return {
      normalized: {
        content: [],
        error: "GEMINI_API_KEY is not configured.",
      },
      status: 500,
    };
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent` +
    `?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: system || "",
          },
        ],
      },

      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt || "",
            },
          ],
        },
      ],

      generationConfig: {
        maxOutputTokens: 4000,
      },
    }),
  });

  const data = await res.json();

  if (res.status === 429) {
    return {
      normalized: {
        content: [],
        rateLimited: true,
      },
      status: 429,
    };
  }

  if (!res.ok) {
    console.error("Gemini API error:", data);

    return {
      normalized: {
        content: [],
        error:
          data?.error?.message ||
          `Gemini error ${res.status}`,
      },
      status: res.status,
    };
  }

  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text || "")
      .join("")
      .trim() || "";

  if (!text) {
    console.error("Gemini returned no text:", data);

    return {
      normalized: {
        content: [],
        error: "Gemini returned an empty response.",
      },
      status: 500,
    };
  }

  return {
    normalized: {
      content: [
        {
          type: "text",
          text,
        },
      ],
    },
    status: 200,
  };
}

async function callAnthropic(system: string, prompt: string) {
  if (!ANTHROPIC_API_KEY) {
    return {
      normalized: {
        content: [],
        error: "ANTHROPIC_API_KEY is not configured.",
      },
      status: 500,
    };
  }

  const res = await fetch(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },

      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 4000,
        system,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    }
  );

  const data = await res.json();

  if (res.status === 429) {
    return {
      normalized: {
        content: [],
        rateLimited: true,
      },
      status: 429,
    };
  }

  if (!res.ok) {
    return {
      normalized: {
        content: [],
        error:
          data?.error?.message ||
          `Anthropic error ${res.status}`,
      },
      status: res.status,
    };
  }

  return {
    normalized: data,
    status: 200,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (!GEMINI_API_KEY && !ANTHROPIC_API_KEY) {
    return jsonResponse(
      {
        error:
          "No AI provider configured. Set GEMINI_API_KEY or ANTHROPIC_API_KEY in Supabase secrets.",
      },
      500
    );
  }

  try {
    const body = await req.json();

    // Accept the request format already used by the frontend.
    const system = body.system || "";

    const prompt =
      body.prompt ||
      body.messages
        ?.find((message: any) => message.role === "user")
        ?.content ||
      "";

    if (!prompt) {
      return jsonResponse(
        {
          error: "No user prompt was provided.",
        },
        400
      );
    }

    console.log(
      `AI request: provider=${GEMINI_API_KEY ? "Gemini" : "Anthropic"}`
    );

    const result = GEMINI_API_KEY
      ? await callGemini(system, prompt)
      : await callAnthropic(system, prompt);

    return jsonResponse(
      result.normalized,
      result.status
    );
  } catch (e) {
    console.error("Edge Function error:", e);

    return jsonResponse(
      {
        error:
          e instanceof Error
            ? e.message
            : String(e),
      },
      500
    );
  }
});
