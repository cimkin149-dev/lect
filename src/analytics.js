// Learning analytics event tracker (Phase A of the analytics engine).
//
// Records WHAT the learner does during a lecture (slide views and dwell time,
// navigation, questions, confusion signals, comprehension-check answers...) as an
// append-only event log. No names, emails or typed text go in here: events are
// tied to a session id, a random per-browser pseudonym and, when signed in, the
// account id. Lecturer previews are never tracked, so test runs can't pollute
// real analytics.
//
// Reliability: events are buffered and sent in batches (every 8s, on tab hide,
// and on session end). A signed-in student's events carry their account id, which
// needs their access token; if that token has expired the batch is retried
// without the account id (as an anonymous event) rather than being lost.

let cfg = null;
let buffer = [];
let sent = 0;
let timer = null;
const MAX_EVENTS_PER_SESSION = 1500;
const BATCH = 40;

const clip = (v, n) => (v === undefined || v === null || v === "" ? null : String(v).slice(0, n));

export function getStudentKey(storage = typeof localStorage !== "undefined" ? localStorage : null) {
  try {
    let k = storage && storage.getItem("semai_student_key");
    if (!k) {
      k = `sk-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
      storage && storage.setItem("semai_student_key", k);
    }
    return k;
  } catch (e) {
    return `sk-${Math.random().toString(36).slice(2, 12)}`;
  }
}

// Short stable fingerprint of a slide's content, so analysis stays valid even if the module is edited later.
export function slideKeyFor(slide, index) {
  const basis = `${slide.type}|${slide.title}|${(slide.concepts || []).join(",")}`;
  let h = 5381;
  for (let i = 0; i < basis.length; i++) h = ((h << 5) + h + basis.charCodeAt(i)) | 0;
  return `${index}:${(h >>> 0).toString(36)}`;
}

export function startTracking(c) {
  stopTracking();
  if (!c || c.enabled === false) return;
  cfg = { ...c };
  buffer = [];
  sent = 0;
  try {
    timer = setInterval(flushEvents, 8000);
    if (typeof window !== "undefined") window.addEventListener("pagehide", flushEvents);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);
  } catch (e) { /* ignore */ }
}

function onVisibility() {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") flushEvents();
}

export function track(type, slide = null, payload = null) {
  try {
    if (!cfg || sent + buffer.length >= MAX_EVENTS_PER_SESSION) return;
    buffer.push({
      client_ts: new Date().toISOString(),
      session_id: cfg.sessionId,
      course_id: cfg.courseId,
      module_id: cfg.moduleId,
      student_id: cfg.studentId || null,
      student_key: cfg.studentKey || null,
      research_consent: !!cfg.consent,
      slide_index: slide ? slide.index : null,
      slide_key: slide ? clip(slide.key, 60) : null,
      event_type: type,
      payload: payload && typeof payload === "object" ? payload : null,
    });
  } catch (e) { /* tracking must never break the lecture */ }
}

async function post(c, rows, token) {
  const res = await fetch(`${c.url}/rest/v1/learning_events`, {
    method: "POST",
    keepalive: true,
    headers: { apikey: c.key, Authorization: `Bearer ${token || c.key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(rows),
  });
  return res;
}

export function flushEvents() {
  try {
    if (!cfg || !buffer.length) return Promise.resolve();
    const c = cfg; // captured: a retry may complete after stopTracking() has cleared cfg
    const jobs = [];
    while (buffer.length) {
      const batch = buffer.splice(0, BATCH);
      sent += batch.length;
      const token = c.getToken ? c.getToken() : null;
      jobs.push(
        post(c, batch, token)
          .then(async (res) => {
            if (res && (res.status === 401 || res.status === 403) && batch.some((r) => r.student_id)) {
              // expired sign-in: keep the data, drop only the account link
              return post(c, batch.map((r) => ({ ...r, student_id: null })), null);
            }
            return res;
          })
          .catch(() => {})
      );
    }
    return Promise.all(jobs).then(() => {});
  } catch (e) {
    return Promise.resolve();
  }
}

export function stopTracking() {
  try {
    if (timer) clearInterval(timer);
    if (typeof window !== "undefined") window.removeEventListener("pagehide", flushEvents);
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
  } catch (e) { /* ignore */ }
  timer = null;
  cfg = null;
  buffer = [];
}

export const _internals = { get pending() { return buffer.length; }, get sent() { return sent; } };
