// /api/og.js
export const config = { runtime: "edge" };

export default async function handler(req) {
  const u = new URL(req.url);

  const title   = u.searchParams.get("title")   || "Who wins?";
  const ask     = u.searchParams.get("ask")     || "Which outcome is more likely?";
  const choices = u.searchParams.get("choices") || "Yes|No";
  const img     = u.searchParams.get("img")     || "";
  const year    = u.searchParams.get("year")    || "2025";
  const context = u.searchParams.get("context") || "";

  // Build the agents URL using the origin from the request URL
  const agentsURL =
    `${u.origin}/api/agents` +
    `?ask=${encodeURIComponent(ask)}` +
    `&choices=${encodeURIComponent(choices)}` +
    `&year=${encodeURIComponent(year)}` +
    `&context=${encodeURIComponent(context)}` +
    `&ts=${Date.now()}`;

  let left = "Yes", right = "No", prob = 50, rationale = "NFA";
  try {
    const r = await fetch(agentsURL, { cache: "no-store" });
    const j = await r.json();
    if (j?.left) left = j.left;
    if (j?.right) right = j.right;
    if (j?.gem?.prob != null) prob = clamp(j.gem.prob);
    if (j?.gem?.rationale) rationale = j.gem.rationale;
  } catch {}

  const W = 1200, H = 630, R = 28, P = 28;
  const trackW = W - P*2, trackY = 330, trackH = 18;
  const filled = Math.round(trackW * (prob / 100));
  const percentLeft = `${prob}%`, percentRight = `${100 - prob}%`;

  const svg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0f1222"/>
      <stop offset="100%" stop-color="#0a0d18"/>
    </linearGradient>
    <linearGradient id="fillL" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#7ad0a6"/>
      <stop offset="100%" stop-color="#88e6b5"/>
    </linearGradient>
    <linearGradient id="track" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#20263a"/>
      <stop offset="100%" stop-color="#242b42"/>
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="${W}" height="${H}" rx="${R}" fill="url(#bg)"/>

  ${img ? `
    <clipPath id="heroClip"><rect x="${P}" y="${P}" width="${W - 2*P}" height="180" rx="18"/></clipPath>
    <image href="${escapeXML(img)}" x="${P}" y="${P}" width="${W - 2*P}" height="180" preserveAspectRatio="xMidYMid slice" clip-path="url(#heroClip)"/>
  ` : ''}

  <text x="${P}" y="${img ? 240 : 120}" font-size="34" fill="#E9EDF7" font-family="Inter, system-ui, -apple-system, Roboto" font-weight="600">
    ${escapeXML(title)}
  </text>

  <rect x="${P}" y="${trackY}" width="${trackW}" height="${trackH}" rx="${trackH/2}" fill="url(#track)"/>
  <rect x="${P}" y="${trackY}" width="${filled}" height="${trackH}" rx="${trackH/2}" fill="url(#fillL)"/>

  <text x="${P}" y="${trackY - 10}" fill="#A7B1CA" font-size="22" font-family="Inter, system-ui" dominant-baseline="ideographic">${percentLeft}</text>
  <text x="${W - P}" y="${trackY - 10}" fill="#A7B1CA" font-size="22" font-family="Inter, system-ui" text-anchor="end" dominant-baseline="ideographic">${percentRight}</text>

  ${pill(P, trackY + 38, 220, 46, left, true)}
  ${pill(P + 240, trackY + 38, 220, 46, right, false)}

  <foreignObject x="${P}" y="${trackY + 100}" width="${W - 2*P}" height="140">
    <div xmlns="http://www.w3.org/1999/xhtml"
         style="font-family: Inter, system-ui, -apple-system, Roboto; color:#bec6dc; font-size:22px; line-height:1.35;">
      ${escapeXML(rationale)}
    </div>
  </foreignObject>

  <text x="${P}" y="${H - 24}" font-size="18" fill="#7983a3" font-family="Inter, system-ui">Source: Gemini 2.5 Flash • Updated on request • NFA</text>
</svg>
`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml" } });
}

function pill(x, y, w, h, label, primary) {
  const bg = primary ? "#16302a" : "#2a2330";
  const fg = primary ? "#75d2a8" : "#e199bd";
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h/2}" fill="${bg}" />
  <text x="${x + w/2}" y="${y + h/2 + 7}" fill="${fg}" font-size="22" font-family="Inter, system-ui" text-anchor="middle">${escapeXML(label)}</text>
  `;
}
function clamp(n){ const x = Number(n); if (!Number.isFinite(x)) return 50; return Math.max(0, Math.min(100, Math.round(x))); }
function escapeXML(s){ return String(s||"").replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'})[c]); }
