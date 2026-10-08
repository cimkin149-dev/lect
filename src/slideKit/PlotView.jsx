import React, { useEffect, useMemo, useState } from "react";
import { buildCategoryChart, buildFunctionPlot } from "./plot.js";
import { compileFunction } from "./mathVerify.js";

export default function PlotView({ plot }) {
  const [fnSvg, setFnSvg] = useState({ status: "loading", svg: "" });
  const catSvg = useMemo(() => (plot.kind === "function" ? null : buildCategoryChart(plot)), [plot]);

  useEffect(() => {
    if (plot.kind !== "function") return undefined;
    let cancelled = false;
    setFnSvg({ status: "loading", svg: "" });
    (async () => {
      try {
        const fns = [];
        for (const e of plot.expressions) fns.push({ label: e.label, f: await compileFunction(e.expr) });
        const r = buildFunctionPlot(plot, fns);
        if (!cancelled) setFnSvg(r.ok ? { status: "ok", svg: r.svg } : { status: "error", svg: "" });
      } catch (e) {
        if (!cancelled) setFnSvg({ status: "error", svg: "" });
      }
    })();
    return () => { cancelled = true; };
  }, [plot]);

  const result = plot.kind === "function" ? fnSvg : catSvg && catSvg.ok ? { status: "ok", svg: catSvg.svg } : { status: "error", svg: "" };
  return (
    <figure className="sk-figure">
      {result.status === "loading" && <div className="sk-skeleton" role="status">Plotting…</div>}
      {result.status === "ok" && <div className="sk-diagram sk-plot" dangerouslySetInnerHTML={{ __html: result.svg }} />}
      {result.status === "error" && <div className="sk-diagram-fallback" role="note">This graph couldn't be drawn.{plot.caption ? ` It shows: ${plot.caption}` : ""}</div>}
      {plot.caption && result.status !== "error" && <figcaption className="sk-caption">{plot.caption}</figcaption>}
    </figure>
  );
}
