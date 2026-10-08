// Deterministic SVG plots (function graphs, bar and line charts). Pure string
// output, no DOM needed — so it is unit-testable and works in notes export too.

const PALETTE = ["#E8A33D", "#4FB286", "#E0735A", "#6BA7E8", "#B18AE0", "#D6C94A"];
const W = 640, H = 360, PAD = { l: 52, r: 18, t: 18, b: 40 };
const DARK = { grid: "#2A313C", tick: "#8890A0", axis: "#8890A0", legend: "#C7CCD4", bg: "" };
const LIGHT = { grid: "#E3E6EA", tick: "#555555", axis: "#444444", legend: "#222222", bg: "#FFFFFF" };
const theme = (opts) => (opts && opts.light ? LIGHT : DARK);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function niceStep(range, target = 6) {
  const raw = range / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const nice = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return nice * mag;
}
function ticks(min, max) {
  const step = niceStep(max - min);
  const start = Math.ceil(min / step) * step;
  const out = [];
  for (let v = start; v <= max + step * 1e-6; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : +v.toFixed(10));
  return out;
}
const fmt = (v) => (Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(1) : String(+v.toFixed(4)));

function frame(inner, title, T) {
  const bg = T.bg ? `<rect width="${W}" height="${H}" fill="${T.bg}"/>` : "";
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(title || "Chart")}" font-family="Helvetica, Arial, sans-serif">${bg}${inner}</svg>`;
}

function legend(items, T) {
  if (items.length < 2) return "";
  return items.map((it, i) => `<g transform="translate(${PAD.l + 8 + i * 130},${PAD.t + 6})"><rect width="12" height="3" y="5" fill="${PALETTE[i % PALETTE.length]}"/><text x="18" y="10" fill="${T.legend}" font-size="11">${esc(it)}</text></g>`).join("");
}

// spec: { kind:"function", xMin, xMax, yMin?, yMax? }, fns: [{label, f}]
export function buildFunctionPlot(spec, fns, opts) {
  const T = theme(opts);
  const xMin = Number.isFinite(+spec.xMin) ? +spec.xMin : -10;
  let xMax = Number.isFinite(+spec.xMax) ? +spec.xMax : 10;
  if (xMax <= xMin) xMax = xMin + 1;
  const N = 300;
  const series = fns.map((fn) => {
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const x = xMin + ((xMax - xMin) * i) / N;
      const y = fn.f(x);
      pts.push([x, Number.isFinite(y) && Math.abs(y) < 1e9 ? y : NaN]);
    }
    return { label: fn.label, pts };
  });
  const ys = series.flatMap((s) => s.pts.map((p) => p[1])).filter(Number.isFinite);
  if (ys.length < 2) return { ok: false, svg: "" };
  let yMin = Number.isFinite(+spec.yMin) && spec.yMin !== null && spec.yMin !== "" ? +spec.yMin : Math.min(...ys);
  let yMax = Number.isFinite(+spec.yMax) && spec.yMax !== null && spec.yMax !== "" ? +spec.yMax : Math.max(...ys);
  if (yMax - yMin < 1e-9) { yMin -= 1; yMax += 1; }
  const padY = (yMax - yMin) * 0.06;
  yMin -= padY; yMax += padY;
  const px = (x) => PAD.l + ((x - xMin) / (xMax - xMin)) * (W - PAD.l - PAD.r);
  const py = (y) => H - PAD.b - ((y - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);
  let g = "";
  for (const t of ticks(xMin, xMax)) g += `<line x1="${px(t)}" y1="${PAD.t}" x2="${px(t)}" y2="${H - PAD.b}" stroke="${T.grid}"/><text x="${px(t)}" y="${H - PAD.b + 16}" fill="${T.tick}" font-size="11" text-anchor="middle">${fmt(t)}</text>`;
  for (const t of ticks(yMin, yMax)) g += `<line x1="${PAD.l}" y1="${py(t)}" x2="${W - PAD.r}" y2="${py(t)}" stroke="${T.grid}"/><text x="${PAD.l - 8}" y="${py(t) + 4}" fill="${T.tick}" font-size="11" text-anchor="end">${fmt(t)}</text>`;
  const axes =
    (yMin < 0 && yMax > 0 ? `<line x1="${PAD.l}" y1="${py(0)}" x2="${W - PAD.r}" y2="${py(0)}" stroke="${T.axis}" stroke-width="1.4"/>` : "") +
    (xMin < 0 && xMax > 0 ? `<line x1="${px(0)}" y1="${PAD.t}" x2="${px(0)}" y2="${H - PAD.b}" stroke="${T.axis}" stroke-width="1.4"/>` : "");
  let paths = "";
  series.forEach((s, si) => {
    let d = "", pen = false, prev = null;
    for (const [x, y] of s.pts) {
      if (!Number.isFinite(y)) { pen = false; prev = null; continue; }
      // break the line across steep jumps (asymptotes like tan x, 1/x)
      if (prev !== null && Math.abs(y - prev) > (yMax - yMin) * 0.8) pen = false;
      d += `${pen ? "L" : "M"}${px(x).toFixed(1)} ${Math.max(PAD.t - 4, Math.min(H - PAD.b + 4, py(y))).toFixed(1)} `;
      pen = true; prev = y;
    }
    paths += `<path d="${d}" fill="none" stroke="${PALETTE[si % PALETTE.length]}" stroke-width="2.4" stroke-linejoin="round"/>`;
  });
  return { ok: true, svg: frame(g + axes + paths + legend(series.map((s) => s.label || ""), T), "Function plot", T) };
}

