import { supabase } from "../lib/supabase";

/**
 * Invokes the secure, authenticated, and rate-limited backend AI Proxy.
 * Ensures the frontend browser NEVER handles or leaks the GEMINI_API_KEY.
 *
 * @param {Object} options
 * @param {string} options.action - e.g. 'generate_questions' | 'generate_challenges' | 'chat'
 * @param {string} options.prompt - The input prompt text
 * @param {string} [options.systemInstruction] - Optional system instruction
 * @param {number} [options.temperature=0.7] - Model temperature
 * @param {string} [options.responseMimeType] - e.g. 'application/json'
 * @returns {Promise<string>} Generated text from AI
 */
export async function invokeAiProxy({
  action = "chat",
  prompt,
  systemInstruction,
  temperature = 0.7,
  responseMimeType,
}) {
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    throw new Error("A prompt is required for AI generation.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  // 1. First try same-origin endpoint /api/ai-proxy (Vercel serverless function in prod, Vite dev middleware in local)
  let apiProxyStatus = null;
  try {
    const res = await fetch("/api/ai-proxy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        action,
        prompt: prompt.trim(),
        systemInstruction,
        temperature,
        responseMimeType,
      }),
    });

    apiProxyStatus = res.status;

    if (res.ok) {
      const data = await res.json();
      if (data?.text) return data.text;
      if (data?.error) throw new Error(data.error);
    } else {
      const errData = await res.json().catch(() => null);
      const errMsg =
        errData?.error || `AI service returned error (${res.status})`;

      // If the backend exists and responded with an error (e.g. 500 missing key, 429 rate limit, 403, 400),
      // throw that specific error message so the user / developer knows exactly what failed!
      if (res.status !== 404) {
        throw new Error(errMsg);
      }
    }
  } catch (apiErr) {
    // If the server responded with any error other than 404, don't hide it behind Edge Function fallback
    if (apiProxyStatus && apiProxyStatus !== 404) {
      throw apiErr;
    }
    console.warn(
      "Same-origin /api/ai-proxy endpoint unavailable (404), falling back to Supabase Edge Function...",
      apiErr.message,
    );
  }

  // 2. Fallback to Supabase Edge Function ai-proxy
  try {
    const { data, error } = await supabase.functions.invoke("ai-proxy", {
      body: {
        action,
        prompt: prompt.trim(),
        systemInstruction,
        temperature,
        responseMimeType,
      },
    });

    if (error) {
      if (
        error.status === 429 ||
        error.message?.includes("Rate limit") ||
        error.message?.includes("capacity")
      ) {
        throw new Error(
          error.message ||
            "AI generation rate limit exceeded. Please wait a few minutes before trying again.",
        );
      }
      throw new Error(error.message || "AI generation service failed.");
    }

    if (data?.text) {
      return data.text;
    }

    if (data?.error) {
      throw new Error(data.error);
    }
  } catch (edgeErr) {
    if (
      edgeErr.message?.includes("Rate limit") ||
      edgeErr.message?.includes("capacity")
    ) {
      throw edgeErr;
    }

    // Check if Edge Function failed because it is not deployed on Supabase (CORS / preflight 404 error)
    if (
      edgeErr.name === "FunctionsFetchError" ||
      edgeErr.message?.includes("Failed to send a request") ||
      edgeErr.message?.includes("ERR_FAILED")
    ) {
      throw new Error(
        "AI proxy service is not configured. Please ensure GEMINI_API_KEY is configured in Vercel Project Settings > Environment Variables, or deploy the Supabase ai-proxy edge function.",
      );
    }

    throw new Error(
      edgeErr.message ||
        "AI service currently unavailable. Please try again later.",
    );
  }

  throw new Error("No response returned from AI service.");
}

/**
 * Generate multiple-choice questions securely via server AI proxy
 */
export async function generateMCQsWithAI(topicPrompt) {
  const prompt = `You are an expert educator. Create multiple-choice questions based on the following topic or text: "${topicPrompt}".
Output the response strictly as a JSON array of objects. Do not include markdown codeblocks like \`\`\`json.
Each object must follow this exact structure:
{
    "question_text": "The question here",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": ["Option A"]
}`;

  const rawText = await invokeAiProxy({
    action: "generate_questions",
    prompt,
    temperature: 0.6,
    responseMimeType: "application/json",
  });

  // Clean up any stray markdown wrappers
  const cleaned = rawText
    .replaceAll("```json", "")
    .replaceAll("```", "")
    .trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) {
    throw new Error("AI response was not a valid questions array.");
  }
  return parsed;
}

/**
 * Generate coding challenges securely via server AI proxy
 */
export async function generateCodingChallengesWithAI(topicPrompt) {
  const prompt = `You are an expert computer science educator. Create coding challenges based on the following topic or text: "${topicPrompt}".
Output the response strictly as a JSON array of objects. Do not include markdown codeblocks like \`\`\`json.
Each object must follow this exact structure:
{
    "title": "Challenge Title",
    "problem_statement": "Detailed markdown description of the problem",
    "language": "python",
    "difficulty": "easy",
    "starter_code": "def solution():\\n  pass",
    "solution_code": "def solution():\\n  return True",
    "constraints": "1 <= N <= 10^5",
    "test_cases": [
        { "input": "...", "expected_output": "..." }
    ]
}
Valid languages: html, python, python_ml, java, cpp, c, sql. Valid difficulties: easy, medium, hard.`;

  const rawText = await invokeAiProxy({
    action: "generate_challenges",
    prompt,
    temperature: 0.6,
    responseMimeType: "application/json",
  });

  const cleaned = rawText
    .replaceAll("```json", "")
    .replaceAll("```", "")
    .trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) {
    throw new Error("AI response was not a valid challenges array.");
  }
  return parsed;
}

/**
 * Chat with AI Assistant securely via server AI proxy
 */
export async function sendChatMessageToAI(userMessage, context = "") {
  const systemInstruction = `You are the Learnova AI Assistant. Help the user with their course, assessments, or platform navigation. Be concise, respectful, and educational. Platform info: Learnova is a secure interactive e-learning platform.`;

  const fullPrompt = context
    ? `Context: ${context}\n\nUser Question: ${userMessage}`
    : userMessage;

  return await invokeAiProxy({
    action: "chat",
    prompt: fullPrompt,
    systemInstruction,
    temperature: 0.7,
  });
}
