export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization",
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const geminiApiKey =
    process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (!geminiApiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY is not configured in Vercel environment variables",
    });
  }

  try {
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const googleRes = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/auth_tokens",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": geminiApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expireTime }),
      },
    );

    if (!googleRes.ok) {
      const errText = await googleRes.text();
      return res.status(googleRes.status).json({
        error: "Failed to mint token from Google",
        details: errText,
      });
    }

    const data = await googleRes.json();
    return res.status(200).json({ token: data.name, expireTime });
  } catch (err) {
    return res
      .status(500)
      .json({ error: err?.message || "Internal server error" });
  }
}
