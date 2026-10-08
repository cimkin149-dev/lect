// Welcome / splash screen — shown first on every fresh load of the app.
// Purpose: brand the product, show who is behind it, and print the exact build
// version so anyone can confirm they are looking at the current release and
// not a stale cached copy of the PWA.

import React from "react";
import { LEGAL, LegalLinks } from "./legal.jsx";

export const BUILD = {
  version: typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev",
  time: typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : "",
  sha: typeof __BUILD_SHA__ !== "undefined" ? __BUILD_SHA__ : "local",
};

function formatBuildTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
    }) + " UTC";
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

export function SemaiLogo({ size = 112 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="SEMAI logo" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="semai-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F2B84B" />
          <stop offset="1" stopColor="#D9822B" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="112" height="112" rx="28" fill="#1B2128" stroke="url(#semai-g)" strokeWidth="3" />
      {/* inner kente-style diamond band */}
      <g opacity="0.22" fill="none" stroke="#E8A33D" strokeWidth="1.5">
        <path d="M60 14 L106 60 L60 106 L14 60 Z" />
        <path d="M60 26 L94 60 L60 94 L26 60 Z" />
      </g>
      {/* stylised S: two arcs, like a speech bubble becoming a book */}
      <path d="M78 42 C78 33 69 29 60 29 C49 29 41 34 41 43 C41 52 49 55 60 58 C71 61 79 65 79 76 C79 86 70 92 59 92 C48 92 40 87 39 77"
        fill="none" stroke="url(#semai-g)" strokeWidth="9" strokeLinecap="round" />
      <circle cx="88" cy="30" r="6" fill="#2F8F5B" />
      <circle cx="32" cy="90" r="5" fill="#C4553A" />
    </svg>
  );
}

const css = `
.splash { min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; align-items: center; justify-content: space-between; background: radial-gradient(1200px 600px at 50% -10%, #263041 0%, #14181C 60%); color: #EDEFF2; font-family: 'Inter', system-ui, sans-serif; text-align: center; overflow: hidden; }
.splash-band { width: 100%; height: 14px; flex: 0 0 auto; background:
  repeating-linear-gradient(90deg, #E8A33D 0 28px, #14181C 28px 34px, #C4553A 34px 62px, #14181C 62px 68px, #2F8F5B 68px 96px, #14181C 96px 102px); }
.splash-band.bottom { opacity: 0.85; }
.splash-main { flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 28px 22px; max-width: 560px; }
.splash-logo { animation: splash-rise 0.7s ease both; filter: drop-shadow(0 10px 30px rgba(232,163,61,0.25)); }
.splash-word { font-family: 'Space Grotesk', sans-serif; font-size: 44px; letter-spacing: 0.14em; font-weight: 700; margin: 18px 0 4px; animation: splash-rise 0.7s 0.1s ease both; }
.splash-tag { font-size: 15px; line-height: 1.55; color: #AEB5C2; margin: 0 0 20px; animation: splash-rise 0.7s 0.2s ease both; }
.splash-chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-bottom: 26px; animation: splash-rise 0.7s 0.3s ease both; }
.splash-chip { font-size: 12px; padding: 6px 12px; border-radius: 999px; border: 1px solid #343D4A; background: rgba(255,255,255,0.03); color: #C7CCD4; }
.splash-cta { background: linear-gradient(135deg, #F2B84B, #D9822B); color: #1B1408; border: none; border-radius: 12px; padding: 14px 34px; font-size: 16px; font-weight: 700; cursor: pointer; font-family: inherit; box-shadow: 0 8px 24px rgba(217,130,43,0.35); animation: splash-rise 0.7s 0.4s ease both; }
.splash-cta:hover { filter: brightness(1.06); }
.splash-cta:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
.splash-foot { padding: 4px 22px 18px; font-size: 12.5px; line-height: 1.7; color: #8890A0; animation: splash-rise 0.7s 0.5s ease both; }
.splash-foot strong { color: #C7CCD4; font-weight: 600; }
.splash-version { display: inline-block; margin-top: 8px; padding: 4px 12px; border-radius: 8px; background: rgba(47,143,91,0.14); border: 1px solid rgba(47,143,91,0.4); color: #8FD3AE; font-size: 11.5px; font-variant-numeric: tabular-nums; }
@keyframes splash-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .splash *, .splash { animation: none !important; } }
`;

export default function SplashScreen({ onContinue, onOpenLegal }) {
  const built = formatBuildTime(BUILD.time);
  return (
    <div className="splash">
      <style>{css}</style>
      <div className="splash-band" aria-hidden="true" />
      <div className="splash-main">
        <div className="splash-logo"><SemaiLogo /></div>
        <h1 className="splash-word">SEMAI</h1>
        <p className="splash-tag">
          Your AI lecturer — live, patient and always ready for your questions. Built in Africa, for African classrooms.
        </p>
        <div className="splash-chips" aria-label="What SEMAI does">
          <span className="splash-chip">🎓 Live AI-led lectures</span>
          <span className="splash-chip">🎙️ Ask questions by voice</span>
          <span className="splash-chip">📝 Download your lecture notes</span>
        </div>
        <button className="splash-cta" onClick={onContinue} autoFocus>Get started →</button>
      </div>
      <div className="splash-foot">
        <div><strong>{LEGAL.operatorName}</strong> · Kampala, Uganda</div>
        <div>{LEGAL.contactEmail}</div>
        <div className="splash-version" title="Use this to confirm you are on the latest release">
          Version {BUILD.version} · build {BUILD.sha}{built ? ` · ${built}` : ""}
        </div>
        <LegalLinks onOpen={onOpenLegal} />
      </div>
      <div className="splash-band bottom" aria-hidden="true" />
    </div>
  );
}
