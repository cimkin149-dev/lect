import React, { useEffect, useState } from "react";

let initialised = false;
let counter = 0;

const THEME = {
  background: "transparent", primaryColor: "#2A3340", primaryTextColor: "#EDEFF2", primaryBorderColor: "#E8A33D",
  lineColor: "#E8A33D", secondaryColor: "#25303B", tertiaryColor: "#1E2530", textColor: "#EDEFF2",
  nodeTextColor: "#EDEFF2", edgeLabelBackground: "#1E2530", clusterBkg: "#222A35", clusterBorder: "#3A4452",
  fontSize: "15px", actorBkg: "#2A3340", actorBorder: "#E8A33D", actorTextColor: "#EDEFF2", signalColor: "#C7CCD4",
  noteBkgColor: "#3A3322", noteTextColor: "#EDEFF2", labelBoxBkgColor: "#2A3340",
};

// Mermaid is large, so it is only fetched the first time a diagram is shown.
export default function DiagramView({ code, caption }) {
  const [state, setState] = useState({ status: "loading", svg: "" });
  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", svg: "" });
    (async () => {
      const id = `sk-mm-${++counter}`;
      try {
        const mermaid = (await import("mermaid")).default;
        if (!initialised) {
          mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "base", themeVariables: THEME, fontFamily: "Inter, system-ui, sans-serif", flowchart: { curve: "basis", htmlLabels: true } });
          initialised = true;
        }
        const { svg } = await mermaid.render(id, code);
        if (!cancelled) setState({ status: "ok", svg });
      } catch (e) {
        const stray = document.getElementById(`d${id}`) || document.getElementById(id);
        if (stray && stray.parentNode) stray.parentNode.removeChild(stray);
        if (!cancelled) setState({ status: "error", svg: "" });
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  return (
    <figure className="sk-figure">
      {state.status === "loading" && <div className="sk-skeleton" role="status" aria-label="Drawing diagram">Drawing diagram…</div>}
      {state.status === "ok" && <div className="sk-diagram" role="img" aria-label={caption || "Diagram"} dangerouslySetInnerHTML={{ __html: state.svg }} />}
      {state.status === "error" && (
        <div className="sk-diagram-fallback" role="note">
          This diagram couldn't be drawn on this device.{caption ? ` It shows: ${caption}` : ""}
        </div>
      )}
      {caption && state.status !== "error" && <figcaption className="sk-caption">{caption}</figcaption>}
    </figure>
  );
}
