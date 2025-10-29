// /api/og.js
// Dynamic SVG for Farcaster Frame using Gemini odds + rationale
export const config = { runtime: "edge" };

export default async function handler(req) {
  const url = new URL(req.url);
  const title = url.searchParams.get("title") || "AL vs T1 – Who advances?";
  const sideA = url.searchParams.get("sideA") || "AL";
  const sideB = url.searchParams.get("sideB") || "T1";

  // Fetch Gemini results from our server-side agent
  let prob = 50;
  let rationale = "No rationale.";
  try {
    const agents = await fetch(`${req.nextUrl.origin}/api/agents?title=${encodeURIComponent(title)}&sideA=${encodeURIComponent(sideA)}&sideB=${encodeURIComponent(sideB)}`, { cache: "no-store" });
    const data = await agents.json();
    if (data?.gem?.prob != null) prob = clamp(data.gem.prob);
    if (data?.gem?.rationale) rationale = clip(data.gem.rationale, 220);
  } catch {}

  // Render
  const W = 1200, H = 630, P = 64;
  const barW = 900, barH = 40, filled = Math.round((prob / 100) * barW);

  const svg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b0d14"/>
      <stop offset="100%" stop-color="#121527"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <text x="${P}" y="110" font-size="44" fill="#EDEFF5" font-family="Inter, system-ui, -apple-system, Roboto" font-weight="600">
    ${escapeXML(title)}
  </text>

  <text x="${P}" y="170" font-size="28" fill="#8fa3d8" font-family="Inter, system-ui, -apple-system, Roboto">${escapeXML(sideA)}</text>
  <text x="${W - P}" y="170" font-size="28" fill="#f18aa8" font-family="Inter, system-ui, -apple-system, Roboto" text-anchor="end">${escapeXML(sideB)}</text>

  <rect x="${P}" y="200" width="${barW}" height="${barH}" rx="10" fill="#1a1f2e"/>
  <rect x="${P}" y="200" width="${filled}" height="${barH}" rx="10" fill="#7aa2ff"/>

  <text x="${P + barW/2}" y="260" font-size="26" fill="#EDEFF5" font-family="Inter, system-ui, -apple-system, Roboto" text-anchor="middle">
    Gemini: ${prob}% ${escapeXML(sideA)} (NFA)
  </text>

  <foreignObject x="${P}" y="300" width="${W - 2*P}" height="200">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Inter, system-ui, -apple-system, Roboto; color:#C9CEDA; font-size:22px; line-height:1.35;">
      ${escapeXML(rationale)}
    </div>
  </foreignObject>

  <text x="${P}" y="${H - 36}" font-size="18" fill="#8a90a4" font-family="Inter, system-ui, -apple-system, Roboto">
    Source: Gemini 1.5 Flash • Updated on request • NFA
  </text>
</svg>
`;

  return new Response(svg, { headers: { "Content-Type": "image/svg+xml" } });
}

function clamp(n){ n = Math.round(n); return Math.max(0, Math.min(100, n)); }
function clip(s, n){ s = String(s).replace(/\s+/g, " ").trim(); return s.length <= n ? s : s.slice(0, n - 1) + "…"; }
function escapeXML(s){ return String(s).replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'})[c]); }
