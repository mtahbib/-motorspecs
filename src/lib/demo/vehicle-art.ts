/**
 * Placeholder "photos" for seeded demo vehicles, drawn as SVG so the demo needs
 * no third-party images. Every image is watermarked DEMO PHOTO.
 */

type Shape = { body: string; windows: string; wheels: number[]; r: number; extra?: string };

const shapes: Record<string, Shape> = {
  sedan: {
    body: "M60,332 L78,300 Q110,288 200,284 L272,232 Q300,216 360,213 L482,213 Q530,216 572,246 L622,280 Q704,288 732,306 L740,340 L60,340 Z",
    windows: "M292,240 Q312,226 360,224 L420,224 L420,280 L240,282 Z M432,224 L480,224 Q520,226 552,250 L580,278 L432,280 Z",
    wheels: [192, 612],
    r: 44,
  },
  hatchback: {
    body: "M82,336 L92,300 Q108,280 150,270 L222,216 Q244,204 302,203 L470,203 Q512,206 548,242 L588,276 Q684,286 716,306 L722,340 L82,340 Z",
    windows: "M236,226 Q258,214 302,213 L380,213 L380,272 L180,274 Z M392,213 L468,213 Q500,216 528,244 L556,272 L392,272 Z",
    wheels: [182, 594],
    r: 42,
  },
  wagon: {
    body: "M58,336 L66,292 Q76,214 122,205 L472,205 Q518,208 558,242 L602,276 Q702,286 732,306 L740,340 L58,340 Z",
    windows: "M110,218 L262,216 L262,272 L100,274 Z M274,216 L410,216 L410,272 L274,272 Z M422,216 L470,216 Q504,219 536,246 L562,272 L422,272 Z",
    wheels: [184, 616],
    r: 44,
  },
  suv: {
    body: "M58,336 L60,272 Q64,182 112,172 L474,172 Q522,176 562,226 L602,262 Q706,272 736,296 L744,340 L58,340 Z",
    windows: "M104,186 L256,184 L256,248 L92,250 Z M268,184 L410,184 L410,248 L268,248 Z M422,184 L470,184 Q506,188 536,226 L556,248 L422,248 Z",
    wheels: [188, 618],
    r: 52,
  },
  van: {
    body: "M58,340 L58,188 Q60,150 100,148 L562,148 Q612,152 652,202 L702,252 Q736,264 742,302 L744,340 Z",
    windows: "M78,166 L200,166 L200,226 L78,226 Z M214,166 L380,166 L380,226 L214,226 Z M394,166 L560,166 Q596,170 626,206 L642,226 L394,226 Z",
    wheels: [172, 612],
    r: 46,
    extra: "M380,236 L380,330",
  },
  minivan: {
    body: "M58,340 L60,198 Q64,160 110,156 L522,156 Q582,160 632,220 L692,262 Q736,274 742,306 L744,340 Z",
    windows: "M82,174 L240,172 L240,236 L80,236 Z M254,172 L420,172 L420,236 L254,236 Z M434,172 L520,172 Q566,176 604,222 L614,236 L434,236 Z",
    wheels: [178, 614],
    r: 46,
    extra: "M420,244 L420,328",
  },
  pickup: {
    body: "M48,336 L48,262 L328,262 L334,202 Q344,180 380,178 L522,178 Q562,182 592,228 L622,262 Q716,270 744,300 L746,340 L48,340 Z",
    windows: "M352,194 Q360,190 384,190 L450,190 L450,250 L346,252 Z M462,190 L520,190 Q550,194 572,230 L584,250 L462,250 Z",
    wheels: [172, 622],
    r: 50,
    extra: "M48,262 L328,262 M60,276 L316,276",
  },
  truck: {
    body: "M468,340 L468,164 Q474,150 500,150 L640,150 Q690,152 706,200 L722,260 L726,340 Z M36,254 L462,254 L462,290 L36,290 Z M36,300 L468,300 L468,326 L36,326 Z",
    windows: "M488,168 L632,168 Q668,170 684,210 L692,236 L488,236 Z",
    wheels: [150, 380, 642],
    r: 40,
  },
  machinery: {
    body: "M130,300 L640,300 Q690,300 690,330 Q690,360 640,360 L130,360 Q80,360 80,330 Q80,300 130,300 Z M220,300 L220,190 Q222,168 250,168 L400,168 Q420,170 426,190 L440,300 Z M420,210 L600,120 L640,150 L470,250 Z M600,120 L700,210 L676,226 L590,150 Z",
    windows: "M240,184 L390,184 L404,250 L240,250 Z",
    wheels: [],
    r: 0,
    extra: "M676,226 Q720,250 700,290 L650,270 Z",
  },
};
shapes.coupe = shapes.sedan;
shapes.convertible = shapes.sedan;
shapes.bus = shapes.van;

