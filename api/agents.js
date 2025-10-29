// /api/agents.js
// Calls Gemini 2.5 Flash for predictions and returns { gem: { prob, rationale } }
// Works with your account’s v1beta endpoint.

export default async function handler(req, res) {
  const { title = "Match", sideA = "Side A", sideB = "Side B", raw } = req.query;
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    res.status(500).json({ error: "Missing GEMINI_API_KEY" });
    return;
  }

  const prompt = `
You are a sports prediction assistant.
Estimate the probability (0–100) that "${sideA}" beats "${sideB}" in "${title}".
Give a concise factual rationale (recent form, head-to-head, injuries, etc).
Return STRICT JSON only in this shape:
{"prob": <integer 0..100>, "rationale": "<short factual reason. NFA>"}
Avoid 50 unless the matchup is genuinely even or uncertain; justify if 50.
`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1
        }
      })
    });

    const j = await r.json();

    const text =
      j?.candidates?.[0]?.content?.parts?.[0]?.text ??
      j?.error?.message ??
      "";

    if (raw) {
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({ raw: text });
      return;
    }

    const { prob, rationale } = parseJSONish(text);

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      gem: {
        prob: clamp(prob ?? 50),
        rationale: clip(rationale || "No rationale.", 220)
      }
    });
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      gem: { prob: 50, rationale: "No data available; defaulting to neutral." },
      error: e?.message || String(e)
    });
  }
}

function parseJSONish(s) {
  const txt = String(s || "").trim();

  try {
    return JSON.parse(txt);
  } catch {}

  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {}
  }

  const num = txt.match(/"prob"\s*:\s*(\d{1,3})/) || txt.match(/(\d{1,3})\s*%/);
  const prob = num ? parseInt(num[1], 10) : undefined;
  const rat = txt.match(/"rationale"\s*:\s*"([^"]+)/i);
  const rationale = rat ? rat[1] : undefined;

  return { prob, rationale };
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
