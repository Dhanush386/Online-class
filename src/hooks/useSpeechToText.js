import { useState, useRef, useEffect, useCallback } from "react";
import {
  getGeminiLiveToken,
  prewarmGeminiLiveToken,
} from "../services/geminiLiveTokenService";
import {
  GeminiLiveService,
  filterEnglishOnly,
} from "../services/geminiLiveService";

// Finite state machine for voice interaction
export const STT_STATES = {
  IDLE: "IDLE",
  REQUESTING_MIC: "REQUESTING_MIC",
  CONNECTING_GEMINI: "CONNECTING_GEMINI",
  LISTENING: "LISTENING",
  STOPPING: "STOPPING",
  BROWSER_SPEECH: "BROWSER_SPEECH",
};

/**
 * Custom React hook for real-time speech-to-text.
 *
 * - Primary: Gemini Live API (AudioWorklet -> 16kHz PCM16 -> WebSocket)
 * - Fallback: Browser Native SpeechRecognition
 * - Audio thread: High-performance AudioWorkletNode
 *
 * @param {Object} options
 * @param {string} [options.track] - Current interview track (e.g. 'Frontend Development')
 * @param {Function} options.onFinalTranscript - Callback invoked when a confirmed final phrase is recognized
 * @param {Function} [options.onError] - Optional error handler callback
 */
