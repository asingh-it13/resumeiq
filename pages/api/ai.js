export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { system, user, maxTokens } = req.body;
  if (!system || !user) return res.status(400).json({ error: "Missing system or user field" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set in environment variables" });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",   // 98% cheaper than Opus
        max_tokens: Math.min(Number(req.body.maxTokens) || 2048, 8096),  // cap at 8096 for safety
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error?.message || "Anthropic API error" });
    }

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    if (data.stop_reason === "max_tokens") return res.status(500).json({ error: "Response cut off — try a shorter input." });

    const text = (data.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("")
      .trim();

    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
}
