// /api/agents.js
// Returns { gem: { prob: 0..100, rationale: string } } from Gemini.
// Usage: /api/agents?title=AL%20vs%20T1&sideA=AL&sideB=T1
// ENV: GEMINI_API_KEY

export default async function handler(req, res) {
  try {
    const { title = "Match", sideA = "Side A", sideB = "Side B" } = req.query;
    const key = process.env.GEMINI_API_KEY;
    if (!key) return res.status(500).json({ error: "Missing GEMINI_API_KEY" });

    // Strong, concrete prompt. Avoids 50–50 unless truly justified.
    const userPrompt = `
You are a prediction assistant. For the event "${title}", estimate the probability (0–100) that "${sideA}" beats "${sideB}".
Constraints:
- Return STRICT JSON only.
- Fields: {"prob": <integer 0..100>, "rationale": "<1–2 concise sentences citing the most relevant factors (recent form, H2H, schedule/format, injuries, roster news). No links. NFA>"}
- Avoid 50 unless the matchup is genuinely even or there is material uncertainty; if you output 50, justify it clearly in the rationale.
- Keep rationale factual and specific (e.g., "T1 won X of last Y vs top teams", "AL form dipped last week", "injury to ...").
`;

    // Request JSON directly via response_mime_type.
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + key,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.2,
            response_mime_type: "application/json"
          },
          // Optional: enable web grounding if your account supports it
          // tools: [{ google_search: {} }],
        }),
      }
    );

    const j = await r.json();
    let text = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Handle code-fenced JSON like ```json ... ```
    text = stripCodeFences(text);

    let prob = 50, rationale = "No rationale.";
    try {
      const out = JSON.parse(text);
      if (Number.isFinite(out.prob)) prob = clamp(out.prob);
      if (typeof out.rationale === "string" && out.rationale.trim()) {
        rationale = clip(out.rationale, 220);
      }
    } catch {
      // Fallback regex if the model ignored JSON mode
      const m = text.match(/"prob"\s*:\s*(\d{1,3})/i) || text.match(/(\d{1,3})\s*%/);
      if (m) prob = clamp(parseInt(m[1], 10));
      const rm = text.match(/"rationale"\s*:\s*"([^"]+)/i);
      if (rm) rationale = clip(rm[1], 220);
    }

    // During testing, disable edge cache completely (we can re-add later)
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ gem: { prob, rationale } });
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      gem: { prob: 50, rationale: "No data available; defaulting to neutral." }
    });
  }
}

function clamp(n){ n = Math.round(n); return Math.max(0, Math.min(100, n)); }
function clip(s, n){ s = String(s).replace(/\s+/g, " ").trim(); return s.length <= n ? s : s.slice(0, n - 1) + "…"; }
function stripCodeFences(s){
  // Removes ```json ... ``` or ``` ... ```
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fence ? fence[1].trim() : s.trim();
}
