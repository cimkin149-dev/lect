// Pauses: a student-controlled break, plus automatic "away" pauses (screen locked / tab left).
//
// How pauses are used, and deliberately NOT used:
//  - They are rhythm and pacing signals. Reading slowly IS concentration and a phone call is life, so a pause
//    is never scored against a student and never shown to a lecturer as an individual's "attention level".
//  - The lecturer sees class-level patterns only: slides many students stop on are probably dense.
//  - Each student can see their own focus rhythm (and nobody else's), framed as a planning aid.

export const MIN = 60000;

// What the lecturer says when the student comes back. Short pauses get no interruption at all.
export function welcomeBackLine({ ms, slideTitle }) {
  if (ms < 15000) return null;
  const title = slideTitle ? ` "${slideTitle}"` : "";
  if (ms < 2 * MIN) return "Welcome back. Let me pick up where I stopped.";
  if (ms < 10 * MIN) return `Welcome back. We were on${title || " this slide"}, so I'll repeat the last point.`;
  return `Welcome back! It's been a little while, so let me quickly recap: we were looking at${title || " this slide"}.`;
}

// Tracks pauses for one session (including one still in progress when the session ends).
export function createPauseTracker(now = () => Date.now()) {
  let current = null;
  const done = [];
  return {
    start(reason, slideIndex) {
      if (current) return false;
      current = { reason: reason === "away" ? "away" : "manual", slideIndex, startedAt: now() };
      return true;
    },
    end() {
      if (!current) return null;
      const r = { reason: current.reason, slideIndex: current.slideIndex, ms: Math.max(0, now() - current.startedAt) };
      done.push(r);
      current = null;
      return r;
    },
    get active() { return !!current; },
    get reason() { return current ? current.reason : null; },
    stats() {
      const all = [...done];
      if (current) all.push({ reason: current.reason, slideIndex: current.slideIndex, ms: Math.max(0, now() - current.startedAt) });
      return {
        count: all.length,
        manual: all.filter((p) => p.reason === "manual").length,
        away: all.filter((p) => p.reason === "away").length,
        totalMs: all.reduce((n, p) => n + p.ms, 0),
        longestMs: all.reduce((n, p) => Math.max(n, p.ms), 0),
      };
    },
  };
}

// A gentle suggestion to rest after a long unbroken stretch (and again only after another full stretch).
export function breakNudgeDue({ focusStartMs, now, lastNudgeMs = 0, thresholdMin = 25 }) {
  const since = Math.max(focusStartMs || 0, lastNudgeMs || 0);
  return now - since >= thresholdMin * MIN;
}
export const BREAK_NUDGE_TEXT = "We've been going for a good while. This is a nice moment for a short break if you'd like one. Press pause whenever you need, and I'll wait for you.";

// Lecturer view: do many students stop on this slide? (manual pauses only; "away" says nothing about the slide)
export function pauseHotspot(row) {
  const viewers = Number(row.viewers) || 0;
  const pausers = Number(row.manual_pausers) || 0;
  if (viewers < 3 || pausers / viewers < 0.4) return null;
  const secs = Number(row.avg_manual_pause_ms) ? Math.round(Number(row.avg_manual_pause_ms) / 1000) : null;
  return `${pausers} of ${viewers} students paused here${secs ? ` (about ${secs}s on average)` : ""}. The slide may be dense or need more time. Consider splitting it or slowing the narration.`;
}

// A student's own focus rhythm, from their finished sessions' totals.
// sessions: [{ duration_s, paused_s, pauses }]
export function engagementSummary(sessions) {
  const ok = (sessions || []).filter((s) => s && Number(s.duration_s) >= 120);
  if (!ok.length) return { sessions: 0, avgActiveRatio: null, avgFocusMinutes: null };
  let ratioSum = 0, stretchSum = 0;
  for (const s of ok) {
    const duration = Number(s.duration_s);
    const paused = Math.min(duration, Number(s.paused_s) || 0);
    const active = duration - paused;
    ratioSum += active / duration;
    stretchSum += active / ((Number(s.pauses) || 0) + 1) / 60;
  }
  return { sessions: ok.length, avgActiveRatio: Math.round((ratioSum / ok.length) * 100) / 100, avgFocusMinutes: Math.round((stretchSum / ok.length) * 10) / 10 };
}

export function focusRhythmText(summary) {
  if (!summary || summary.sessions < 2 || summary.avgFocusMinutes === null) return null;
  const m = Math.round(summary.avgFocusMinutes);
  return `Across your last ${summary.sessions} lectures you usually go about ${m} minute${m === 1 ? "" : "s"} between breaks. Knowing your own rhythm helps you plan: for example, put a short break where it suits you, and press pause whenever you need one.`;
}
