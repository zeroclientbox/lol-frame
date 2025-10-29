// /api/agents.js
// Compatible Gemini caller that returns { gem: { prob, rationale } }.
// Works across v1beta/v1 and multiple model aliases. No special schema fields.

export default async function handler(req, res) {
  const { title = "Match", sideA = "Side A", sideB = "Side B", raw } = req.query;
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    res.status(500).json({ error: "Missing GEMINI_API_KEY" });
    return;
  }

  // One compact prompt (schema enforced by instruction + parsing)
  const prompt = `
You are a sports prediction assistant.
Task: For the event "${title}", estimate the probability (0–100) that "${sideA}" beats "${sideB}", and give a 1–2 sentence factual rationale.
Return STRICT JSON only in the shape: {"prob": <integer 0..100>, "rationale": "<short factual reason. NFA>"}
Avoid 50 unless truly even or info is unclear; if 50, justify it briefly.
`;

  try {
    const text = await callGeminiText(key, prompt);

    if (raw) {
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({ raw: text });
      return;
    }

    const { prob, rationale } = parseJSONish(text);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      gem: { prob: clamp(prob ?? 50), rationale: clip(rationale || "No rationale.", 220) }
    });
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      gem: { prob: 50, rationale: "No data available; defaulting to neutral." },
      error: e?.message || String(e)
    });
  }
}

// --- Gemini compat fetch ---
async function callGeminiText(key, prompt) {
  const apiBases = [
    "https://generativelanguage.googleapis.com/v1beta",
    "https://generativelanguage.googleapis.com/v1",
  ];
  const models = [
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash",
    "gemini-1.5-flash-001",
    "gemini-1.5-flash-002",
    "gemini-1.5-flash-8b",
    "gemini-1.5-flash-8b-latest",
  ];

  let lastErr = "No models responded";
  for (const base of apiBases) {
    for (const model of models) {
      const url = `${base}/models/${model}:generateContent?key=${key}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            // Keep it simple for widest compatibility
          }
          // If your account supports it, you can later enable web grounding:
          // , tools: [{ google_search: {} }]
        })
      });

      const j = await r.json();

      // Try next combo if model not found on this version
      if (j?.error?.status === "NOT_FOUND") {
        lastErr = j.error.message || "NOT_FOUND";
        continue;
      }

      const text =
        j?.candidates?.[0]?.content?.parts?.[0]?.text ??
        ""; // some accounts return empty candidates on rate limits

      if (text) return text;

      lastErr = j?.error?.message || "Empty response";
    }
  }
  throw new Error(`Gemini call failed: ${lastErr}`);
}

// --- Parsing helpers ---
function parseJSONish(s) {
  const txt = String(s || "").trim();

  // 1) Try direct JSON
  try {
    const j = JSON.parse(txt);
    return { prob: j.prob, rationale: j.rationale };
  } catch {}

  // 2) Try fenced ```json ... ```
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      const j = JSON.parse(fence[1].trim());
      return { prob: j.prob, rationale: j.rationale };
    } catch {}
  }

  // 3) Last resort: regex for number + quoted rationale
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
