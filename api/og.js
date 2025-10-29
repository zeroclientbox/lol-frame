// /api/og.js
// Returns a 1200x630 SVG with 3 sliders for ChatGPT, Grok, and Gemini.
// Usage: /api/og?gpt=53&grok=47&gem=49&title=AL%20vs%20T1

export default function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const title = decodeURIComponent(url.searchParams.get('title') || 'Market');
  const gpt  = clamp(parseInt(url.searchParams.get('gpt')  || '50', 10));
  const grok = clamp(parseInt(url.searchParams.get('grok') || '50', 10));
  const gem  = clamp(parseInt(url.searchParams.get('gem')  || '50', 10));

  const svg = renderSVG({ title, gpt, grok, gem });
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(svg);
}

function clamp(n){ return Math.max(0, Math.min(100, isNaN(n)?50:n)); }

function bar(x, y, w, h, pct, track="#232532", fill="#7dd3a7") {
  const filledW = Math.round((w * pct) / 100);
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h/2}" fill="${track}" />
    <rect x="${x}" y="${y}" width="${filledW}" height="${h}" rx="${h/2}" fill="${fill}" />
    <text x="${x + w + 16}" y="${y + h - 6}" font-size="32" fill="#EDEFF5" font-family="Inter,system-ui,-apple-system,Segoe UI,Roboto"> ${pct}%</text>
  `;
}

function renderSVG({ title, gpt, grok, gem }) {
  const W = 1200, H = 630, P = 64, BW = 820, BH = 28, GAP = 80;
  const startY = 220;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b0d14"/>
      <stop offset="100%" stop-color="#121527"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <text x="${P}" y="120" font-size="48" fill="#EDEFF5" font-family="Inter,system-ui,-apple-system,Segoe UI,Roboto" font-weight="600">
    ${escapeXML(title)}
  </text>
  <text x="${P}" y="170" font-size="24" fill="#B8BCC9" font-family="Inter,system-ui,-apple-system,Segoe UI,Roboto">
    Model odds (NFA)
  </text>

  <text x="${P}" y="${startY - 8}" font-size="28" fill="#B8BCC9" font-family="Inter,system-ui,-apple-system,Segoe UI,Roboto">ChatGPT</text>
  ${bar(P, startY, BW, BH, gpt, "#232532", "#7dd3a7")}

  <text x="${P}" y="${startY + GAP - 8}" font-size="28" fill="#B8BCC9" font-family="Inter,system-ui,-apple-system,Segoe UI,Roboto">Grok</text>
  ${bar(P, startY + GAP, BW, BH, grok, "#232532", "#c34b7b")}

  <text x="${P}" y="${startY + GAP*2 - 8}" font-size="28" fill="#B8BCC9" font-family="Inter,system-ui,-apple-system,Segoe UI,Roboto">Gemini</text>
  ${bar(P, startY + GAP*2, BW, BH, gem, "#232532", "#7aa2ff")}

  <!-- Fixed XML-safe text -->
  <text x="${P}" y="${H - 40}" font-size="20" fill="#8a90a4" font-family="Inter,system-ui,-apple-system,Segoe UI,Roboto">
    Tip: change query (?gpt=&amp;grok=&amp;gem=) to update sliders
  </text>
</svg>`;
}

function escapeXML(s) {
  return String(s).replace(/[<>&'"]/g, c =>
    ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'})[c]
  );
}
