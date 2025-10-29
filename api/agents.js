// /api/agents.js
// Returns { gem: { prob: 0..100, rationale: string } } from Gemini.
// Usage: /api/agents?title=AL%20vs%20T1&sideA=AL&sideB=T1
// ENV: GEMINI_API_KEY

export default async function handler(req, res) {
  try {
    const { title = "Match", sideA = "Side A", sideB = "Side B" } = req.query;
    const key = process.env.GEMINI_API_KEY;
    if (!key) return res.status(500).json({ error: "Missing GEMINI_API_KEY" });

    // Prompt asks for a single number + 1–2 sentence rationale (concise).
    // Keep it factual and NFA. You can tweak wording anytime.
    const prompt = `
You are a prediction assistant. For the event "${title}", estimate the probability (0–100) that "${sideA}" outperforms "${sideB}".
Return ONLY strict JSON with fields:
{"prob": <integer 0..100>, "rationale": "<1-2 short sentences citing the most relevant factors (recent form, injuries, matchups, schedule). Keep it factual and NFA.>"}
`;

    // ---- Basic call (works today). Later you can enable Google Search grounding (see TODO below).
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + key,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 },
          // TODO (optional grounding):
          // tools: [{ google_search: {} }],
        }),
      }
    );

    const j = await r.json();
    const text = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Try to parse strict JSON; fallback to regex if the model adds fluff.
    let prob = 50;
    let rationale = "No rationale.";
    try {
      const parsed = JSON.parse(text.trim());
      if (Number.isFinite(parsed.prob)) prob = clamp(parsed.prob);
      if (typeof parsed.rationale === "string") rationale = clip(parsed.rationale, 220);
    } catch {
      const m = text.match(/"prob"\s*:\s*(\d{1,3})/i) || text.match(/(\d{1,3})\s*%/);
      if (m) prob = clamp(parseInt(m[1], 10));
      const rm = text.match(/"rationale"\s*:\s*"([^"]+)/i);
      if (rm) rationale = clip(rm[1], 220);
    }

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600"); // cache edge 5m
    return res.status(200).json({ gem: { prob, rationale } });
  } catch (e) {
    return res.status(200).json({ gem: { prob: 50, rationale: "No data available; defaulting to neutral." } });
  }
}

function clamp(n) { n = Math.round(n); return Math.max(0, Math.min(100, n)); }
function clip(s, n) { s = String(s).replace(/\s+/g, " ").trim(); return s.length <= n ? s : s.slice(0, n - 1) + "…"; }
