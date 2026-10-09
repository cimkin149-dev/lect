import { execSync } from "node:child_process";
import fs from "node:fs";
execSync("npx esbuild supabase/functions/gemini-proxy/index.ts --log-level=error --outfile=.tests/proxy.bundle.mjs --format=esm");
let fail = 0;
const t = (n, c, e) => { if (!c) { fail++; console.log("FAIL", n, e ?? ""); } else console.log("ok  ", n); };
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn) => realSetTimeout(fn, 0); // make backoff instant in tests
globalThis.Deno = { env: { get: () => "k" }, serve: (h) => { globalThis.handler = h; } };
let script = []; const seen = [];
globalThis.fetch = async (url, o) => {
  const model = /models\/([^:]+):/.exec(url)[1];
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
t("both models down -> clean error, status 503, no upstream text leaked", r.status === 503 && j.error === "AI provider error (503)" && seen.length === 6, JSON.stringify({ s: r.status, j }));

seen.length = 0; script = [() => 503, () => 503, () => 503];
r = await call({ prompt: "p" }); j = await r.json();
t("default model never falls back upward (no cost escalation)", r.status === 503 && seen.every((s) => s.model === "gemini-3.5-flash-lite") && seen.length === 3);

seen.length = 0; script = [() => 400];
r = await call({ prompt: "p" });
t("non-transient 400 is NOT retried", r.status === 400 && seen.length === 1);
t("key only ever in header", seen.every((s) => s.header === "k" && !s.urlHasKey));
console.log(fail ? `\n${fail} FAILED` : "\nALL PASS"); fs.rmSync(".tests/proxy.bundle.mjs"); process.exit(fail ? 1 : 0);
