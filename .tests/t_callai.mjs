// Extracts the real callAI from App.jsx and checks how each proxy response is surfaced.
import fs from "node:fs";
const src = fs.readFileSync("src/App.jsx", "utf8");
const a = src.indexOf("async function callAI(systemPrompt, userPrompt, maxTokens, model) {");
const b = src.indexOf("// ---------------------------------------------------------------------------\n// Post-lecture notes");
const make = new Function("fetch", "AI_PROXY_URL", "SUPABASE_ANON_KEY", src.slice(a, b) + "; return callAI;");
let fail = 0;
const t = (n, c, e) => { if (!c) { fail++; console.log("FAIL", n, e ?? ""); } else console.log("ok  ", n); };
const withResponse = (status, body) => make(async () => ({ status, json: async () => body }), "https://x", "k");
const err = async (f) => { try { await f(); return null; } catch (e) { return e; } };

let e = await err(() => withResponse(503, { error: "AI provider error (503)" })("s", "p"));
t("503 -> friendly, flagged busy, no raw status text", e && e.busy === true && /very busy/.test(e.message) && !/503/.test(e.message), e && e.message);
e = await err(() => withResponse(504, {})("s", "p"));
t("504 also busy", e && e.busy === true);
e = await err(() => withResponse(429, { rateLimited: true, content: [] })("s", "p"));
t("429 -> rateLimited flag + plain message", e && e.rateLimited === true && /too many requests/.test(e.message));
e = await err(() => withResponse(400, { error: "Model not allowed" })("s", "p"));
t("400 passes the real message through, not marked busy", e && e.message === "Model not allowed" && !e.busy);
const ok = await withResponse(200, { content: [{ type: "text", text: "hello" }] })("s", "p");
t("200 returns text", ok === "hello");
console.log(fail ? `\n${fail} FAILED` : "\nALL PASS"); process.exit(fail ? 1 : 0);
