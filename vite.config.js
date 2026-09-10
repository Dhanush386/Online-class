import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function serverSecurityAndAiPlugin(geminiApiKey) {
  return {
    name: "server-security-and-ai-middleware",
    configureServer(server) {
      // 1. Gemini Live Ephemeral Token Endpoint
      server.middlewares.use("/api/gemini-live-token", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        const authHeader = req.headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          res.statusCode = 401;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Unauthorized: Missing authentication token" }));
          return;
        }

        res.setHeader("Content-Type", "application/json");
        if (!geminiApiKey) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "Gemini API key not configured on server" }));
          return;
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
            res.statusCode = googleRes.status;
            res.end(JSON.stringify({ error: "Failed to mint token from Google", details: errText }));
            return;
          }

          const data = await googleRes.json();
          res.statusCode = 200;
          res.end(JSON.stringify({ token: data.name, expireTime }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message || "Internal server error" }));
        }
      });

      // 2. AI Proxy Dev Endpoint (Local development fallback)
      server.middlewares.use("/api/ai-proxy", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        const authHeader = req.headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          res.statusCode = 401;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Unauthorized: Missing authentication token" }));
          return;
        }

        res.setHeader("Content-Type", "application/json");
        if (!geminiApiKey) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "Gemini API key not configured on server" }));
          return;
        }

        let rawBody = "";
        req.on("data", chunk => { rawBody += chunk; });
        req.on("end", async () => {
          try {
            const parsed = JSON.parse(rawBody || "{}");
            const { prompt, systemInstruction, temperature = 0.7, responseMimeType } = parsed;

            if (!prompt || typeof prompt !== "string") {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Prompt is required" }));
              return;
            }

            const requestPayload = {
              contents: [{ parts: [{ text: prompt.slice(0, 3000) }] }],
              generationConfig: {
                temperature: Number(temperature) || 0.7,
                ...(responseMimeType ? { responseMimeType } : {})
              }
            };

            if (systemInstruction) {
              requestPayload.systemInstruction = {
                parts: [{ text: String(systemInstruction).slice(0, 1000) }]
              };
            }

            const googleRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestPayload)
              }
            );

            if (!googleRes.ok) {
              res.statusCode = googleRes.status >= 500 ? 502 : googleRes.status;
              res.end(JSON.stringify({ error: "AI generation failed from provider" }));
              return;
            }

            const data = await googleRes.json();
            const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            res.statusCode = 200;
            res.end(JSON.stringify({ text: textOutput }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message || "Internal server error" }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Server-only key: checks process.env.GEMINI_API_KEY first
  const geminiApiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || "";

  return {
    plugins: [react(), tailwindcss(), serverSecurityAndAiPlugin(geminiApiKey)],
    base: "/",
    server: {
      headers: {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      }
    },
    preview: {
      headers: {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      }
    },
    build: {
      outDir: "dist",
      rollupOptions: {
        output: {
          manualChunks: {
            "react-vendor": ["react", "react-dom", "react-router-dom"],
            supabase: ["@supabase/supabase-js"],
            charts: ["recharts"],
            "face-api": ["@vladmandic/face-api"],
            media: ["react-player", "html2canvas"],
            icons: ["lucide-react"],
          },
        },
      },
    },
  };
});
