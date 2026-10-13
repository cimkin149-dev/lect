// Welcome / splash screen — shown first on every fresh load of the app.
// Purpose: brand the product (AI-guided learning), say what it does in one glance, show who is behind
// it, and print the exact build version so anyone can confirm they are on the current release.

import React, { useEffect, useRef } from "react";
import { LEGAL, LegalLinks } from "./legal.jsx";
import { logoSvg, BRAND } from "./brand/logo.js";
import { nodeCountFor, makeNodes, stepNodes, edgesFor } from "./brand/network.js";

export const BUILD = {
  version: typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev",
  time: typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : "",
  sha: typeof __BUILD_SHA__ !== "undefined" ? __BUILD_SHA__ : "local",
};

function formatBuildTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
  } catch (e) {
    return iso;
  }
}

// Small version line reused elsewhere (e.g. role screen footer).
export function VersionTag({ style }) {
  return (
    <div style={{ fontSize: 11, color: "#6B7280", ...style }}>
      SEMAI v{BUILD.version} · build {BUILD.sha}
    </div>
  );
}

export function SemaiLogo({ size = 112, animated = false }) {
  return (
    <span
      className={animated ? "sm-logo sm-animated" : "sm-logo"}
      role="img"
      aria-label="SEMAI logo: an open book with a network of lights guiding into it"
      style={{ display: "inline-block", width: size, height: size, lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: logoSvg({ size }) }}
    />
  );
}

