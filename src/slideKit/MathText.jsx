import React, { useMemo } from "react";
import "katex/dist/katex.min.css";
import { renderLatexHTML, splitRichText } from "./latex.js";

// Renders a string that may contain $inline$ or $$display$$ math.
export function Rich({ text }) {
  const parts = useMemo(() => splitRichText(text), [text]);
  return (
    <>
      {parts.map((p, i) =>
        p.type === "text" ? (
          <React.Fragment key={i}>{p.value}</React.Fragment>
        ) : (
          <span key={i} className={p.display ? "sk-math-display" : "sk-math-inline"} dangerouslySetInnerHTML={{ __html: renderLatexHTML(p.value, p.display) }} />
        )
      )}
    </>
  );
}

// A standalone display equation.
export function MathBlock({ latex, className = "" }) {
  const html = useMemo(() => renderLatexHTML(latex, true), [latex]);
  if (!html) return null;
  return <div className={`sk-math-block ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
