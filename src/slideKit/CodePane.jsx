import React, { useEffect, useMemo, useRef, useState } from "react";
import { highlightLines } from "./tokenizer.js";
import { LANGUAGE_LABELS } from "./schema.js";
import { runJavaScript } from "./runJs.js";

// Code editor pane: syntax highlighting for the taught languages, line numbers,
// highlighted "active lines" while the lecturer explains them, a live typing
// mode, expected output, and real in-browser execution for JavaScript.
export default function CodePane({ code, language, filename, typedCode = null, typing = false, activeLines = null, caption = "", expectedOutput = "", liveTag = false }) {
  const shown = typedCode !== null ? typedCode : code;
  const lines = useMemo(() => highlightLines(shown, language), [shown, language]);
  const bodyRef = useRef(null);
  const [run, setRun] = useState({ status: "idle", output: "", error: "" });

  useEffect(() => {
    if (!activeLines || !bodyRef.current) return;
    const el = bodyRef.current.querySelector(`[data-line="${activeLines[0]}"]`);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeLines]);

  useEffect(() => { setRun({ status: "idle", output: "", error: "" }); }, [code]);

  const doRun = async () => {
    setRun({ status: "running", output: "", error: "" });
    const r = await runJavaScript(code);
    setRun({ status: "done", output: r.output, error: r.error });
  };

  const inActive = (n) => !!activeLines && n >= activeLines[0] && n <= activeLines[1];
  return (
    <div className="sk-ide">
      <div className="sk-ide-bar">
        <span className="sk-ide-name">{filename || "main.txt"}</span>
        <span className="sk-ide-right">
          {liveTag && <span className="live-tag"><span className="live-dot" /> typing live</span>}
          <span className="sk-lang">{LANGUAGE_LABELS[language] || "Code"}</span>
        </span>
      </div>
      <div className="sk-ide-body" ref={bodyRef} role="region" aria-label={`Code, ${LANGUAGE_LABELS[language] || "code"}`} tabIndex={0}>
        {lines.map((html, i) => (
          <div key={i} data-line={i + 1} className={`sk-line${inActive(i + 1) ? " active" : ""}${activeLines && !inActive(i + 1) ? " dim" : ""}`}>
            <span className="sk-ln" aria-hidden="true">{i + 1}</span>
            <span className="sk-code" dangerouslySetInnerHTML={{ __html: html || "&nbsp;" }} />
            {typing && i === lines.length - 1 && <span className="type-cursor">▍</span>}
          </div>
        ))}
      </div>
      {caption && <div className="sk-step-caption" aria-live="polite">{caption}</div>}
      {language === "javascript" && (
        <div className="sk-run">
          <button className="sk-run-btn" onClick={doRun} disabled={run.status === "running"}>{run.status === "running" ? "Running…" : "▶ Run"}</button>
          {run.status === "done" && (
            <div className="sk-output">
              <div className="sk-output-label">Output — ran in your browser</div>
              <pre>{run.output || (run.error ? "" : "(no output)")}{run.error ? `${run.output ? "\n" : ""}⚠ ${run.error}` : ""}</pre>
            </div>
          )}
        </div>
      )}
      {expectedOutput && (
        <div className="sk-output">
          <div className="sk-output-label">Expected output — written by the AI, not executed</div>
          <pre>{expectedOutput}</pre>
        </div>
      )}
    </div>
  );
}