// A faint drifting network behind everything. Pauses when the tab is hidden; a single still frame for people
// who prefer reduced motion. Purely decorative (aria-hidden).
function NetworkBackground() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !canvas.getContext) return undefined;
    const ctx = canvas.getContext("2d");
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const COLORS = ["143,211,174", "232,163,61", "224,115,90"];
    let w = 0, h = 0, nodes = [], raf = 0, last = 0, maxDist = 140;

    const size = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      maxDist = Math.max(90, Math.min(160, w / 5));
      nodes = makeNodes(w, h, nodeCountFor(w, h));
    };
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const e of edgesFor(nodes, maxDist)) {
        ctx.strokeStyle = `rgba(143,211,174,${(e.alpha * 0.22).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(nodes[e.a].x, nodes[e.a].y);
        ctx.lineTo(nodes[e.b].x, nodes[e.b].y);
        ctx.stroke();
      }
      for (const n of nodes) {
        ctx.fillStyle = `rgba(${COLORS[n.hue]},0.55)`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    const tick = (t) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 33) return; // ~30 fps is plenty for a background and kind to phone batteries
      stepNodes(nodes, w, h, last ? t - last : 16);
      last = t;
      draw();
    };
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      last = 0;
      if (document.visibilityState === "visible" && !reduce) raf = requestAnimationFrame(tick);
    };
    size();
    draw();
    if (!reduce) raf = requestAnimationFrame(tick);
    window.addEventListener("resize", size);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  return <canvas ref={ref} className="splash-net" aria-hidden="true" />;
}

const FEATURES = [
  {
    title: "Adapts to you",
    text: "Slows down and explains step by step when something is hard, and keeps it short when you already know it.",
    icon: <path d="M12 3a6 6 0 0 0-6 6c0 2.2 1.1 3.7 2.3 4.8.6.6.7 1 .7 1.7V17h6v-1.5c0-.7.1-1.1.7-1.7C16.9 12.7 18 11.2 18 9a6 6 0 0 0-6-6zM9.5 20h5M10.5 22h3" />,
  },
  {
    title: "Ask out loud",
    text: "Raise your hand and ask anything. Your lecturer answers in seconds and tells you honestly when it isn't sure.",
    icon: <path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" />,
  },
  {
    title: "Quizzes and notes",
    text: "Quick questions check you understood. Download full written notes, and practise what needs more work.",
    icon: <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zM9 9h6M9 13h6M9 17h3" />,
  },
];

const STEPS = ["Join a lecture", "Learn with your AI lecturer", "See your progress grow"];

const css = `
.splash { position: relative; min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; align-items: center; background: radial-gradient(1100px 560px at 50% -8%, #2A3547 0%, #12171E 62%); color: #EDEFF2; font-family: 'Inter', system-ui, sans-serif; text-align: center; overflow-x: hidden; overflow-y: auto; }
.splash-net { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.splash > *:not(.splash-net) { position: relative; z-index: 1; }
.splash-band { width: 100%; height: 12px; flex: 0 0 auto; background: repeating-linear-gradient(90deg, #E8A33D 0 28px, #12171E 28px 34px, #C4553A 34px 62px, #12171E 62px 68px, #2F8F5B 68px 96px, #12171E 96px 102px); }
.splash-band.bottom { opacity: 0.85; margin-top: auto; }
.splash-hero { display: flex; flex-direction: column; align-items: center; padding: 34px 22px 8px; max-width: 640px; }
.sm-logo svg { filter: drop-shadow(0 12px 34px rgba(232,163,61,0.32)); }
.splash-logo { animation: splash-rise 0.8s ease both; }
.sm-animated .sm-glow { transform-box: fill-box; transform-origin: center; animation: sm-pulse 2.8s ease-in-out infinite; }
.splash-word { font-family: 'Space Grotesk', sans-serif; font-size: 46px; letter-spacing: 0.16em; font-weight: 700; margin: 16px 0 2px; background: linear-gradient(120deg, #F6C25B, #E8A33D 45%, #8FD3AE); -webkit-background-clip: text; background-clip: text; color: transparent; animation: splash-rise 0.8s 0.08s ease both; }
.splash-tagline { font-family: 'Space Grotesk', sans-serif; font-size: 20px; letter-spacing: 0.06em; color: #F5D9A4; margin: 0 0 12px; animation: splash-rise 0.8s 0.16s ease both; }
.splash-sub { font-size: 15.5px; line-height: 1.6; color: #B6BDC9; margin: 0 0 22px; max-width: 460px; animation: splash-rise 0.8s 0.24s ease both; }
.splash-cta { background: linear-gradient(135deg, #F6C25B, #D9822B); color: #1B1408; border: none; border-radius: 14px; padding: 15px 38px; font-size: 16.5px; font-weight: 700; cursor: pointer; font-family: inherit; box-shadow: 0 10px 28px rgba(217,130,43,0.38); animation: splash-rise 0.8s 0.32s ease both; }
.splash-cta:hover { filter: brightness(1.07); }
.splash-cta:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
.splash-features { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; width: 100%; max-width: 760px; padding: 30px 18px 6px; animation: splash-rise 0.8s 0.4s ease both; }
@media (max-width: 680px) { .splash-features { grid-template-columns: 1fr; max-width: 420px; padding-top: 22px; } }
.splash-card { background: rgba(255,255,255,0.045); border: 1px solid rgba(255,255,255,0.09); backdrop-filter: blur(6px); border-radius: 16px; padding: 16px 16px 15px; text-align: left; }
.splash-card svg { width: 26px; height: 26px; stroke: #E8A33D; fill: none; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; margin-bottom: 8px; }
.splash-card h3 { font-family: 'Space Grotesk', sans-serif; font-size: 15px; margin: 0 0 5px; color: #EDEFF2; }
.splash-card p { font-size: 13px; line-height: 1.55; color: #A9B1BE; margin: 0; }
.splash-steps { display: flex; flex-wrap: wrap; gap: 8px 14px; justify-content: center; padding: 18px 18px 4px; animation: splash-rise 0.8s 0.48s ease both; }
.splash-step { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: #B6BDC9; }
.splash-step b { width: 22px; height: 22px; border-radius: 50%; background: rgba(232,163,61,0.18); border: 1px solid rgba(232,163,61,0.5); color: #F5D9A4; display: grid; place-items: center; font-size: 11.5px; }
.splash-foot { padding: 20px 22px 16px; font-size: 12.5px; line-height: 1.7; color: #8A93A2; }
.splash-foot strong { color: #C7CCD4; font-weight: 600; }
.splash-version { display: inline-block; margin-top: 8px; padding: 4px 12px; border-radius: 8px; background: rgba(47,143,91,0.14); border: 1px solid rgba(47,143,91,0.4); color: #8FD3AE; font-size: 11.5px; font-variant-numeric: tabular-nums; }
@keyframes splash-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes sm-pulse { 0%, 100% { transform: scale(1); opacity: 0.9; } 50% { transform: scale(1.45); opacity: 0.35; } }
@media (prefers-reduced-motion: reduce) { .splash *, .splash { animation: none !important; } }
`;

export default function SplashScreen({ onContinue, onOpenLegal }) {
  const built = formatBuildTime(BUILD.time);
  return (
    <div className="splash">
      <style>{css}</style>
      <NetworkBackground />
      <div className="splash-band" aria-hidden="true" />
      <header className="splash-hero">
        <div className="splash-logo"><SemaiLogo size={116} animated /></div>
        <h1 className="splash-word">{BRAND.name}</h1>
        <p className="splash-tagline">{BRAND.tagline}</p>
        <p className="splash-sub">A personal AI lecturer that teaches, listens, checks you understood, and adapts to the way you learn. Built in Africa, for African classrooms.</p>
        <button className="splash-cta" onClick={onContinue} autoFocus>Start learning →</button>
      </header>
      <section className="splash-features" aria-label="What SEMAI does">
        {FEATURES.map((f) => (
          <div className="splash-card" key={f.title}>
            <svg viewBox="0 0 24 24" aria-hidden="true">{f.icon}</svg>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </div>
        ))}
      </section>
      <ol className="splash-steps" aria-label="How it works" style={{ listStyle: "none", margin: 0 }}>
        {STEPS.map((s, i) => (
          <li className="splash-step" key={s}><b>{i + 1}</b> {s}</li>
        ))}
      </ol>
      <footer className="splash-foot">
        <div><strong>{LEGAL.operatorName}</strong> · Kampala, Uganda</div>
        <div>{LEGAL.contactEmail}</div>
        <div className="splash-version" title="Use this to confirm you are on the latest release">
          Version {BUILD.version} · build {BUILD.sha}{built ? ` · ${built}` : ""}
        </div>
        <LegalLinks onOpen={onOpenLegal} />
      </footer>
      <div className="splash-band bottom" aria-hidden="true" />
    </div>
  );
}
