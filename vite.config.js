import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function geminiLiveTokenPlugin(geminiApiKey) {
  return {
    name: "gemini-live-token-middleware",
    configureServer(server) {
      server.middlewares.use("/api/gemini-live-token", async (req, res) => {
        if (req.method !== "POST" && req.method !== "GET") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }
        res.setHeader("Content-Type", "application/json");
        if (!geminiApiKey) {
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              error: "Gemini API key not configured on server",
            }),
          );
          return;
        }
        try {
          const expireTime = new Date(
            Date.now() + 30 * 60 * 1000,
          ).toISOString();
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
            res.end(
              JSON.stringify({
                error: "Failed to mint token from Google",
                details: errText,
              }),
            );
            return;
          }

          const data = await googleRes.json();
          res.statusCode = 200;
          res.end(JSON.stringify({ token: data.name, expireTime }));
        } catch (err) {
          res.statusCode = 500;
          res.end(
            JSON.stringify({ error: err.message || "Internal server error" }),
          );
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const geminiApiKey =
    process.env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || "";

  return {
    plugins: [react(), tailwindcss(), geminiLiveTokenPlugin(geminiApiKey)],
    base: "/",
    build: {
      outDir: "dist",
      // Split vendor libraries into separate cached chunks
      rollupOptions: {
        output: {
          manualChunks: {
            // Core React — rarely changes, cached aggressively
            "react-vendor": ["react", "react-dom", "react-router-dom"],
            // Supabase — large SDK, separate chunk
            supabase: ["@supabase/supabase-js"],
            // Charts — only needed on dashboard/analytics pages
            charts: ["recharts"],
            // Face API — very large, only needed on profile/student management
            "face-api": ["@vladmandic/face-api"],
            // Code editor and player — needed only in coding/course pages
            media: ["react-player", "html2canvas"],
            // Icon library
            icons: ["lucide-react"],
          },
        },
      },
    },
  };
});
