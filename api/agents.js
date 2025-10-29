// /api/agents.js
// Returns { gem: { prob: 0..100, rationale: string } } from Gemini.
// Usage: /api/agents?title=LoL%20Worlds%20Quarterfinal%20AL%20vs%20T1%20(Bo5)&sideA=AL&sideB=T1
// Add &raw=1 to see the raw model output for debugging.
// ENV required: GEMINI_API_KEY

export default async function handler(req, res) {
  const { title = "Match", sideA = "Side A", sideB = "Side B", raw } = req.query;
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    res.status(500).json({ error: "Missing GEMINI_API_KEY" });
    return;
  }

  // Clear, grounded instruction
  const system = `You are a sports prediction assistant. 
Return STRICT JSON only. Fields:
{"prob": <integer 0..100>, "rationale": "<1–2 concise sentences (factual), e.g., recent form, head-to-head, injuries, roster news, meta changes>. NFA"}
"prob" = probability that "${sideA}" beats "${sideB}" in "${title}".
Avoid 50 unless truly even or data is unclear; justify clearly if 50.`;

  const user = `Event: "${title}"
Sides: ${sideA} (prob target) vs ${sideB}
Task: Estimate ${sideA}'s win probability (0–100) and a brief rationale. Keep it specific, factual and concise.`;

  try {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + key,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Put instruction in a first message, then the user task
          contents: [
            { role: "user", parts: [{ text: system }] },
            { role: "user", parts: [{ text: user }] },
          ],
          generationConfig: {
            temperature: 0.1,
            // Force structured JSON
            response_mime_type: "application/json",
            response_schema: {
              type: "OBJECT",
              properties: {
                prob: { type: "INTEGER" },
                rationale: { type: "STRING" },
              },
              required: ["prob", "rationale"],
            },
          },
          // If your key has it, uncomment to allow web grounding:
          // tools: [{ google_search: {} }],
        }),
      }
    );

    const j = await r.json();
    let text = j?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Optional: return raw output so we can see what Gemini sent
    if (raw) {
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({ raw: text, api: j });
      return;
    }

    // Parse strictly
    let out = {};
    try {
      out = JSON.parse(text);
    } catch (_) {
      // Some accounts still wrap in code fences; strip them
      text = stripFences(text);
      out = JSON.parse(text);
    }

    const prob = clamp(out?.prob);
    const rationale = clip(out?.rationale || "No rationale.", 220);

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ gem: { prob, rationale } });
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      gem: { prob: 50, rationale: "No data available; defaulting to neutral." },
      error: e?.message || String(e),
    });
  }
}

function clamp(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 50;
  return Math.max(0, Math.min(100, Math.round(x)));
}
function clip(s, n) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length <= n ? t : t.slice(0, n - 1) + "…";
}
function stripFences(s) {
  const m = String(s).match(/```(?:json)?\s*([\s\S]*?)```/i);
  return m ? m[1].trim() : String(s).trim();
}
