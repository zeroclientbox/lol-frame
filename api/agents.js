// /api/agents.js
// Gemini 2.5 Flash prediction for a binary market (Myriad-style)

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const {
    ask = "Which outcome is more likely?",
    choices = "Yes|No",
    year = "2025",
    context = ""
  } = req.query;

  const [left, right] = String(choices).split("|").map(s => (s || "").trim());
  if (!left || !right) {
    res.status(400).json({ error: "Provide choices=A|B" });
    return;
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    res.status(500).json({ error: "Missing GEMINI_API_KEY" });
    return;
  }

  const asOf = new Date().toISOString();
  const prompt = `
You are an AI prediction analyst providing Myriad-style probabilities.

Task: Predict which project will rank higher on CoinMarketCap on Nov 2, 2025.
Question: "${ask}"
Choices (binary): "${left}" (FIRST) vs "${right}" (SECOND).
Context: ${context || "none"}.
Assume today's date is ${asOf}. Use publicly known crypto trends only.

Return STRICT JSON ONLY (no markdown, no commentary):
{"prob": <integer 0–100>, "rationale": "<≤200 characters, concise factual reason. NFA>"}
`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 }
      })
    });

    const j = await r.json();
    const text = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? j?.error?.message ?? "";

    const { prob, rationale } = parseJSONish(text);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      left,
      right,
      gem: { prob: clamp(prob ?? 50), rationale: clip(rationale || "NFA", 200) }
    });
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      left, right,
      gem: { prob: 50, rationale: "No data; neutral. NFA" },
      error: e?.message || String(e)
    });
  }
}

function parseJSONish(s) {
  const txt = String(s || "").trim();
  try { return JSON.parse(txt); } catch {}
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) { try { return JSON.parse(fence[1].trim()); } catch {} }
  const num = txt.match(/"prob"\s*:\s*(\d{1,3})/) || txt.match(/(\d{1,3})\s*%/);
  const prob = num ? parseInt(num[1], 10) : undefined;
  const rat  = txt.match(/"rationale"\s*:\s*"([^"]+)/i);
  const rationale = rat ? rat[1] : undefined;
  return { prob, rationale };
}

function clamp(n){ const x = Number(n); if (!Number.isFinite(x)) return 50; return Math.max(0, Math.min(100, Math.round(x))); }
function clip(s,n){ const t = String(s||"").replace(/\s+/g," ").trim(); return t.length<=n?t:t.slice(0,n-1)+"…"; }
