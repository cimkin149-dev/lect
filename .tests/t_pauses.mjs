import { welcomeBackLine, createPauseTracker, breakNudgeDue, pauseHotspot, engagementSummary, focusRhythmText, BREAK_NUDGE_TEXT, MIN } from "../src/learning/pauses.js";
let fail = 0;
const t = (n, c, e) => { if (!c) { fail++; console.log("FAIL", n, e ?? ""); } else console.log("ok  ", n); };

// ---- the lecturer notices, proportionally
t("a short pause (<15s) gets no interruption at all", welcomeBackLine({ ms: 8000, slideTitle: "X" }) === null && welcomeBackLine({ ms: 14999 }) === null);
t("15s-2min: brief welcome back, no recap", /^Welcome back\. Let me pick up where I stopped\.$/.test(welcomeBackLine({ ms: 45000, slideTitle: "Pointers" })));
t("2-10 min: names the slide and repeats the last point", /Welcome back\. We were on "Pointers", so I'll repeat the last point\./.test(welcomeBackLine({ ms: 5 * MIN, slideTitle: "Pointers" })));
t("10+ min: friendly full recap, never scolding", /Welcome back! It's been a little while/.test(welcomeBackLine({ ms: 30 * MIN, slideTitle: "Pointers" })) && !/late|where were you|slow|distract|attention/i.test(welcomeBackLine({ ms: 30 * MIN, slideTitle: "P" })));
t("works without a slide title", /on this slide/.test(welcomeBackLine({ ms: 5 * MIN })));

// ---- tracker
let clock = 1000;
const tr = createPauseTracker(() => clock);
t("starts inactive", tr.active === false && tr.stats().count === 0 && tr.end() === null);
t("start works once; a second start while paused is ignored (no double counting)", tr.start("manual", 2) === true && tr.start("away", 2) === false && tr.active && tr.reason === "manual");
clock += 40000;
const e1 = tr.end();
t("end returns the duration, reason and slide", e1.ms === 40000 && e1.reason === "manual" && e1.slideIndex === 2 && !tr.active);
tr.start("away", 3); clock += 600000;
t("stats include a pause still in progress (session ends while paused)", tr.stats().count === 2 && tr.stats().away === 1 && tr.stats().manual === 1 && tr.stats().totalMs === 640000 && tr.stats().longestMs === 600000, JSON.stringify(tr.stats()));
tr.end();
t("unknown reasons are treated as manual", (() => { const x = createPauseTracker(() => 0); x.start("weird", 0); return x.reason === "manual"; })());

// ---- break nudge
const now = 100 * MIN;
t("no nudge before 25 minutes", breakNudgeDue({ focusStartMs: now - 24 * MIN, now }) === false);
t("nudge after 25 unbroken minutes", breakNudgeDue({ focusStartMs: now - 26 * MIN, now }) === true);
t("after a nudge, the next one waits another full stretch", breakNudgeDue({ focusStartMs: now - 60 * MIN, now, lastNudgeMs: now - 5 * MIN }) === false && breakNudgeDue({ focusStartMs: now - 60 * MIN, now, lastNudgeMs: now - 26 * MIN }) === true);
t("nudge wording is kind and points at the pause button", /short break/.test(BREAK_NUDGE_TEXT) && /pause/i.test(BREAK_NUDGE_TEXT) && !/tired|losing|focus/i.test(BREAK_NUDGE_TEXT));

// ---- lecturer hotspot (class level only)
t("hotspot: 3 of 6 students paused (50%) -> flagged with the average", /3 of 6 students paused here \(about 45s on average\)/.test(pauseHotspot({ viewers: 6, manual_pausers: 3, avg_manual_pause_ms: 45000 })));
t("hotspot needs enough students and a high enough share", pauseHotspot({ viewers: 2, manual_pausers: 2 }) === null && pauseHotspot({ viewers: 10, manual_pausers: 3 }) === null);
t("hotspot never mentions individuals", !/\b(student [A-Z]|Sam|Alice)\b/.test(pauseHotspot({ viewers: 6, manual_pausers: 3 })));

// ---- the student's own rhythm
const sessions = [{ duration_s: 3000, paused_s: 600, pauses: 1 }, { duration_s: 2400, paused_s: 0, pauses: 0 }, { duration_s: 60, paused_s: 0, pauses: 0 }];
const es = engagementSummary(sessions);
t("tiny sessions (<2 min) are ignored", es.sessions === 2);
t("active ratio = share of time not paused", Math.abs(es.avgActiveRatio - ((2400 / 3000 + 1) / 2)) < 0.011, JSON.stringify(es));
t("focus minutes = active time per stretch between breaks", Math.abs(es.avgFocusMinutes - ((2400 / 2 / 60 + 2400 / 60) / 2)) < 0.11, JSON.stringify(es));
t("one session is not enough to describe a rhythm", focusRhythmText(engagementSummary([sessions[0]])) === null);
const txt = focusRhythmText(es);
t("rhythm text is supportive and about planning, not judging", /minutes between breaks/.test(txt) && /helps you plan/.test(txt) && !/poor|bad|low|weak|distract|attention span/i.test(txt), txt);
t("empty input is safe", engagementSummary(null).sessions === 0 && focusRhythmText(engagementSummary([])) === null);
console.log(fail ? `\n${fail} FAILED` : "\nALL PASS"); process.exit(fail ? 1 : 0);
