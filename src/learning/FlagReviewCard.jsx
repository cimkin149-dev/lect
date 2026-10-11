import React, { useState } from "react";

// A flagged student question awaiting review. The lecturer can simply mark it resolved, or WRITE THE
// CORRECT ANSWER: the AI lecturer then uses that answer when a student asks something similar.
// The approved question is edited into a general form, so a student's own wording (or any personal
// detail in it) is never what other students' lectures see.
export default function FlagReviewCard({ f, onResolve, onApprove }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(f.question || "");
  const [a, setA] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    if (!q.trim() || !a.trim()) { setErr("Please fill in both the question and your answer."); return; }
    setBusy(true);
    setErr("");
    try {
      await onApprove(f.id, q.trim().slice(0, 300), a.trim().slice(0, 1500));
    } catch (e) {
      setErr((e && e.message) || "Couldn't save. Try again.");
      setBusy(false);
    }
  };

  return (
    <div className="flag-card">
      <div className="flag-card-meta">{f.slide_title || "Unknown slide"} · {f.student_name || "Student"} · {new Date(f.created_at).toLocaleDateString()}</div>
      <div className="flag-card-question">"{f.question}"</div>
      {f.ai_answer && <div className="flag-card-answer">AI said: {f.ai_answer}</div>}
      {!open ? (
        <div className="account-actions">
          <button className="nav-btn" onClick={() => setOpen(true)}>Write the correct answer</button>
          <button className="nav-btn" onClick={() => onResolve(f.id)}>Mark resolved</button>
        </div>
      ) : (
        <div className="flag-approve">
          <label className="sk-edit-field">
            <span>The question, worded generally (no names). This is what the AI sees.</span>
            <textarea className="slide-card-notes" rows={2} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Question, worded generally" />
          </label>
          <label className="sk-edit-field">
            <span>Your answer. The AI will use it next time a student asks something similar.</span>
            <textarea className="slide-card-notes" rows={4} value={a} onChange={(e) => setA(e.target.value)} aria-label="Your answer" />
          </label>
          {err && <div className="setup-error" role="alert">{err}</div>}
          <div className="account-actions">
            <button className="nav-btn" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save answer and resolve"}</button>
            <button className="nav-btn" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
