import { startTracking, track, flushEvents, stopTracking, slideKeyFor, getStudentKey, _internals } from "../src/analytics.js";
let fail = 0;
const t = (n, c, e) => { if (!c) { fail++; console.log("FAIL", n, e ?? ""); } else console.log("ok  ", n); };
globalThis.window = { addEventListener() {}, removeEventListener() {} };
globalThis.document = { addEventListener() {}, removeEventListener() {}, visibilityState: "visible" };
globalThis.setInterval = () => 1; globalThis.clearInterval = () => {};
const calls = [];
let script = [];
globalThis.fetch = async (url, o) => { const rows = JSON.parse(o.body); const status = script.length ? script.shift() : 201; calls.push({ url, auth: o.headers.Authorization, rows, status }); return { status, ok: status < 300 }; };
const base = { url: "https://x.supabase.co", key: "anon", sessionId: "sess-1", courseId: "c1", moduleId: "m1", studentKey: "sk-abc", consent: false };
const slide = { index: 2, key: "2:abc" };

// --- enabled=false (lecturer preview) records nothing
startTracking({ ...base, enabled: false });
track("slide_view", slide); await flushEvents();
t("lecturer preview: nothing tracked or sent", calls.length === 0 && _internals.pending === 0);

// --- anonymous student
startTracking({ ...base, studentId: null });
track("session_start", null, { total_slides: 5 });
track("slide_view", slide);
track("check_answer", slide, { correct: true, option: 1, time_ms: 4200, confidence: "sure" });
await flushEvents();
t("one batch to the write-only table with the anon key", calls.length === 1 && calls[0].url.endsWith("/rest/v1/learning_events") && calls[0].auth === "Bearer anon" && calls[0].rows.length === 3);
const r = calls[0].rows[2];
t("row shape: ids, slide context, event type, payload; consent false by default", r.session_id === "sess-1" && r.course_id === "c1" && r.module_id === "m1" && r.slide_index === 2 && r.slide_key === "2:abc" && r.event_type === "check_answer" && r.payload.correct === true && r.research_consent === false && r.student_id === null && r.student_key === "sk-abc", JSON.stringify(r));
t("no name/email/text fields anywhere in a row", !Object.keys(r).some((k) => /name|email|text|transcript/.test(k)));
t("session-level event has null slide", calls[0].rows[0].slide_index === null);

// --- signed-in student: token used, expired token -> retried without account id (data kept)
calls.length = 0; stopTracking();
startTracking({ ...base, studentId: "uid-1", consent: true, getToken: () => "user-jwt" });
track("signal", slide, { value: "lost" });
script = [401, 201];
await flushEvents();
t("signed-in: first attempt uses the student's token and account id", calls[0].auth === "Bearer user-jwt" && calls[0].rows[0].student_id === "uid-1" && calls[0].rows[0].research_consent === true);
t("expired token: batch retried anonymously, not lost", calls.length === 2 && calls[1].auth === "Bearer anon" && calls[1].rows[0].student_id === null && calls[1].rows[0].event_type === "signal");

// --- leaving the room right after an expired-token batch must not lose the retry
calls.length = 0; stopTracking();
startTracking({ ...base, studentId: "uid-1", getToken: () => "old-jwt" });
track("session_end", null, { completed: true });
script = [401, 201];
const pending = flushEvents(); stopTracking(); await pending;
t("retry still completes after stopTracking()", calls.length === 2 && calls[1].rows[0].event_type === "session_end" && calls[1].rows[0].student_id === null, calls.length);

// --- caps and batching
calls.length = 0; stopTracking(); startTracking({ ...base });
for (let i = 0; i < 2000; i++) track("slide_view", slide);
await flushEvents();
const total = calls.reduce((n, c) => n + c.rows.length, 0);
t("hard cap of 1500 events per session", total === 1500, total);
t("batches of at most 40 rows", calls.every((c) => c.rows.length <= 40));

// --- helpers
t("slideKey stable for same content, changes when content changes", slideKeyFor({ type: "concept", title: "A", concepts: ["x"] }, 3) === slideKeyFor({ type: "concept", title: "A", concepts: ["x"] }, 3) && slideKeyFor({ type: "concept", title: "A", concepts: ["x"] }, 3) !== slideKeyFor({ type: "concept", title: "B", concepts: ["x"] }, 3));
const store = {}; const fake = { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; } };
const k1 = getStudentKey(fake), k2 = getStudentKey(fake);
t("pseudonymous student key is random, persisted, reused", k1 === k2 && /^sk-/.test(k1) && k1.length < 40);
stopTracking(); track("slide_view", slide);
t("track before start / after stop is a safe no-op", _internals.pending === 0);
t("flush with nothing never throws", (await flushEvents()) === undefined);
console.log(fail ? `\n${fail} FAILED` : "\nALL PASS"); process.exit(fail ? 1 : 0);
