// /api/agents.js
// Simple Gemini AI odds predictor

export default async function handler(req, res) {
  const { title, sideA, sideB } = req.query;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "Missing GEMINI_API_KEY" });
  }

  try {
    const prompt = `
You are a prediction assistant. 
Estimate the likelihood (0–100%) of "${sideA}" vs "${sideB}" for the event "${title}".
Respond with only a single JSON number field called "probA" representing ${sideA}'s chance.
Example: {"probA": 62}
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await response.json();

    // Try to extract JSON safely
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const match = text.match(/(\d+)/);
    const probA = match ? parseInt(match[1], 10) : 50;

    res.status(200).json({ gem: probA });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
