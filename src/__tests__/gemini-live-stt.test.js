import { describe, it, expect } from "vitest";
import {
  getTrackVocabulary,
  TRACK_VOCABULARIES,
  GeminiLiveService,
  filterEnglishOnly,
} from "../services/geminiLiveService";
import {
  getGeminiLiveToken,
  clearCachedGeminiLiveToken,
} from "../services/geminiLiveTokenService";
import { STT_STATES } from "../hooks/useSpeechToText";

describe("Gemini Live Speech-to-Text & Transcription System", () => {
  describe("Track-Specific Vocabulary Generation", () => {
    it("returns frontend vocabulary with React and Virtual DOM for Frontend Development", () => {
      const vocab = getTrackVocabulary("Frontend Development");
      expect(vocab).toBeDefined();
      expect(vocab).toContain("React");
      expect(vocab).toContain("Virtual DOM");
      expect(vocab).toContain("TypeScript");
    });

    it("returns backend vocabulary with PostgreSQL and Docker for Backend Engineering", () => {
      const vocab = getTrackVocabulary("Backend Engineering");
      expect(vocab).toBeDefined();
      expect(vocab).toContain("PostgreSQL");
      expect(vocab).toContain("REST API");
      expect(vocab).toContain("Docker");
    });

    it("returns AI/ML vocabulary for AI & Machine Learning track", () => {
      const vocab = getTrackVocabulary("AI & Machine Learning");
      expect(vocab).toBeDefined();
      expect(vocab).toContain("PyTorch");
      expect(vocab).toContain("Transformer");
    });

    it("falls back to Full Stack vocabulary when track is empty or unknown", () => {
      const vocabEmpty = getTrackVocabulary("");
      const vocabUnknown = getTrackVocabulary("Quantum Computing");
      expect(vocabEmpty).toEqual(TRACK_VOCABULARIES["Full Stack Development"]);
      expect(vocabUnknown).toEqual(
        TRACK_VOCABULARIES["Full Stack Development"],
      );
    });
  });

  describe("Gemini Live Service Configuration", () => {
    it("initializes with gemini-3.5-transcribe-live model", () => {
      const service = new GeminiLiveService();
      expect(service.model).toBe("models/gemini-3.5-transcribe-live");
      expect(service.isConnected).toBe(false);
      expect(service.isSetupComplete).toBe(false);
    });

    it("requires an ephemeral token to connect and rejects if missing", async () => {
      const service = new GeminiLiveService();
      await expect(service.connect({ token: "" })).rejects.toThrow(
        "An ephemeral token is required to connect to Gemini Live.",
      );
    });
  });

  describe("Safe Non-Destructive Answer Appending", () => {
    it("safely appends new speech text without overwriting pre-typed answer", () => {
      let answerInput = "React uses a virtual DOM";
      const handleFinalTranscript = (speechText) => {
        if (!speechText || !speechText.trim()) return;
        const trimmedPrev = answerInput.trim();
        if (!trimmedPrev) {
          answerInput = speechText.trim();
        } else {
          answerInput = `${trimmedPrev} ${speechText.trim()}`;
        }
      };

      handleFinalTranscript("which makes DOM updates more efficient.");
      expect(answerInput).toBe(
        "React uses a virtual DOM which makes DOM updates more efficient.",
      );

      handleFinalTranscript("Fiber reconciliation optimizes renders.");
      expect(answerInput).toBe(
        "React uses a virtual DOM which makes DOM updates more efficient. Fiber reconciliation optimizes renders.",
      );
    });

    it("handles initial empty state cleanly without leading spaces", () => {
      let answerInput = "";
      const handleFinalTranscript = (speechText) => {
        if (!speechText || !speechText.trim()) return;
        const trimmedPrev = answerInput.trim();
        if (!trimmedPrev) {
          answerInput = speechText.trim();
        } else {
          answerInput = `${trimmedPrev} ${speechText.trim()}`;
        }
      };

      handleFinalTranscript("Microservices allow independent deployment.");
      expect(answerInput).toBe("Microservices allow independent deployment.");
    });
  });

  describe("Finite State Machine States", () => {
    it("defines all required finite states for voice interaction lifecycle", () => {
      expect(STT_STATES.IDLE).toBe("IDLE");
      expect(STT_STATES.REQUESTING_MIC).toBe("REQUESTING_MIC");
      expect(STT_STATES.CONNECTING_GEMINI).toBe("CONNECTING_GEMINI");
      expect(STT_STATES.LISTENING).toBe("LISTENING");
      expect(STT_STATES.STOPPING).toBe("STOPPING");
      expect(STT_STATES.BROWSER_SPEECH).toBe("BROWSER_SPEECH");
    });
  });

  describe("Strict English-Only Speech Filtering", () => {
    it("preserves valid technical English text and code symbols", () => {
      const input =
        "React uses Virtual DOM and fiber reconciliation with O(n) diffing; count => count + 1.";
      expect(filterEnglishOnly(input)).toBe(input);
    });

    it("strips non-English characters while retaining English words", () => {
      const input = "Hello world नमस्ते வணக்கம் مرحبا Привет React";
      expect(filterEnglishOnly(input)).toBe("Hello world React");
    });

    it("returns empty string when completely non-English text is received", () => {
      const input = "नमस्ते வணக்கம்";
      expect(filterEnglishOnly(input)).toBe("");
    });

    it("handles null or empty input safely", () => {
      expect(filterEnglishOnly("")).toBe("");
      expect(filterEnglishOnly(null)).toBe("");
      expect(filterEnglishOnly(undefined)).toBe("");
    });
  });
});
