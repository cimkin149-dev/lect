// Lecturer-side view of individual students: who is strong or weak on which concept,
// who needs attention, how to form mixed groups, which topics to test, and a short
// briefing to read before walking into the physical lecture.
//
// Input rows come from the module_student_events database function (only students who
// agreed to share their progress). Everything here is explainable on purpose: a
// lecturer can be told exactly why a student was flagged.

import { estimateMastery, calibration } from "./mastery.js";

const round2 = (n) => Math.round(n * 100) / 100;

// rows -> one record per student
export function buildRoster(rows, now = Date.now()) {
  const by = new Map();
  for (const r of rows || []) {
    if (!r || !r.who) continue;
    if (!by.has(r.who)) by.set(r.who, { who: r.who, name: null, username: null, checks: [], lost: 0, unsure: 0, gotIt: 0, questions: 0, completed: false, sessions: new Set(), lastAt: 0 });
    const s = by.get(r.who);
    if (r.display_name) s.name = r.display_name;
    if (r.username) s.username = r.username;
    if (r.session_id) s.sessions.add(r.session_id);
    const ts = r.created_at ? Date.parse(r.created_at) : now;
    if (ts > s.lastAt) s.lastAt = ts;
    if (r.event_type === "check_answer" && r.concept && typeof r.correct === "boolean") {
      s.checks.push({ concept: r.concept, correct: r.correct, confidence: r.confidence || null, ts });
    } else if (r.event_type === "signal") {
      if (r.value === "lost") s.lost += 1; else if (r.value === "unsure") s.unsure += 1; else if (r.value === "got_it") s.gotIt += 1;
    } else if (r.event_type === "question") s.questions += 1;
    else if (r.event_type === "session_end") s.completed = true;
  }
  let anon = 0;
  const roster = [];
  for (const s of by.values()) {
    const concepts = estimateMastery(s.checks, now);
    const answered = s.checks.length;
    const correct = s.checks.filter((c) => c.correct).length;
    const totalN = concepts.reduce((n, c) => n + c.n, 0);
    const overall = answered >= 3 && totalN ? round2(concepts.reduce((n, c) => n + c.mastery * c.n, 0) / totalN) : null;
    const confidentWrong = concepts.reduce((n, c) => n + c.confidentWrong, 0);
    const weak = concepts.filter((c) => c.level === "weak");
    const developing = concepts.filter((c) => c.level === "developing");
    const cal = calibration(s.checks);
    const reasons = [];
    if (weak.length) reasons.push(`weak on ${weak.map((c) => c.concept).join(", ")}`);
    if (confidentWrong >= 2) reasons.push(`${confidentWrong} answers marked “very sure” were wrong`);
    if (s.lost >= 2) reasons.push(`tapped “I'm lost” ${s.lost} times`);
    if (cal.level === "overconfident") reasons.push("often very sure but wrong");
    let status;
    if (answered < 3) status = "insufficient";
    else if ((weak.length && (overall < 0.5 || confidentWrong >= 2)) || s.lost >= 3) status = "attention";
    else if (weak.length || developing.length || s.lost >= 2 || s.unsure >= 3) status = "watch";
    else status = "ok";
    roster.push({
      who: s.who,
      name: s.name || `Student ${++anon}`,
      named: !!s.name,
      username: s.username,
      label: s.username ? `${s.name} (@${s.username})` : s.name,
      answered, correct, overall, status, reasons,
      concepts, weak: weak.map((c) => c.concept),
      strong: concepts.filter((c) => c.level === "strong").map((c) => c.concept),
      lost: s.lost, unsure: s.unsure, gotIt: s.gotIt, questions: s.questions,
      confidentWrong, calibration: cal.level, completed: s.completed, sessions: s.sessions.size, lastAt: s.lastAt || null,
    });
  }
  const order = { attention: 0, watch: 1, ok: 2, insufficient: 3 };
  return roster.sort((a, b) => order[a.status] - order[b.status] || (a.overall ?? 2) - (b.overall ?? 2) || a.name.localeCompare(b.name));
}

