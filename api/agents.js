// /api/agents.js
// Returns { gem: { prob: 0..100, rationale: string } } from Gemini.
// Usage: /api/agents?title=LoL%20Worlds%20Quarterfinal%20AL%20vs%20T1%20(Bo5)&sideA=AL&sideB=T1
// Add &raw=1 to debug raw output.
// ENV required: GEMINI_API_KEY

export default async function handler(req, res) {
  const { title = "Match", sideA = "Side A", sideB = "Side B", raw } = req.query;
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    res.status(500).json({ error: "Missing GEMINI_API_KEY" });
    return;
  }

  // Clear, specific instruction
  const system = `You are a sports prediction assistant.
Return STRICT JSON only with fields:
{"prob": <integer 0..100>, "rationale": "<1–2 concise factual sentences (recent form, H2H, injuries, roster news). NFA>"}
"prob" = probability that "${sideA}" beats "${sideB}" in "${title}".
Avoid 50 unless the matchup is truly even or data is unclear; justify if 50.`;

  const user = `Event: "${title}"
Sides: ${sideA} (prob target) vs ${sideB}
Task: Estimate ${sideA}'s win probability (0–100) and provide a brief rationale. Keep it specific and factual.`;

  try {
    const text = await callGeminiJSON(key, system, user);

    if (raw) {
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({ raw: text });
      return;
    }

    let out = {};
    try {
      out = JSON.parse(stripFences(text));
    } catch (e) {
      return res.status(200).json({
        gem: { prob: 50, rationale: "No data available; defaulting to neutral." },
        error: "Parse failure: " + (e?.message || String(e)),
        raw: text
      });
    }

    const prob = clamp(out?.prob);
    const rationale = clip(out?.rationale || "No rationale.", 220);

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ gem: { prob, rationale } });
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      gem: { prob: 50, rationale: "No data available; defaulting to neutral." },
      error: e?.message || String(e)
    });
  }
}

async function callGeminiJSON(key, system, user) {
  const models = [
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash-8b"
  ];
  let lastErrText = "";

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: system }] },
          { role: "user", parts: [{ text: user }] }
        ],
        generationConfig: {
          temperature: 0.1,
          response_mime_type: "application/json",
          response_schema: {
            type: "OBJECT",
            properties: {
              prob: { type: "INTEGER" },
              rationale: { type: "STRING" }
            },
            required: ["prob", "rationale"]
          }
        }
        // If your account supports it, you can enable web grounding:
        // , tools: [{ google_search: {} }]
      })
    });

    const j = await r.json();

    // Model not found on this API — try next alias
    if (j?.error?.status === "NOT_FOUND") {
      lastErrText = j.error.message || "NOT_FOUND";
      continue;
    }

    const text = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (text) return text;

    lastErrText = j?.error?.message || "Empty response";
  }

  throw new Error(`Gemini call failed: ${lastErrText}`);
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
  const m = String(s || "").match(/```(?:json)?\s*([\s\S]*?)```/i);
  return m ? m[1].trim() : String(s || "").trim();
}