function shade(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const adj = (c: number) => Math.max(0, Math.min(255, Math.round(c + amount * 255)));
  const r = adj((n >> 16) & 255);
  const g = adj((n >> 8) & 255);
  const b = adj(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function luminance(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

function esc(s: string) {
  return s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] ?? c);
}

export function renderVehicleArt(opts: { body: string; color: string; ref: string; view: number; label?: string }): string {
  const shape = shapes[opts.body] ?? shapes.sedan;
  const color = opts.color || "#9aa0a6";
  const dark = shade(color, -0.22);
  const light = shade(color, 0.18);
  const glass = luminance(color) < 0.25 ? "#3a4757" : "#1f2a36";
  const view = ((opts.view - 1) % 4) + 1;
  const backgrounds = [
    ["#e9edf2", "#c9d1db"],
    ["#1b2330", "#0e131b"],
    ["#eef1ec", "#d3d8cf"],
    ["#f1ede8", "#d9d1c7"],
  ];
  const [bg1, bg2] = backgrounds[view - 1];
  const onDark = view === 2;
  const viewBox = view === 4 ? "380 120 400 260" : "0 0 800 500";
  const flip = view === 2 ? `transform="translate(800,0) scale(-1,1)"` : "";

  const wheels = shape.wheels
    .map(
      (x) => `
      <g>
        <circle cx="${x}" cy="${340}" r="${shape.r}" fill="#15181d"/>
        <circle cx="${x}" cy="${340}" r="${shape.r * 0.62}" fill="#8f969e"/>
        <circle cx="${x}" cy="${340}" r="${shape.r * 0.5}" fill="#c3c8cd"/>
        ${[0, 72, 144, 216, 288]
          .map((a) => {
            const rad = (a * Math.PI) / 180;
            return `<line x1="${x}" y1="340" x2="${(x + Math.cos(rad) * shape.r * 0.48).toFixed(1)}" y2="${(340 + Math.sin(rad) * shape.r * 0.48).toFixed(1)}" stroke="#7b828a" stroke-width="${(shape.r * 0.12).toFixed(1)}" stroke-linecap="round"/>`;
          })
          .join("")}
        <circle cx="${x}" cy="${340}" r="${shape.r * 0.14}" fill="#5b6168"/>
      </g>`,
    )
    .join("");

  const tracks =
    opts.body === "machinery"
      ? [140, 250, 360, 470, 580].map((x) => `<circle cx="${x}" cy="330" r="18" fill="#2b2f35"/>`).join("")
      : "";

  const interior =
    view === 3
      ? `
      <rect x="0" y="0" width="800" height="500" fill="url(#bg)"/>
      <path d="M0,300 Q400,220 800,300 L800,500 L0,500 Z" fill="#23272e"/>
      <path d="M0,300 Q400,220 800,300 L800,330 Q400,250 0,330 Z" fill="${dark}" opacity="0.8"/>
      <rect x="470" y="250" width="200" height="70" rx="12" fill="#0f1216"/>
      <rect x="484" y="262" width="172" height="46" rx="6" fill="#1d3b8f" opacity="0.9"/>
      <circle cx="270" cy="330" r="118" fill="none" stroke="#111418" stroke-width="26"/>
      <circle cx="270" cy="330" r="34" fill="#111418"/>
      <path d="M180,300 L236,322 M304,322 L360,300 M270,364 L270,440" stroke="#111418" stroke-width="22" stroke-linecap="round"/>
      <circle cx="270" cy="330" r="12" fill="#003ffd"/>`
      : "";

  const vehicle =
    view === 3
      ? ""
      : `
      <ellipse cx="400" cy="${388}" rx="360" ry="20" fill="#000" opacity="${onDark ? 0.5 : 0.18}"/>
      <g ${flip}>
        <path d="${shape.body}" fill="url(#paint)" stroke="${dark}" stroke-width="2"/>
        <path d="${shape.windows}" fill="${glass}" opacity="0.92"/>
        ${shape.extra ? `<path d="${shape.extra}" stroke="${dark}" stroke-width="3" fill="${opts.body === "machinery" ? dark : "none"}"/>` : ""}
        ${tracks}
        ${wheels}
      </g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="800" height="500" role="img" aria-label="${esc(opts.label ?? `Demo photo ${opts.ref}`)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient>
    <linearGradient id="paint" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="0.55" stop-color="${color}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
  </defs>
  <rect x="-400" y="-100" width="1600" height="800" fill="url(#bg)"/>
  ${view !== 3 ? `<path d="M-400,388 L1200,388" stroke="${onDark ? "#2c3645" : "#b4bdc8"}" stroke-width="1"/>` : ""}
  ${interior}
  ${vehicle}
  <g font-family="Arial, Helvetica, sans-serif" font-weight="700">
    <rect x="${view === 4 ? 392 : 16}" y="${view === 4 ? 338 : 454}" width="176" height="30" rx="4" fill="#003ffd" opacity="0.92"/>
    <text x="${view === 4 ? 404 : 28}" y="${view === 4 ? 358 : 474}" font-size="15" fill="#fff" letter-spacing="1.5">DEMO PHOTO · ${esc(opts.ref)}</text>
  </g>
</svg>`;
}

export function renderSheetArt(opts: { ref: string; title: string; grade?: string | null; kind: "inspection" | "auction" }): string {
  const heading = opts.kind === "inspection" ? "INSPECTION SHEET" : "AUCTION SHEET";
  const cells = Array.from({ length: 6 }, (_, i) => `<rect x="${60 + (i % 3) * 230}" y="${150 + Math.floor(i / 3) * 60}" width="210" height="44" fill="none" stroke="#9aa3ad"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
  <rect width="800" height="1000" fill="#fbfaf6"/>
  <rect x="30" y="30" width="740" height="940" fill="none" stroke="#2a2f36" stroke-width="2"/>
  <g font-family="Arial, Helvetica, sans-serif" fill="#1d2127">
    <text x="60" y="90" font-size="34" font-weight="700">${heading}</text>
    <text x="60" y="124" font-size="18">${esc(opts.title)} — ${esc(opts.ref)}</text>
    ${cells}
    <text x="72" y="178" font-size="14">Grade</text><text x="72" y="195" font-size="16" font-weight="700">${esc(opts.grade ?? "—")}</text>
    <text x="302" y="178" font-size="14">Exterior</text><text x="302" y="195" font-size="16" font-weight="700">B</text>
    <text x="532" y="178" font-size="14">Interior</text><text x="532" y="195" font-size="16" font-weight="700">B</text>
    <rect x="160" y="320" width="480" height="560" rx="120" fill="none" stroke="#2a2f36" stroke-width="3"/>
    <rect x="230" y="420" width="340" height="120" rx="20" fill="none" stroke="#2a2f36" stroke-width="2"/>
    <rect x="230" y="660" width="340" height="120" rx="20" fill="none" stroke="#2a2f36" stroke-width="2"/>
    <text x="300" y="400" font-size="18" fill="#c0392b">A1</text><text x="520" y="620" font-size="18" fill="#c0392b">U1</text>
  </g>
  <g transform="rotate(-24 400 520)"><text x="400" y="540" text-anchor="middle" font-family="Arial" font-size="92" font-weight="700" fill="#003ffd" opacity="0.14">DEMO ONLY</text></g>
</svg>`;
}
