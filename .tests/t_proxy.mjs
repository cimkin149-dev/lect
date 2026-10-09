import { execSync } from "node:child_process";
import fs from "node:fs";
execSync("npx esbuild supabase/functions/gemini-proxy/index.ts --log-level=error --outfile=.tests/proxy.bundle.mjs --format=esm");
let fail = 0;
const t = (n, c, e) => { if (!c) { fail++; console.log("FAIL", n, e ?? ""); } else console.log("ok  ", n); };
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn) => realSetTimeout(fn, 0); // make backoff instant in tests
let ENV = { GEMINI_API_KEY: "gem-key", GROQ_API_KEY: "groq-key" };
globalThis.Deno = { env: { get: (k) => ENV[k] }, serve: (h) => { globalThis.handler = h; } };
let script = []; const seen = [];
const groqCalls = []; let groqScript = [];
globalThis.fetch = async (url, o) => {
  if (String(url).includes("api.groq.com")) {
    const body = JSON.parse(o.body);
    const step = groqScript.length ? groqScript.shift() : { status: 200, text: "answer from groq" };
    groqCalls.push({ auth: o.headers.Authorization, body });
    if (step.throw) throw new Error("network down");
    return step.status === 200
      ? new Response(JSON.stringify({ choices: [{ message: { content: step.text } }] }), { status: 200 })
      : new Response(JSON.stringify({ error: "x" }), { status: step.status });
  }
  const model = /models\/([^:]+):/.exec(url)[1];
  if (script.length && script[0] === "THROW") { script.shift(); seen.push({ model, status: "throw", header: o.headers["x-goog-api-key"], urlHasKey: false }); throw new Error("network down"); }
  const status = script.length ? script.shift()(model) : 200;
  seen.push({ model, status, header: o.headers["x-goog-api-key"], urlHasKey: url.includes("key=") });
  return status === 200
    ? new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: `ok from ${model}` }] } }] }), { status: 200 })
    : new Response(JSON.stringify({ error: { code: status } }), { status });
};
await import("../.tests/proxy.bundle.mjs");
let ip = 0;
const call = async (b) => handler(new Request("http://x", { method: "POST", headers: { "x-forwarded-for": `9.9.9.${++ip}` }, body: JSON.stringify(b) }));

let r = await call({ prompt: "p", model: "gemini-3.5-flash" }); let j = await r.json();
t("healthy call unchanged", r.status === 200 && j.content[0].text === "ok from gemini-3.5-flash" && seen.length === 1);

seen.length = 0; script = [() => 503, () => 200];
r = await call({ prompt: "p", model: "gemini-3.5-flash" }); j = await r.json();
t("one 503 then success -> retried transparently on the same model", r.status === 200 && seen.length === 2 && seen.every((s) => s.model === "gemini-3.5-flash"), JSON.stringify(seen));

seen.length = 0; script = [() => 503, () => 503, () => 503, () => 200];
r = await call({ prompt: "p", model: "gemini-3.5-flash" }); j = await r.json();
t("strong stays 503 x3 -> falls back to the default model", r.status === 200 && j.content[0].text === "ok from gemini-3.5-flash-lite" && seen[3].model === "gemini-3.5-flash-lite", JSON.stringify(seen));

seen.length = 0; script = [() => 503, () => 503, () => 503, () => 503, () => 503, () => 503];
r = await call({ prompt: "p", model: "gemini-3.5-flash" }); j = await r.json();
t("both Gemini models down + Groq configured -> answered by Groq", r.status === 200 && j.provider === "groq" && j.content[0].text === "answer from groq", JSON.stringify({ s: r.status, j }));

seen.length = 0; script = [() => 503, () => 503, () => 503];
r = await call({ prompt: "p" }); j = await r.json();
t("default model never falls back upward to the strong Gemini model", r.status === 200 && seen.every((s) => s.model === "gemini-3.5-flash-lite"));

