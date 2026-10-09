// Performance telemetry: records HOW LONG things take (AI answers, voice start,
// the silence between a question and the answer) so slow spots can be found
// from data instead of guesses. Durations only — never prompts, answers, names
// or emails. Rows are buffered and sent in batches to the write-only
// `ai_timings` table; the same numbers also feed the in-app speed summary.

let config = null;
let buffer = [];
let sentTotal = 0;
const recent = []; // ring buffer for the local summary
const MAX_RECENT = 400;
const MAX_PER_PAGE_LOAD = 400;
const FLUSH_BATCH = 50;

const clipInt = (v, max) => (Number.isFinite(+v) ? Math.max(0, Math.min(max, Math.round(+v))) : null);
const clipStr = (v, n) => (v === undefined || v === null || v === "" ? null : String(v).slice(0, n));

export function logTiming(kind, f = {}) {
  try {
    const row = {
      kind: clipStr(kind, 30),
      provider: clipStr(f.provider, 20),
      model: clipStr(f.model, 60),
      ok: typeof f.ok === "boolean" ? f.ok : null,
      status: Number.isFinite(+f.status) ? Math.round(+f.status) : null,
      client_ms: clipInt(f.client_ms, 600000),
      server_ms: clipInt(f.server_ms, 600000),
      chars: clipInt(f.chars, 100000),
      app_version: config && config.version ? String(config.version).slice(0, 40) : null,
      extra: f.extra && typeof f.extra === "object" ? f.extra : null,
    };
    if (row.client_ms === null) return;
    recent.push({ kind: row.kind, provider: row.provider, ok: row.ok, ms: row.client_ms });
    if (recent.length > MAX_RECENT) recent.shift();
    if (config && sentTotal + buffer.length < MAX_PER_PAGE_LOAD) buffer.push(row);
  } catch (e) {
    /* telemetry must never break the app */
  }
}

export function flushTimings() {
  try {
    if (!config || !buffer.length) return;
    while (buffer.length) {
      const batch = buffer.splice(0, FLUSH_BATCH);
      sentTotal += batch.length;
      fetch(`${config.url}/rest/v1/ai_timings`, {
        method: "POST",
        keepalive: true,
        headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(batch),
      }).catch(() => {});
    }
  } catch (e) {
    /* ignore */
  }
}

export function installTelemetry({ url, key, version }) {
  config = { url, key, version };
  try {
    setInterval(flushTimings, 20000);
    window.addEventListener("pagehide", flushTimings);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushTimings();
    });
  } catch (e) {
    /* ignore */
  }
}

function pct(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

// -> [{ kind, provider, n, failures, p50, p95 }] for this browser session
export function getTimingSummary() {
  const groups = new Map();
  for (const r of recent) {
    const key = `${r.kind}|${r.provider || ""}`;
    if (!groups.has(key)) groups.set(key, { kind: r.kind, provider: r.provider || "", ms: [], failures: 0 });
    const g = groups.get(key);
    g.ms.push(r.ms);
    if (r.ok === false) g.failures += 1;
  }
  return [...groups.values()]
    .map((g) => {
      const sorted = g.ms.slice().sort((a, b) => a - b);
      return { kind: g.kind, provider: g.provider, n: sorted.length, failures: g.failures, p50: pct(sorted, 50), p95: pct(sorted, 95) };
    })
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.provider.localeCompare(b.provider));
}

export function _resetTelemetryForTests() {
  config = null;
  buffer = [];
  sentTotal = 0;
  recent.length = 0;
}
