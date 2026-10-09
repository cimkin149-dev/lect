import { installTelemetry, logTiming, flushTimings, getTimingSummary, _resetTelemetryForTests } from "../src/telemetry.js";
let fail = 0;
const t = (n, c, e) => { if (!c) { fail++; console.log("FAIL", n, e ?? ""); } else console.log("ok  ", n); };
const sent = [];
globalThis.window = { addEventListener() {} };
globalThis.document = { addEventListener() {}, visibilityState: "visible" };
globalThis.fetch = async (url, o) => { sent.push({ url, o, rows: JSON.parse(o.body) }); return { ok: true }; };
const realSetInterval = globalThis.setInterval; globalThis.setInterval = () => 0;
installTelemetry({ url: "https://x.supabase.co", key: "anon", version: "9.9.9" });

logTiming("qa", { provider: "groq", model: "openai/gpt-oss-120b", ok: true, status: 200, client_ms: 812.6, server_ms: 700 });
logTiming("qa", { provider: "gemini", ok: true, client_ms: 1500 });
logTiming("qa", { provider: "gemini", ok: false, status: 503, client_ms: 9000 });
logTiming("tts_start", { provider: "elevenlabs", client_ms: 1900, chars: 140, extra: { fetch_ms: 1700 } });
logTiming("bad", { client_ms: "not a number" });
flushTimings();
t("one batched POST to the write-only table", sent.length === 1 && sent[0].url === "https://x.supabase.co/rest/v1/ai_timings" && sent[0].o.headers.Prefer === "return=minimal" && sent[0].o.keepalive === true);
t("rows with no valid duration are dropped", sent[0].rows.length === 4);
const r0 = sent[0].rows[0];
t("fields clipped/rounded, version stamped, no text content fields", r0.client_ms === 813 && r0.app_version === "9.9.9" && r0.provider === "groq" && !("prompt" in r0) && !("text" in r0), JSON.stringify(r0));
t("extra metadata preserved", sent[0].rows[3].extra.fetch_ms === 1700 && sent[0].rows[3].chars === 140);
const sum = getTimingSummary();
const gem = sum.find((s) => s.kind === "qa" && s.provider === "gemini");
t("summary: counts, failures, p50/p95", gem.n === 2 && gem.failures === 1 && gem.p50 === 1500 && gem.p95 === 9000, JSON.stringify(gem));
t("summary groups by kind+provider", sum.length === 3 && sum.some((s) => s.kind === "tts_start" && s.provider === "elevenlabs"));
// cap per page load so a loop can't flood the table
_resetTelemetryForTests(); installTelemetry({ url: "u", key: "k", version: "1" }); sent.length = 0;
for (let i = 0; i < 1000; i++) { logTiming("x", { client_ms: i }); if (i % 100 === 99) flushTimings(); }
flushTimings();
const total = sent.reduce((n, s) => n + s.rows.length, 0);
t("hard cap of 400 rows per page load", total === 400, total);
t("batches never exceed 50 rows", sent.every((s) => s.rows.length <= 50));
// before install: never throws, nothing sent
_resetTelemetryForTests(); sent.length = 0; logTiming("qa", { client_ms: 5 }); flushTimings();
t("safe before install", sent.length === 0 && getTimingSummary().length === 1);
console.log(fail ? `\n${fail} FAILED` : "\nALL PASS"); process.exit(fail ? 1 : 0);