seen.length = 0; script = [() => 400];
r = await call({ prompt: "p" });
t("non-transient 400 is NOT retried", r.status === 400 && seen.length === 1);
t("Gemini key only ever in header, never in URL", seen.every((s) => s.header === "gem-key" && !s.urlHasKey));

// ---- Groq failover specifics
groqCalls.length = 0; seen.length = 0; script = [() => 503, () => 503]; groqScript = [];
r = await call({ system: "You are a tutor.", prompt: "What is a pointer?", maxTokens: 400 }); j = await r.json();
t("live call: Gemini 503 x2 -> Groq answers, tagged provider groq", r.status === 200 && j.provider === "groq" && seen.length === 2 && groqCalls.length === 1);
t("Groq gets ITS key, not Gemini's; Gemini never sees the Groq key", groqCalls[0].auth === "Bearer groq-key" && seen.every((s) => s.header === "gem-key"));
t("Groq request: system+user messages, gpt-oss model, token headroom, low reasoning", groqCalls[0].body.model === "openai/gpt-oss-120b" && groqCalls[0].body.messages[0].role === "system" && groqCalls[0].body.messages[0].content === "You are a tutor." && groqCalls[0].body.messages[1].content === "What is a pointer?" && groqCalls[0].body.max_completion_tokens === 1900 && groqCalls[0].body.reasoning_effort === "low", JSON.stringify(groqCalls[0].body));
seen.length = 0; script = [() => 429, () => 429]; groqCalls.length = 0;
r = await call({ prompt: "p" }); j = await r.json();
t("Gemini 429 (rate limit) also fails over to Groq", r.status === 200 && j.provider === "groq");
seen.length = 0; script = ["THROW", "THROW"]; groqCalls.length = 0;
r = await call({ prompt: "p" }); j = await r.json();
t("Gemini unreachable (network error) -> Groq answers", r.status === 200 && j.provider === "groq" && seen.length === 2);
seen.length = 0; script = [() => 503, () => 503]; groqScript = [{ status: 500 }];
r = await call({ prompt: "p" }); j = await r.json();
t("both providers failing -> one clean error, nothing leaked", r.status === 503 && /AI provider error \(503\)/.test(j.error) && !JSON.stringify(j).includes("groq-key"));
seen.length = 0; script = [() => 503, () => 503]; groqScript = [{ status: 200, text: "   " }];
r = await call({ prompt: "p" });
t("empty Groq answer treated as failure, not shown to students", r.status === 503);
seen.length = 0; script = [() => 429, () => 429]; groqScript = [{ status: 429 }];
r = await call({ prompt: "p" }); j = await r.json();
t("both rate limited -> rateLimited signal the app already understands", r.status === 429 && j.rateLimited === true);
seen.length = 0; script = [() => 200]; groqCalls.length = 0;
r = await call({ prompt: "p" }); j = await r.json();
t("healthy Gemini never touches Groq", j.provider === "gemini" && groqCalls.length === 0);
// strong model: strong x3 + lite x2 all fail, then Groq
seen.length = 0; groqCalls.length = 0; script = [() => 503, () => 503, () => 503, () => 503, () => 503]; groqScript = [];
r = await call({ prompt: "p", model: "gemini-3.5-flash" }); j = await r.json();
t("authoring call walks strong -> lite -> Groq", r.status === 200 && j.provider === "groq" && seen.length === 5 && seen[3].model === "gemini-3.5-flash-lite");
// Groq key absent -> original behaviour
ENV = { GEMINI_API_KEY: "gem-key" };
await import("../.tests/proxy.bundle.mjs?nogroq");
seen.length = 0; groqCalls.length = 0; script = [() => 503, () => 503]; 
r = await call({ prompt: "p" }); j = await r.json();
t("no GROQ_API_KEY secret -> behaves exactly as before (clean 503), Groq never called", r.status === 503 && j.error === "AI provider error (503)" && groqCalls.length === 0);
console.log(fail ? `\n${fail} FAILED` : "\nALL PASS"); fs.rmSync(".tests/proxy.bundle.mjs"); process.exit(fail ? 1 : 0);
