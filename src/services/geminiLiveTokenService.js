import { supabase } from "../lib/supabase";

let cachedToken = null;
let cachedTokenExpiry = null;
let inFlightTokenPromise = null;

/**
 * Prewarm the ephemeral token in the background so it's ready instantly when needed
 */
export async function prewarmGeminiLiveToken() {
  try {
    await getGeminiLiveToken();
  } catch (err) {
    console.debug("Prewarming Gemini Live token failed (will retry on demand):", err);
  }
}

/**
 * Request a short-lived ephemeral token for Gemini Live API.
 * The browser never receives or stores the permanent Gemini API key.
 *
 * Flow:
 * 1. Checks memory cache for non-expired token.
 * 2. Deduplicates concurrent requests via inFlightTokenPromise.
 * 3. Tries local Vite dev endpoint (/api/gemini-live-token).
 * 4. Falls back to Supabase Edge function (gemini-live-token).
 *
 * @returns {Promise<string>} Ephemeral token string (e.g. "auth_tokens/...")
 */
export async function getGeminiLiveToken() {
  // Check if existing token is valid (with 60-second buffer)
  if (
    cachedToken &&
    cachedTokenExpiry &&
    Date.now() < cachedTokenExpiry - 60000
  ) {
    return cachedToken;
  }

  // Deduplicate concurrent token requests
  if (inFlightTokenPromise) {
    return inFlightTokenPromise;
  }

  inFlightTokenPromise = (async () => {
    let token = null;
    let expireTime = null;

    // 1. Try local dev server middleware
    try {
      const res = await fetch("/api/gemini-live-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          token = data.token;
          expireTime = data.expireTime;
        }
      }
    } catch {
      // Expected to fail in non-Vite production or if dev proxy is not active
    }

    // 2. If dev endpoint didn't succeed, invoke Supabase Edge Function
    if (!token) {
      try {
        const { data, error } = await supabase.functions.invoke(
          "gemini-live-token",
          {
            method: "POST",
          },
        );

        if (error) {
          throw error;
        }

        if (data?.token) {
          token = data.token;
          expireTime = data.expireTime;
        }
      } catch (edgeErr) {
        console.debug(
          "Supabase edge function gemini-live-token invocation unavailable:",
          edgeErr,
        );
      }
    }

    if (!token) {
      throw new Error(
        "Could not acquire an ephemeral Gemini Live token from the server. Please check your network or server configuration.",
      );
    }

    cachedToken = token;
    cachedTokenExpiry = expireTime
      ? new Date(expireTime).getTime()
      : Date.now() + 25 * 60 * 1000;
    return cachedToken;
  })().finally(() => {
    inFlightTokenPromise = null;
  });

  return inFlightTokenPromise;
}

/**
 * Clear the cached ephemeral token (e.g. upon socket auth error)
 */
export function clearCachedGeminiLiveToken() {
  cachedToken = null;
  cachedTokenExpiry = null;
  inFlightTokenPromise = null;
}

