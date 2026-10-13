// SEMAI brand mark: an open book (learning) with a small network of nodes feeding a single bright
// "guide" node into its spine (AI guiding the learner). Palette nods to the product's African-first
// identity: amber, green and terracotta on deep ink. One source of truth: the splash screen, the
// favicon and every PWA icon are generated from these strings.

const DEFS = `<defs>
<linearGradient id="smGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F6C25B"/><stop offset="1" stop-color="#D9822B"/></linearGradient>
<linearGradient id="smBook" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD98A"/><stop offset="1" stop-color="#E0902F"/></linearGradient>
<radialGradient id="smInk" cx="50%" cy="28%" r="75%"><stop offset="0" stop-color="#2B3646"/><stop offset="1" stop-color="#11161C"/></radialGradient>
</defs>`;

const ART = `
<g stroke="#8FD3AE" stroke-opacity="0.8" stroke-width="2" stroke-linecap="round" fill="none">
<line x1="60" y1="27" x2="39" y2="40"/><line x1="60" y1="27" x2="81" y2="40"/>
<line x1="39" y1="40" x2="29" y2="53"/><line x1="81" y1="40" x2="91" y2="53"/>
<line x1="39" y1="40" x2="81" y2="40" stroke-opacity="0.35"/>
</g>
<line x1="60" y1="34" x2="60" y2="64" stroke="#F6C25B" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="0.1 5.2"/>
<path d="M60 91 C48 83 34 81 20 83 L20 57 C34 55 48 59 60 67 Z" fill="url(#smBook)"/>
<path d="M60 91 C72 83 86 81 100 83 L100 57 C86 55 72 59 60 67 Z" fill="url(#smBook)" fill-opacity="0.9"/>
<path d="M60 67 L60 91" stroke="#11161C" stroke-width="2.2" stroke-linecap="round"/>
<path d="M27 63 C37 62 46 65 54 70 M27 71 C37 70 46 73 54 78 M93 63 C83 62 74 65 66 70 M93 71 C83 70 74 73 66 78" stroke="#11161C" stroke-opacity="0.22" stroke-width="1.6" stroke-linecap="round" fill="none"/>
<circle class="sm-glow" cx="60" cy="27" r="11" fill="#FFE7B0" fill-opacity="0.22"/>
<circle cx="60" cy="27" r="6.2" fill="#FFE7B0"/>
<path d="M60 20 L61.6 25.4 L67 27 L61.6 28.6 L60 34 L58.4 28.6 L53 27 L58.4 25.4 Z" fill="#FFFFFF" fill-opacity="0.9"/>
<circle cx="39" cy="40" r="4.2" fill="#8FD3AE"/><circle cx="81" cy="40" r="4.2" fill="#F6C25B"/>
<circle cx="29" cy="53" r="3.2" fill="#E0735A"/><circle cx="91" cy="53" r="3.2" fill="#8FD3AE"/>`;

export function logoSvg({ size = 120, badge = true } = {}) {
  const frame = badge ? `<rect x="4" y="4" width="112" height="112" rx="28" fill="url(#smInk)" stroke="url(#smGold)" stroke-width="3"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true" focusable="false">${DEFS}${frame}${ART}</svg>`;
}

// Full-bleed square with the mark inside the "safe zone", for maskable PWA icons (the OS crops it to a circle/squircle).
export function maskableSvg(size = 512) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 120 120">${DEFS}<rect width="120" height="120" fill="#11161C"/><g transform="translate(60 60) scale(0.7) translate(-60 -53.5)">${ART}</g></svg>`;
}

export const BRAND = { name: "SEMAI", tagline: "AI-guided learning", ink: "#11161C", amber: "#E8A33D", green: "#8FD3AE", terracotta: "#E0735A" };
