import React, { useEffect, useMemo, useState } from "react";
import { buildRoster, classConcepts, examHints, suggestGroups, buildBriefing } from "./roster.js";

const STATUS = {
  attention: { label: "Needs attention", heat: "hot" },
  watch: { label: "Keep an eye on", heat: "warm" },
  ok: { label: "On track", heat: "cool" },
  insufficient: { label: "Not enough data", heat: "unknown" },
};
const PRIORITY = { high: { label: "Test this", heat: "hot" }, medium: { label: "Worth testing", heat: "warm" }, low: { label: "Light check", heat: "cool" }, unknown: { label: "No data", heat: "unknown" } };
const pct = (v) => (v === null || v === undefined ? "–" : `${Math.round(v * 100)}%`);

// Lecturer view of individual students (only those who agreed to share). loadRows(moduleId)
// resolves to the rows of the module_student_events database function.
export default function RosterPanel({ course, loadRows }) {
  const modules = course.modules || [];
  const [moduleId, setModuleId] = useState(modules.length ? modules[0].id : null);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("students");
  const [groupSize, setGroupSize] = useState(4);
  const [open, setOpen] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!moduleId) { setRows([]); return undefined; }
    let cancelled = false;
    setRows(null); setError(""); setOpen(null);
    Promise.resolve(loadRows(moduleId))
      .then((r) => { if (!cancelled) setRows(Array.isArray(r) ? r : []); })
      .catch((e) => {
        if (cancelled) return;
        const msg = String((e && e.message) || e || "");
        setError(/module_student_roster|module_student_events|function|404|PGRST202/i.test(msg)
          ? "The student roster isn't switched on in your database yet. Run the file supabase/migrations/20261021_student_profiles.sql once in the Supabase SQL editor."
          : msg || "Couldn't load the student roster.");
        setRows([]);
      });
    return () => { cancelled = true; };
  }, [moduleId, loadRows]);

  const mod = modules.find((m) => m.id === moduleId);
  const roster = useMemo(() => buildRoster(rows || []), [rows]);
  const concepts = useMemo(() => classConcepts(roster), [roster]);
  const hints = useMemo(() => examHints(roster), [roster]);
  const groups = useMemo(() => suggestGroups(roster, groupSize), [roster, groupSize]);
  const briefing = useMemo(() => buildBriefing(roster, { unit: mod ? mod.unit : "this module" }), [roster, mod]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(briefing); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (e) { /* clipboard unavailable */ }
  };

  const tabs = [["students", "Students"], ["briefing", "Pre-lecture briefing"], ["groups", "Groups"], ["exam", "Exam topics"]];

  return (
    <div className="flag-section" aria-label="Individual student progress">
      <div className="flag-section-title">Students: who needs what</div>
      <p className="account-text" style={{ marginTop: 0 }}>
        Shows each student's strengths and weak spots from the quiz questions and “lost / unsure” taps in your SEMAI lecture. Only students who agreed to share their progress with you appear here.
      </p>
      {modules.length > 1 && (
        <select className="join-input" aria-label="Module" value={moduleId || ""} onChange={(e) => setModuleId(e.target.value)} style={{ marginBottom: 12 }}>
          {modules.map((m) => <option key={m.id} value={m.id}>{m.unit}</option>)}
        </select>
      )}
      <div className="pill-row" role="tablist" aria-label="Roster views" style={{ marginBottom: 12, flexWrap: "wrap" }}>
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`pill ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {rows === null && <div className="empty-hint" role="status">Loading…</div>}
      {error && <div className="empty-hint" role="alert">{error}</div>}
      {rows !== null && !error && roster.length === 0 && (
        <div className="empty-hint">No student has shared their progress for this module yet. Students are asked on the join screen, and details appear here once they finish some quiz questions.</div>
      )}

      {roster.length > 0 && tab === "students" && (
        <div className="sk-table-wrap">
          <table className="sk-table" style={{ fontSize: 12.5 }}>
            <thead><tr><th scope="col">Student</th><th scope="col">Status</th><th scope="col">Overall</th><th scope="col">Weak on</th><th scope="col">Strong on</th><th scope="col">Lost taps</th></tr></thead>
            <tbody>
              {roster.map((s) => (
                <React.Fragment key={s.who}>
                  <tr style={{ cursor: "pointer" }} onClick={() => setOpen(open === s.who ? null : s.who)}>
                    <th scope="row"><button className="skip-link inline" aria-expanded={open === s.who} onClick={(e) => { e.stopPropagation(); setOpen(open === s.who ? null : s.who); }}>{s.name}</button>{s.username ? <span style={{ display: "block", fontSize: 11.5, opacity: 0.65, fontWeight: 400 }}>@{s.username}</span> : null}</th>
                    <td><span className={`heat heat-${STATUS[s.status].heat}`}>{STATUS[s.status].label}</span></td>
                    <td>{pct(s.overall)}</td>
                    <td>{s.weak.join(", ") || "–"}</td>
                    <td>{s.strong.join(", ") || "–"}</td>
                    <td>{s.lost}</td>
                  </tr>
                  {open === s.who && (
                    <tr><td colSpan={6}>
                      <div style={{ padding: "6px 4px 10px" }}>
                        {s.reasons.length > 0 && <p style={{ margin: "0 0 8px" }}><strong>Why:</strong> {s.reasons.join("; ")}.</p>}
                        {s.concepts.length === 0 ? <p style={{ margin: 0 }}>No quiz answers yet.</p> : (
                          <ul className="mastery-list">
                            {s.concepts.map((c) => (
                              <li key={c.concept} className="mastery-row">
                                <div className="mastery-head"><span className="mastery-name">{c.concept}</span><span className={`mastery-tag ${c.level}`}>{c.level === "building" ? "Building" : pct(c.mastery)}</span><span className="mastery-trend">{c.n} answer{c.n === 1 ? "" : "s"}{c.trend === "slipping" ? " · slipping" : c.trend === "improving" ? " · improving" : ""}</span></div>
                              </li>
                            ))}
                          </ul>
                        )}
                        <p style={{ margin: "6px 0 0", opacity: 0.7 }}>{s.questions} question(s) asked · {s.unsure} unsure · {s.lost} lost · {s.completed ? "finished the lecture" : "did not finish"}</p>
                      </div>
                    </td></tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {roster.length > 0 && tab === "briefing" && (
        <div>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13.5, lineHeight: 1.6, margin: "0 0 10px" }}>{briefing}</pre>
          <button className="join-btn" style={{ width: "auto", padding: "8px 16px" }} onClick={copy}>{copied ? "Copied" : "Copy briefing"}</button>
        </div>
      )}

      {roster.length > 0 && tab === "groups" && (
        <div>
          <label className="account-text" style={{ display: "block", marginBottom: 10 }}>
            Group size{" "}
            <select value={groupSize} onChange={(e) => setGroupSize(Number(e.target.value))} aria-label="Group size">
              {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            {" "}— each group mixes stronger and weaker students.
          </label>
          {groups.groups.length === 0 && <div className="empty-hint">Not enough quiz answers yet to build groups.</div>}
          {groups.groups.map((g) => (
            <div key={g.name} className="sk-warnings" role="note" style={{ marginBottom: 10 }}>
              <strong>{g.name}</strong> <span style={{ opacity: 0.7 }}>(average {pct(g.average)})</span>
              <ul>{g.members.map((m) => <li key={m.name}>{m.name} · {pct(m.overall)}</li>)}</ul>
              {g.helps.length > 0 && <p style={{ margin: "4px 0 0" }}>Peer help: {g.helps.map((h) => `${h.helper} can help ${h.student} with ${h.concept}`).join("; ")}.</p>}
            </div>
          ))}
          {groups.unplaced.length > 0 && <p className="account-text">Not placed (too few answers): {groups.unplaced.join(", ")}.</p>}
        </div>
      )}

      {roster.length > 0 && tab === "exam" && (
        <div className="sk-table-wrap">
          <table className="sk-table" style={{ fontSize: 12.5 }}>
            <thead><tr><th scope="col">Concept</th><th scope="col">Suggestion</th><th scope="col">Why</th></tr></thead>
            <tbody>
              {hints.map((h) => (
                <tr key={h.concept}>
                  <th scope="row">{h.concept}</th>
                  <td><span className={`heat heat-${PRIORITY[h.priority].heat}`}>{PRIORITY[h.priority].label}</span></td>
                  <td>{h.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="account-text">Based on shared quiz answers only. Treat it as a hint for where to look, not a substitute for your own judgement.</p>
        </div>
      )}
      {concepts.length === 0 && roster.length > 0 && <p className="account-text">Students need to answer more quiz questions before concepts can be compared.</p>}
    </div>
  );
}
