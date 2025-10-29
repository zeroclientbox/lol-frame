// /api/og.js
// Dynamic SVG for Farcaster Frame with live Gemini odds
export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title") || "AL vs T1 – Who advances?";
  const sideA = searchParams.get("sideA") || "AL";
  const sideB = searchParams.get("sideB") || "T1";

  // 🔹 Step 1: Fetch Gemini prediction
  let gemOdds = 50;
  try {
    const gemResp = await fetch(
      `${req.nextUrl.origin}/api/agents?title=${encodeURIComponent(
        title
      )}&sideA=${encodeURIComponent(sideA)}&sideB=${encodeURIComponent(sideB)}`
    );
    const data = await gemResp.json();
    gemOdds = data.gem ?? 50;
  } catch (e) {
    console.error("Gemini fetch failed:", e);
  }

  // 🔹 Step 2: Draw SVG
  const W = 1200,
    H = 630,
    P = 80;
  const barWidth = 900;
  const filled = (gemOdds / 100) * barWidth;

  const svg = `
  <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="#0b0e14"/>
    <text x="${P}" y="100" fill="#ffffff" font-size="42" font-family="Inter, sans-serif" font-weight="600">
      ${title}
    </text>

    <text x="${P}" y="200" fill="#00b4ff" font-size="32">${sideA}</text>
    <text x="${W - P - 200}" y="200" fill="#ff005c" font-size="32" text-anchor="end">${sideB}</text>

    <rect x="${P}" y="250" width="${barWidth}" height="40" fill="#1a1f2e" rx="10"/>
    <rect x="${P}" y="250" width="${filled}" height="40" fill="#00b4ff" rx="10"/>

    <text x="${P + barWidth / 2}" y="320" fill="#ffffff" font-size="26" text-anchor="middle">
      Gemini odds: ${gemOdds}% ${sideA}
    </text>
  </svg>
  `;

  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml" },
  });
}
