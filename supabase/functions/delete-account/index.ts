// supabase/functions/delete-account/index.ts
//
// Deploy: supabase functions deploy delete-account
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected into every
// Edge Function by Supabase — no manual secret-setting needed in the
// common case. If this errors with "not configured," run:
//
//   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ...
//
// (Project Settings > API > service_role key). That key bypasses every RLS
// policy in the database — it must NEVER be sent to a browser, only used
// here, server-side, where the client can't read it. This is the whole
// reason account deletion needs an Edge Function at all: a regular
// authenticated client can delete their own DATA (courses, sessions) under
// RLS, but deleting the actual auth.users row requires admin privileges no
// client-side key can safely hold.
//
// Security model: the caller proves who they are with their OWN access
// token. This function resolves that token to a user id via Supabase's own
// /auth/v1/user endpoint, then deletes ONLY that id — never an id the
// client could pass in directly, which would let anyone delete anyone.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse(
      { error: "Not configured — SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. Run: supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ..." },
      500
    );
  }

  const authHeader = req.headers.get("Authorization") || "";
  const userAccessToken = authHeader.replace(/^Bearer\s+/i, "");
  if (!userAccessToken) {
    return jsonResponse({ error: "Missing Authorization header — must be the caller's own access token." }, 401);
  }

  try {
    const whoRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${userAccessToken}` },
    });
    if (!whoRes.ok) {
      return jsonResponse({ error: "Invalid or expired session — sign in again and retry." }, 401);
    }
    const who = await whoRes.json();
    const userId = who.id;
    if (!userId) {
      return jsonResponse({ error: "Couldn't resolve a user id from that session." }, 401);
    }

    const deleteRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    });
    if (!deleteRes.ok) {
      const text = await deleteRes.text().catch(() => "");
      return jsonResponse({ error: `Account deletion failed (${deleteRes.status}): ${text.slice(0, 200)}` }, deleteRes.status);
    }

    return jsonResponse({ success: true }, 200);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