// spec: { kind:"bar"|"line", labels:[...], series:[{name, values:[...]}] }
export function buildCategoryChart(spec, opts) {
  const T = theme(opts);
  const labels = (spec.labels || []).map(String);
  const series = (spec.series || []).filter((s) => Array.isArray(s.values)).map((s) => ({ name: String(s.name || ""), values: s.values.map((v) => (Number.isFinite(+v) ? +v : 0)) }));
  if (!labels.length || !series.length) return { ok: false, svg: "" };
  const all = series.flatMap((s) => s.values);
  let yMin = Math.min(0, ...all), yMax = Math.max(0, ...all);
  if (yMax - yMin < 1e-9) yMax = yMin + 1;
  yMax += (yMax - yMin) * 0.08;
  const px0 = PAD.l, px1 = W - PAD.r;
  const py = (y) => H - PAD.b - ((y - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);
  const band = (px1 - px0) / labels.length;
  let g = "";
  for (const t of ticks(yMin, yMax)) g += `<line x1="${PAD.l}" y1="${py(t)}" x2="${px1}" y2="${py(t)}" stroke="${T.grid}"/><text x="${PAD.l - 8}" y="${py(t) + 4}" fill="${T.tick}" font-size="11" text-anchor="end">${fmt(t)}</text>`;
  labels.forEach((l, i) => { g += `<text x="${px0 + band * (i + 0.5)}" y="${H - PAD.b + 16}" fill="${T.tick}" font-size="11" text-anchor="middle">${esc(l.length > 14 ? l.slice(0, 13) + "…" : l)}</text>`; });
  g += `<line x1="${PAD.l}" y1="${py(0)}" x2="${px1}" y2="${py(0)}" stroke="${T.axis}" stroke-width="1.2"/>`;
  if (spec.kind === "line") {
    series.forEach((s, si) => {
      const pts = s.values.slice(0, labels.length).map((v, i) => `${(px0 + band * (i + 0.5)).toFixed(1)},${py(v).toFixed(1)}`);
      g += `<polyline points="${pts.join(" ")}" fill="none" stroke="${PALETTE[si % PALETTE.length]}" stroke-width="2.4"/>`;
      pts.forEach((p) => { const [x, y] = p.split(","); g += `<circle cx="${x}" cy="${y}" r="3.6" fill="${PALETTE[si % PALETTE.length]}"/>`; });
    });
  } else {
    const bw = (band * 0.7) / series.length;
    series.forEach((s, si) => s.values.slice(0, labels.length).forEach((v, i) => {
      const x = px0 + band * i + band * 0.15 + bw * si;
      const y = Math.min(py(v), py(0));
      g += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.abs(py(v) - py(0)).toFixed(1)}" rx="2" fill="${PALETTE[si % PALETTE.length]}"/>`;
    }));
  }
  return { ok: true, svg: frame(g + legend(series.map((s) => s.name), T), "Chart", T) };
}
