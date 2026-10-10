// Turns the raw per-slide statistics (from the module_slide_stats database
// function) into something a lecturer can act on: an "attention score" that
// combines wrong answers on the comprehension check, confusion signals and
// question volume, but only trusts a signal once there is enough data behind it.

const num = (v) => Number(v) || 0;

export function attentionScore(row) {
  const viewers = num(row.viewers);
  const checks = num(row.checks);
  const signals = num(row.got_it) + num(row.unsure) + num(row.lost);
  const parts = [];
  if (checks >= 3) parts.push({ w: 0.5, v: 1 - num(row.checks_correct) / checks }); // wrong-answer rate
  if (signals >= 3) parts.push({ w: 0.3, v: (num(row.lost) * 1 + num(row.unsure) * 0.5) / signals }); // confusion share
  if (viewers >= 3) parts.push({ w: 0.2, v: Math.min(1, (num(row.questions) + num(row.low_confidence)) / viewers) }); // questions per viewer
  if (!parts.length) return null; // not enough data to say anything
  const totalW = parts.reduce((n, p) => n + p.w, 0);
  return Math.round((parts.reduce((n, p) => n + p.w * p.v, 0) / totalW) * 100) / 100;
}

export function heatLevel(score) {
  if (score === null || score === undefined) return "unknown";
  if (score >= 0.5) return "hot";
  if (score >= 0.3) return "warm";
  return "cool";
}

export function whyFlagged(row) {
  const reasons = [];
  const checks = num(row.checks);
  const signals = num(row.got_it) + num(row.unsure) + num(row.lost);
  if (checks >= 3 && num(row.checks_correct) / checks < 0.6) reasons.push(`only ${Math.round((num(row.checks_correct) / checks) * 100)}% answered the check correctly`);
  if (signals >= 3 && (num(row.lost) + num(row.unsure)) / signals >= 0.4) reasons.push(`${Math.round(((num(row.lost) + num(row.unsure)) / signals) * 100)}% said unsure or lost`);
  if (num(row.viewers) >= 3 && (num(row.questions) + num(row.low_confidence)) / num(row.viewers) >= 0.5) reasons.push("many questions asked here");
  return reasons;
}

export function formatDwell(ms) {
  if (ms === null || ms === undefined) return "–";
  const s = Math.round(ms / 1000);
  return s < 90 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}