export default function useSpeechToText({
  track,
  onFinalTranscript,
  onError,
} = {}) {
  const [state, setState] = useState(STT_STATES.IDLE);
  const [activeEngine, setActiveEngine] = useState("none"); // 'gemini-live' | 'browser-speech' | 'none'
  const [interimTranscript, setInterimTranscript] = useState("");
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("click"); // 'click' | 'push-to-talk'
  const [preferredEngine, setPreferredEngine] = useState(() => {
    try {
      return localStorage.getItem("mock_interview_preferred_engine") || "auto";
    } catch {
      return "auto";
    }
  });

  const handleSetPreferredEngine = useCallback((eng) => {
    setPreferredEngine(eng);
    try {
      localStorage.setItem("mock_interview_preferred_engine", eng);
    } catch {
      /* ignore */
    }
  }, []);

  // References
  const geminiLiveRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const workletNodeRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const isStoppingRef = useRef(false);
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  const onErrorRef = useRef(onError);
  const trackRef = useRef(track);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    trackRef.current = track;
  }, [track]);

  // Prewarm Gemini Live token as soon as hook mounts
  useEffect(() => {
    prewarmGeminiLiveToken();
  }, []);

  /**
   * Stop all audio streams and AudioContext
   */
  const stopAudioPipeline = useCallback(() => {
    if (workletNodeRef.current) {
      try {
        workletNodeRef.current.port.postMessage({ command: "stop" });
        workletNodeRef.current.disconnect();
      } catch (e) {
        console.debug("Worklet disconnect error:", e);
      }
      workletNodeRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try {
        audioContextRef.current.close();
      } catch (e) {
        console.debug("AudioContext close error:", e);
      }
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          /* ignore */
        }
      });
      mediaStreamRef.current = null;
    }

    if (geminiLiveRef.current) {
      geminiLiveRef.current.disconnect();
      geminiLiveRef.current = null;
    }

    setVolumeLevel(0);
  }, []);

  /**
   * Browser SpeechRecognition Fallback Setup
   */
  const startBrowserSpeechFallback = useCallback(async () => {
    stopAudioPipeline();
    setState(STT_STATES.BROWSER_SPEECH);
    setActiveEngine("browser-speech");
    setError("Gemini Live unavailable — Browser Speech recognition active");

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      const msg = "Speech recognition is not supported in this browser.";
      setError(msg);
      setState(STT_STATES.IDLE);
      setActiveEngine("none");
      if (onErrorRef.current) onErrorRef.current(new Error(msg));
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          const transcriptText = filterEnglishOnly(res[0]?.transcript || "");
          if (res.isFinal) {
            if (transcriptText.trim() && onFinalTranscriptRef.current) {
              onFinalTranscriptRef.current(transcriptText.trim());
            }
          } else {
            interim += transcriptText;
          }
        }
        setInterimTranscript(interim);
      };

      recognition.onerror = (event) => {
        console.warn("Browser SpeechRecognition error:", event.error);
        if (event.error !== "no-speech") {
          setError(`Speech error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        if (!isStoppingRef.current && state === STT_STATES.BROWSER_SPEECH) {
          try {
            recognition.start();
          } catch {
            /* ignore */
          }
        } else {
          setState(STT_STATES.IDLE);
          setActiveEngine("none");
          setInterimTranscript("");
        }
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Failed to start browser SpeechRecognition:", err);
      setError("Could not initialize speech recognition");
      setState(STT_STATES.IDLE);
      setActiveEngine("none");
    }
  }, [stopAudioPipeline, state]);

  /**
   * Start Listening with Gemini Live Primary Engine
   */
  const startListening = useCallback(async () => {
    isStoppingRef.current = false;
    setError(null);
    setInterimTranscript("");

    // If user explicitly preferred Browser Speech, start immediately with 0 latency
    if (preferredEngine === "browser-speech") {
      await startBrowserSpeechFallback();
      return;
    }

    // Safety watchdog: never allow connecting state to hang longer than 2.0s
    let watchdogTimer = setTimeout(() => {
      if (
        !isStoppingRef.current &&
        stateRef.current !== STT_STATES.LISTENING &&
        stateRef.current !== STT_STATES.BROWSER_SPEECH
      ) {
        console.warn(
          "Gemini connection exceeded 2.0s watchdog — triggering instant Browser Speech fallback",
        );
        startBrowserSpeechFallback();
      }
    }, 2000);

    // 1 & 2. Concurrently obtain mic stream and Gemini Live token
    let stream = mediaStreamRef.current;
    if (!stream || !stream.active) {
      setState(STT_STATES.REQUESTING_MIC);
    } else {
      setState(STT_STATES.CONNECTING_GEMINI);
    }

    let token = null;
    try {
      const micPromise =
        stream && stream.active
          ? Promise.resolve(stream)
          : navigator.mediaDevices.getUserMedia({
              audio: {
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            });

      const tokenPromise = getGeminiLiveToken();

      const [acquiredStream, acquiredToken] = await Promise.all([
        micPromise,
        tokenPromise,
      ]);

      stream = acquiredStream;
      mediaStreamRef.current = stream;
      token = acquiredToken;
    } catch (err) {
      clearTimeout(watchdogTimer);
      // If mic failed
      if (!stream || !stream.active) {
        console.error("Microphone access denied:", err);
        const msg =
          err?.name === "NotAllowedError"
            ? "Microphone permission was denied. Please allow microphone access in your browser settings."
            : "Could not access microphone.";
        setError(msg);
        setState(STT_STATES.IDLE);
        if (onErrorRef.current) onErrorRef.current(new Error(msg));
        return;
      }

      // If token failed, fall back to browser speech immediately
      console.warn(
        "Ephemeral token acquisition failed, switching to browser fallback:",
        err,
      );
      await startBrowserSpeechFallback();
      return;
    }

    setState(STT_STATES.CONNECTING_GEMINI);

    // 3. Connect to Gemini Live WebSocket
    try {
      const service = new GeminiLiveService();
      geminiLiveRef.current = service;

      await service.connect({
        token,
        track: trackRef.current,
        mode: "SMART",
        onInterimTranscript: (interim) => {
          setInterimTranscript(interim);
        },
        onFinalTranscript: (final) => {
          setInterimTranscript("");
          if (onFinalTranscriptRef.current && final.trim()) {
            onFinalTranscriptRef.current(final.trim());
          }
        },
        onError: (err) => {
          console.warn("Gemini Live error received, falling back:", err);
          startBrowserSpeechFallback();
        },
        onClose: () => {
          if (!isStoppingRef.current && stateRef.current === STT_STATES.LISTENING) {
            startBrowserSpeechFallback();
          }
        },
      });

      // 4. Initialize AudioContext and AudioWorkletNode
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioCtx;

      // Resume context if suspended by browser autoplay policy
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      await audioCtx.audioWorklet.addModule(
        "/audio-processors/pcm-recorder-processor.js",
      );

      const sourceNode = audioCtx.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(
        audioCtx,
        "pcm-recorder-processor",
      );
      workletNodeRef.current = workletNode;

      // Process audio chunks from AudioWorklet
      workletNode.port.onmessage = (event) => {
        const { type, buffer, volume } = event.data || {};
        if (type === "audio-chunk" && buffer) {
          service.sendAudioChunk(buffer);
          setVolumeLevel(volume || 0);
        }
      };

      sourceNode.connect(workletNode);
      // Connect to a dummy gain to keep the graph active without looping back to speakers
      const muteGain = audioCtx.createGain();
      muteGain.gain.value = 0;
      workletNode.connect(muteGain);
      muteGain.connect(audioCtx.destination);

      clearTimeout(watchdogTimer);
      if (
        stateRef.current === STT_STATES.BROWSER_SPEECH ||
        isStoppingRef.current
      ) {
        service.disconnect();
        return;
      }
      setState(STT_STATES.LISTENING);
      setActiveEngine("gemini-live");
    } catch (connErr) {
      clearTimeout(watchdogTimer);
      if (
        stateRef.current !== STT_STATES.BROWSER_SPEECH &&
        !isStoppingRef.current
      ) {
        console.warn(
          "Failed to connect to Gemini Live, falling back to Browser Speech:",
          connErr,
        );
        await startBrowserSpeechFallback();
      }
    }
  }, [preferredEngine, startBrowserSpeechFallback]);

  /**
   * Immediately switch to Browser Speech without waiting for Gemini
   */
  const switchToBrowserSpeech = useCallback(async () => {
    console.info("User switched to Browser Speech recognition");
    await startBrowserSpeechFallback();
  }, [startBrowserSpeechFallback]);

  /**
   * Stop Listening smoothly
   */
  const stopListening = useCallback(() => {
    isStoppingRef.current = true;
    setState(STT_STATES.STOPPING);

    // If browser speech was active
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (e) {
        console.debug("Recognition stop error:", e);
      }
      speechRecognitionRef.current = null;
    }

    // If worklet was active, flush remaining and disconnect
    if (workletNodeRef.current) {
      try {
        workletNodeRef.current.port.postMessage({ command: "stop" });
      } catch {
        /* ignore */
      }
    }

    if (geminiLiveRef.current) {
      geminiLiveRef.current.endActivity();
    }

    // Allow ~300ms for in-flight tokens to arrive before terminating socket
    setTimeout(() => {
      stopAudioPipeline();
      setState(STT_STATES.IDLE);
      setActiveEngine("none");
      setInterimTranscript("");
      isStoppingRef.current = false;
    }, 350);
  }, [stopAudioPipeline]);

  /**
   * Toggle listening state
   */
  const toggleListening = useCallback(() => {
    if (state === STT_STATES.LISTENING || state === STT_STATES.BROWSER_SPEECH) {
      stopListening();
    } else if (state === STT_STATES.IDLE) {
      startListening();
    }
  }, [state, startListening, stopListening]);

  /**
   * Reset any error or interim text
   */
  const resetTranscript = useCallback(() => {
    setInterimTranscript("");
    setError(null);
  }, []);

  // Cleanup on unmount or session change
  useEffect(() => {
    return () => {
      isStoppingRef.current = true;
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {
          /* ignore */
        }
      }
      stopAudioPipeline();
    };
  }, [stopAudioPipeline]);

  return {
    state,
    isListening:
      state === STT_STATES.LISTENING || state === STT_STATES.BROWSER_SPEECH,
    activeEngine,
    preferredEngine,
    setPreferredEngine: handleSetPreferredEngine,
    switchToBrowserSpeech,
    interimTranscript,
    volumeLevel,
    error,
    mode,
    setMode,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
  };
}