// Class-level picture per concept, with who is strong / weak in it.
export function classConcepts(roster) {
  const by = new Map();
  for (const st of roster || []) {
    for (const c of st.concepts) {
      if (!by.has(c.concept)) by.set(c.concept, { concept: c.concept, students: 0, answers: 0, sum: 0, weakNames: [], strongNames: [], confidentWrong: 0 });
      const k = by.get(c.concept);
      k.students += 1; k.answers += c.n; k.sum += c.mastery; k.confidentWrong += c.confidentWrong;
      if (c.level === "weak") k.weakNames.push(st.name);
      if (c.level === "strong") k.strongNames.push(st.name);
    }
  }
  return [...by.values()]
    .map((k) => ({ ...k, mastery: round2(k.sum / k.students), weakShare: round2(k.weakNames.length / k.students) }))
    .sort((a, b) => a.mastery - b.mastery || a.concept.localeCompare(b.concept));
}

// Which topics deserve exam questions, and why.
export function examHints(roster) {
  return classConcepts(roster).map((k) => {
    const thin = k.answers < 3 || k.students < 2;
    let priority = "low", why;
    if (thin) { priority = "unknown"; why = "too little data yet to judge"; }
    else if (k.mastery < 0.5 || k.weakShare >= 0.4) { priority = "high"; why = `class average ${Math.round(k.mastery * 100)}%, ${k.weakNames.length} of ${k.students} students weak`; }
    else if (k.mastery < 0.7 || k.confidentWrong >= 2) { priority = "medium"; why = k.confidentWrong >= 2 ? `${k.confidentWrong} confident wrong answers: likely misconceptions` : `class average ${Math.round(k.mastery * 100)}%`; }
    else why = `well understood (${Math.round(k.mastery * 100)}%): a short check is enough`;
    return { concept: k.concept, priority, why, mastery: k.mastery };
  });
}

// Mixed-ability groups: snake-draft by overall mastery so every group gets strong and weaker
// students, then list who can help whom on each weak concept.
export function suggestGroups(roster, size = 4) {
  const pool = (roster || []).filter((s) => s.overall !== null).sort((a, b) => b.overall - a.overall);
  const unplaced = (roster || []).filter((s) => s.overall === null).map((s) => s.name);
  if (!pool.length) return { groups: [], unplaced };
  const n = Math.max(1, Math.ceil(pool.length / Math.max(2, size)));
  const groups = Array.from({ length: n }, () => []);
  pool.forEach((s, i) => {
    const round = Math.floor(i / n);
    const idx = round % 2 === 0 ? i % n : n - 1 - (i % n);
    groups[idx].push(s);
  });
  return {
    unplaced,
    groups: groups.filter((g) => g.length).map((g, gi) => {
      const helps = [];
      for (const s of g) for (const concept of s.weak) {
        const helper = g.find((h) => h.who !== s.who && h.strong.includes(concept));
        if (helper) helps.push({ student: s.name, concept, helper: helper.name });
      }
      return { name: `Group ${gi + 1}`, members: g.map((s) => ({ name: s.name, overall: s.overall })), average: round2(g.reduce((n2, s) => n2 + s.overall, 0) / g.length), helps };
    }),
  };
}

// Plain-text briefing the lecturer can read (or copy) before the physical lecture.
export function buildBriefing(roster, { unit = "this module", now = new Date() } = {}) {
  const concepts = classConcepts(roster);
  const attention = (roster || []).filter((s) => s.status === "attention");
  const watch = (roster || []).filter((s) => s.status === "watch");
  const lines = [`Briefing for ${unit}`, `${(roster || []).length} student(s) shared their progress (${now.toISOString().slice(0, 10)}).`, ""];
  const weakest = concepts.filter((c) => c.answers >= 3 && c.mastery < 0.7).slice(0, 4);
  lines.push("Re-explain in class:");
  if (weakest.length) for (const c of weakest) lines.push(`- ${c.concept}: class average ${Math.round(c.mastery * 100)}%${c.weakNames.length ? `, struggling: ${c.weakNames.join(", ")}` : ""}`);
  else lines.push("- Nothing stands out yet.");
  lines.push("", "Students needing attention:");
  if (attention.length) for (const s of attention) lines.push(`- ${s.name}: ${s.reasons.join("; ") || "low overall understanding"}`);
  else lines.push("- None flagged.");
  if (watch.length) { lines.push("", "Keep an eye on:"); for (const s of watch) lines.push(`- ${s.name}: ${s.reasons.join("; ") || "some concepts still developing"}`); }
  const strongAt = concepts.filter((c) => c.strongNames.length).slice(0, 4);
  if (strongAt.length) { lines.push("", "Students who can help others:"); for (const c of strongAt) lines.push(`- ${c.concept}: ${c.strongNames.join(", ")}`); }
  return lines.join("\n");
}
