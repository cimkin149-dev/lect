// Branded, paginated lecture-notes PDF (formulas, worked steps, tables, diagrams,
// plots and numbered code). Kept in its own module so it can be tested outside
// the browser; every visual is best-effort and falls back to text.
import { LANGUAGE_LABELS } from "./schema.js";
import { latexToPlain, toPdfSafe } from "./latex.js";
import { buildFunctionPlot, buildCategoryChart } from "./plot.js";
import { compileFunction } from "./mathVerify.js";
import { svgToPng, diagramToSvgLight } from "./pdfAssets.js";

function addPdfFooter(doc, pageNum) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text(`SEMAI — AI Lecturer  ·  Page ${pageNum}`, pageWidth / 2, pageHeight - 20, { align: "center" });
}

// Branded, paginated lecture-notes PDF. Validated against real multi-page,
// multi-section, code-block content before being wired in here.
export async function buildLectureNotesPdf(curriculum, sections) {
  // Dynamically imported so the ~250KB jsPDF + its optional HTML-rendering
  // plugin only download at the moment someone actually generates a PDF —
  // not as part of the app's initial load, which matters for a PWA meant
  // to start up fast.
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;
  let pageNum = 1;

  doc.setFillColor(20, 24, 28);
  doc.rect(0, 0, pageWidth, 90, "F");
  doc.setTextColor(232, 163, 61);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("SEMAI", margin, 45);
  doc.setTextColor(235, 239, 242);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("AI-Led Lecture Notes", margin, 62);

  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  doc.setFontSize(9);
  doc.setTextColor(200, 204, 212);
  doc.text(dateStr, pageWidth - margin, 45, { align: "right" });

  let y = 125;
  doc.setTextColor(20, 24, 28);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`${curriculum.code} — ${curriculum.title}`, margin, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(90, 90, 90);
  doc.text(curriculum.unit, margin, y);
  y += 35;

  addPdfFooter(doc, pageNum);

  const ensureSpace = (needed) => {
    if (y + needed > pageHeight - 50) {
      doc.addPage();
      pageNum++;
      addPdfFooter(doc, pageNum);
      y = 50;
    }
  };

  for (const [i, section] of sections.entries()) {
    ensureSpace(40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(47, 111, 79);
    const titleLines = doc.splitTextToSize(toPdfSafe(`${i + 1}. ${section.title}`), contentWidth);
    ensureSpace(titleLines.length * 16);
    doc.text(titleLines, margin, y);
    y += titleLines.length * 16 + 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    const bodyLines = doc.splitTextToSize(toPdfSafe(section.explanation), contentWidth);
    bodyLines.forEach((line) => {
      ensureSpace(16);
      doc.text(line, margin, y);
      y += 15;
    });
    y += 8;

    const sl = section.slide;
    const label = (text) => {
      ensureSpace(26);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(47, 111, 79);
      doc.text(text.toUpperCase(), margin, y);
      y += 14;
    };
    const wrapped = (text, o = {}) => {
      const { font = "helvetica", size = 10.5, indent = 0, color = [30, 30, 30], lead = 14 } = o;
      doc.setFont(font, "normal");
      doc.setFontSize(size);
      doc.setTextColor(...color);
      doc.splitTextToSize(toPdfSafe(text), contentWidth - indent).forEach((line) => {
        ensureSpace(lead);
        doc.text(line, margin + indent, y);
        y += lead;
      });
    };
    const picture = async (svgPromise) => {
      try {
        const png = await svgToPng(await svgPromise);
        const w = Math.min(contentWidth, 430, png.w);
        const h = (w * png.h) / png.w;
        ensureSpace(h + 12);
        doc.addImage(png.dataUrl, "PNG", margin, y, w, h);
        y += h + 12;
        return true;
      } catch (e) {
        return false;
      }
    };

    if (sl) {
      if (sl.definition) {
        label("Definition");
        wrapped(`${sl.definition.term}: ${sl.definition.text}`);
        if (sl.definition.example) wrapped(`Example: ${sl.definition.example}`, { color: [90, 90, 90] });
        y += 6;
      }
      if (sl.formulas && sl.formulas.length) {
        label("Key formulas");
        sl.formulas.forEach((f) => wrapped(`${latexToPlain(f.latex)}${f.caption ? `    (${f.caption})` : ""}`, { font: "courier", size: 10 }));
        y += 6;
      }
      if (sl.table) {
        label("Comparison");
        [sl.table.headers, ...sl.table.rows].forEach((r, ri) => wrapped(r.map((c) => latexToPlain(c.replace(/\$/g, ""))).join("  |  "), { font: ri === 0 ? "courier" : "helvetica", size: 9.5, lead: 13 }));
        y += 6;
      }
      if (sl.problem || (sl.steps && sl.steps.length)) {
        label("Worked example");
        if (sl.problem) wrapped(`Problem: ${sl.problem.text.replace(/\$/g, "")}${sl.problem.latex ? "   " + latexToPlain(sl.problem.latex) : ""}`);
        (sl.steps || []).forEach((st, k) => {
          wrapped(`${k + 1}. ${st.label ? st.label + ": " : ""}${st.say}`, { indent: 6 });
          if (st.latex) wrapped(latexToPlain(st.latex), { font: "courier", size: 10, indent: 24, color: [20, 60, 120] });
        });
        if (sl.finalAnswer) wrapped(`Answer: ${sl.finalAnswer.text.replace(/\$/g, "")}${sl.finalAnswer.latex ? "   " + latexToPlain(sl.finalAnswer.latex) : ""}`, { color: [20, 90, 50] });
        y += 6;
      }
      if (sl.diagram) {
        label("Diagram");
        const ok = await picture(diagramToSvgLight(sl.diagram.code));
        if (!ok) wrapped(`(Diagram: ${sl.diagram.caption || "shown in the live session"})`, { color: [120, 120, 120] });
        else if (sl.diagram.caption) wrapped(sl.diagram.caption, { size: 9, color: [110, 110, 110] });
        y += 6;
      }
      if (sl.plot) {
        label("Graph");
        const makeSvg = async () => {
          if (sl.plot.kind === "function") {
            const fns = [];
            for (const e of sl.plot.expressions) fns.push({ label: e.label, f: await compileFunction(e.expr) });
            const r = buildFunctionPlot(sl.plot, fns, { light: true });
            if (!r.ok) throw new Error("empty plot");
            return r.svg;
          }
          const r = buildCategoryChart(sl.plot, { light: true });
          if (!r.ok) throw new Error("empty chart");
          return r.svg;
        };
        const ok = await picture(makeSvg());
        if (!ok) wrapped(`(Graph: ${sl.plot.caption || "shown in the live session"})`, { color: [120, 120, 120] });
        else if (sl.plot.caption) wrapped(sl.plot.caption, { size: 9, color: [110, 110, 110] });
        y += 6;
      }
      if (sl.takeaways && sl.takeaways.length) {
        label("Key takeaways");
        sl.takeaways.forEach((t) => wrapped(`-  ${latexToPlain(t.replace(/\$/g, ""))}`, { indent: 4 }));
        y += 6;
      }
    }

    if (section.code) {
      label(`Code${sl && sl.language ? ` (${LANGUAGE_LABELS[sl.language] || sl.language})` : ""}${sl && sl.filename ? ` - ${sl.filename}` : ""}`);
      doc.setFont("courier", "normal");
      doc.setFontSize(9);
      section.code.split("\n").forEach((line, n) => {
        const pieces = doc.splitTextToSize(toPdfSafe(line).replace(/\t/g, "    ") || " ", contentWidth - 32);
        pieces.forEach((piece, k) => {
          ensureSpace(12);
          doc.setFillColor(245, 245, 245);
          doc.rect(margin, y - 9, contentWidth, 12, "F");
          if (k === 0) {
            doc.setTextColor(150, 150, 150);
            doc.text(String(n + 1), margin + 22, y, { align: "right" });
          }
          doc.setTextColor(40, 40, 40);
          doc.text(piece, margin + 30, y);
          y += 12;
        });
      });
      y += 8;
      if (sl && sl.expectedOutput) {
        label("Expected output");
        wrapped(sl.expectedOutput, { font: "courier", size: 9, lead: 12 });
      }
      y += 10;
    } else {
      y += 10;
    }
  }

  return doc;
}

