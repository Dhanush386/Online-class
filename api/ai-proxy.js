import { createClient } from "@supabase/supabase-js";

// Rate limiting in-memory map per IP/User (15 req / 10 min window)
const rateLimits = new Map();
const USER_MAX_REQUESTS = 20;
const USER_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// Global rate limiting circuit breaker
let globalWindowStart = Date.now();
let globalCount = 0;
const GLOBAL_MAX_PER_MINUTE = 120;

function checkRateLimit(key) {
  const now = Date.now();

  // Global circuit breaker
  if (now - globalWindowStart > 60000) {
    globalWindowStart = now;
    globalCount = 0;
  }
  globalCount++;
  if (globalCount > GLOBAL_MAX_PER_MINUTE) {
    return {
      allowed: false,
      reason:
        "System AI generation capacity temporarily saturated. Please try again shortly.",
    };
  }

  // Per-key limiter
  let record = rateLimits.get(key);
  if (!record || now - record.windowStart > USER_WINDOW_MS) {
    record = { count: 1, windowStart: now };
    rateLimits.set(key, record);
    return { allowed: true };
  }

  if (record.count >= USER_MAX_REQUESTS) {
    const retrySeconds = Math.ceil(
      (record.windowStart + USER_WINDOW_MS - now) / 1000,
    );
    return {
      allowed: false,
      retryAfter: retrySeconds,
      reason: `Rate limit exceeded. You may make at most ${USER_MAX_REQUESTS} AI requests per 10 minutes. Try again in ${retrySeconds}s.`,
    };
  }

  record.count++;
  return { allowed: true };
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization, x-client-info, apikey, content-type",
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Extract client IP for fallback rate limiting
  const clientIp =
    req.headers["x-real-ip"] ||
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  // Authorization check
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Missing or invalid authorization token" });
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  // Supabase auth verification if configured
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey =
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  let userId = clientIp;
  let userProfile = null;

  if (supabaseUrl && supabaseAnonKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
      });
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser(token);
      if (authErr || !user) {
        return res
          .status(401)
          .json({ error: "Unauthorized session or expired token" });
      }
      userId = user.id;

      // Check user role if privileged action requested
      const body =
        typeof req.body === "string"
          ? JSON.parse(req.body || "{}")
          : req.body || {};
      const { action } = body;
      if (["generate_questions", "generate_challenges"].includes(action)) {
        const { data: profile } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .single();

        userProfile = profile;
        const isStaff = ["organizer", "main_admin", "sub_admin"].includes(
          profile?.role,
        );
        if (!isStaff) {
          return res.status(403).json({
            error:
              "Forbidden: Only instructors and administrators may generate curriculum content",
          });
        }
      }
    } catch (err) {
      console.error("Auth verification error in ai-proxy:", err);
    }
  }

  // Rate limit check
  const limitCheck = checkRateLimit(userId);
  if (!limitCheck.allowed) {
    if (limitCheck.retryAfter) {
      res.setHeader("Retry-After", String(limitCheck.retryAfter));
    }
    return res.status(429).json({ error: limitCheck.reason });
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return res
      .status(500)
      .json({ error: "GEMINI_API_KEY is not configured on server" });
  }

  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : req.body || {};
    const {
      action = "chat",
      prompt,
      systemInstruction,
      temperature = 0.7,
      responseMimeType,
    } = body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res
        .status(400)
        .json({ error: "Prompt is required and must be text" });
    }

    const sanitizedPrompt = prompt.trim().slice(0, 3000);

    const requestPayload = {
      contents: [{ parts: [{ text: sanitizedPrompt }] }],
      generationConfig: {
        temperature: Math.max(0, Math.min(1, Number(temperature) || 0.7)),
        ...(responseMimeType ? { responseMimeType } : {}),
      },
    };

    if (systemInstruction) {
      requestPayload.systemInstruction = {
        parts: [{ text: String(systemInstruction).slice(0, 1000) }],
      };
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      },
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error:", geminiRes.status, errText);
      return res.status(geminiRes.status >= 500 ? 502 : geminiRes.status).json({
        error: "AI generation service error. Please try again.",
      });
    }

    const data = await geminiRes.json();
    const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return res.status(200).json({ text: textOutput });
  } catch (err) {
    console.error("AI proxy handler error:", err);
    return res
      .status(500)
      .json({ error: err.message || "Internal server error" });
  }
}
