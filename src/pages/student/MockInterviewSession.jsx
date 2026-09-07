import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Bot,
  User,
  Send,
  Loader2,
  Sparkles,
  ArrowLeft,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  LogOut,
  Video,
  VideoOff,
  Mic,
  Volume2,
  VolumeX,
  MicOff,
  RotateCcw,
  Lock,
  Clock,
  Maximize,
  Minimize,
  Camera,
  Sun,
  AlertTriangle,
  Monitor,
  Share2,
  PauseCircle,
} from "lucide-react";
import * as tf from "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import useXpAward from "../../hooks/useXpAward";
import MockInterviewReportView from "../../components/student/MockInterviewReportView";
import {
  submitInterviewTurn,
  generateInterviewReport,
} from "../../services/mockInterviewService";
import useSpeechToText, { STT_STATES } from "../../hooks/useSpeechToText";
import { filterEnglishOnly } from "../../services/geminiLiveService";
import { prewarmGeminiLiveToken } from "../../services/geminiLiveTokenService";

// ─────────────────────────────────────────────────────────────
// Real-Time Face & Lighting Detection Engine
// ─────────────────────────────────────────────────────────────
// Measure average pixel luminance (0 to 255) with central face-region bias
const checkFrameLuminance = (video, brightnessBoost = 1.0) => {
  if (!video || video.readyState < 2 || !video.videoWidth) return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 48;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    if (brightnessBoost !== 1.0) {
      ctx.filter = `brightness(${brightnessBoost})`;
    }
    ctx.drawImage(video, 0, 0, 64, 48);
    const data = ctx.getImageData(0, 0, 64, 48).data;
    let sum = 0;
    let centerSum = 0;
    let centerCount = 0;
    const len = data.length;
    for (let i = 0; i < len; i += 4) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sum += lum;
      const pixelIdx = i / 4;
      const x = pixelIdx % 64;
      const y = Math.floor(pixelIdx / 64);
      // Center 50% box where the face sits (x: 16-48, y: 12-36)
      if (x >= 16 && x < 48 && y >= 12 && y < 36) {
        centerSum += lum;
        centerCount++;
      }
    }
    const centerLum = centerCount > 0 ? centerSum / centerCount : sum / (len / 4);
    // Weight center 70%, overall frame 30% so dark room backgrounds don't falsely drag down face lighting
    return 0.7 * centerLum + 0.3 * (sum / (len / 4));
  } catch {
    return null;
  }
};

const analyzeFaceInVideo = async (video, aiModel, brightnessBoost = 1.0) => {
  if (!video || video.readyState < 2 || !video.videoWidth) {
    return { detected: false, status: "loading", luminance: 0 };
  }

  const luminance = checkFrameLuminance(video, brightnessBoost);

  // 1. Hardware-accelerated FaceDetector (Chrome / Edge)
  if (typeof window !== "undefined" && "FaceDetector" in window) {
    try {
      const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 3 });
      const faces = await detector.detect(video);
      if (faces && faces.length > 0) {
        // Face is definitively detected by browser's ML model
        return { detected: true, status: "detected", luminance: luminance ?? 50 };
      }
    } catch (e) {
      console.debug("FaceDetector error, falling back to COCO-SSD:", e);
    }
  }

  // 2. Fallback to COCO-SSD Person Detection
  if (aiModel) {
    try {
      const predictions = await aiModel.detect(video);
      const hasPerson = predictions.some((p) => p.class === "person" && p.score > 0.35);
      if (hasPerson) {
        return { detected: true, status: "detected", luminance: luminance ?? 50 };
      }
    } catch (e) {
      console.debug("COCO-SSD detection error:", e);
    }
  }

  // 3. If no face was detected, only classify as 'too_dark' if center-weighted luminance is truly pitch black (< 10)
  if (luminance !== null && luminance < 10) {
    return { detected: false, status: "too_dark", luminance };
  }

  // 4. Fallback if frame is adequately lit while model initializes
  if (luminance !== null && luminance >= 18) {
    return { detected: true, status: "detected", luminance };
  }

  return { detected: false, status: "no_face", luminance };
};

export default function MockInterviewSession() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { awardXp } = useXpAward();

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [turns, setTurns] = useState([]);
  const [report, setReport] = useState(null);
  const [currentTurnNumber, setCurrentTurnNumber] = useState(1);
  const [answerInput, setAnswerInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [error, setError] = useState(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isInterviewCompleted, setIsInterviewCompleted] = useState(false);

  // Video recording states
  const [cameraActive, setCameraActive] = useState(false);
  const [screenShared, setScreenShared] = useState(false);
  const [uploadingRecording, setUploadingRecording] = useState(false);
  const [localVideoUrl, setLocalVideoUrl] = useState(null);
  const [cameraBrightness, setCameraBrightness] = useState(1.0); // 1.0, 1.25, 1.5, 1.75

  // AI Face & Proctoring Models
  const [aiModel, setAiModel] = useState(null);
  const [isFaceDetected, setIsFaceDetected] = useState(true);
  const [faceStatus, setFaceStatus] = useState("detected"); // 'detected' | 'no_face' | 'too_dark'
  const faceLostCountRef = useRef(0);
  const faceCheckIntervalRef = useRef(null);
  const runCheckRef = useRef(null);

  // Pre-interview camera stream and face verification state
  const [preCameraStream, setPreCameraStream] = useState(null);
  const [preFaceStatus, setPreFaceStatus] = useState("idle"); // 'idle' | 'checking' | 'detected' | 'too_dark' | 'no_face'
  const preVideoRef = useRef(null);

  // Load AI Model for Face/Person Fallback
  useEffect(() => {
    let isMounted = true;
    const loadAiModel = async () => {
      try {
        await tf.ready();
        const model = await cocoSsd.load();
        if (isMounted) setAiModel(model);
      } catch (err) {
        console.warn("Could not load coco-ssd model:", err);
      }
    };
    loadAiModel();
    return () => {
      isMounted = false;
    };
  }, []);

  // Pre-interview face verification loop
  useEffect(() => {
    if (!preCameraStream || cameraActive) return;
    const interval = setInterval(async () => {
      if (!preVideoRef.current || preVideoRef.current.readyState < 2) return;
      const res = await analyzeFaceInVideo(preVideoRef.current, aiModel, cameraBrightness);
      if (res.status !== "loading") {
        setPreFaceStatus(res.status);
      }
    }, 800);
    return () => clearInterval(interval);
  }, [preCameraStream, cameraActive, aiModel, cameraBrightness]);

  // Active interview face verification loop
  useEffect(() => {
    if (
      !cameraActive ||
      !isFullscreen ||
      isInterviewCompleted ||
      session?.status === "completed"
    ) {
      if (faceCheckIntervalRef.current) clearInterval(faceCheckIntervalRef.current);
      return;
    }

    const runCheck = async () => {
      if (!videoRef.current) return;
      if (mediaStreamRef.current && videoRef.current.srcObject !== mediaStreamRef.current) {
        videoRef.current.srcObject = mediaStreamRef.current;
      }
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
      if (videoRef.current.readyState < 2) return;
      const res = await analyzeFaceInVideo(videoRef.current, aiModel, cameraBrightness);
      if (res.status === "loading") return;

      if (res.detected) {
        faceLostCountRef.current = 0;
        setIsFaceDetected(true);
        setFaceStatus("detected");
      } else {
        faceLostCountRef.current++;
        setFaceStatus(res.status);
        // Allow 5 checks (~6 seconds) grace period before showing blocking lockout
        if (faceLostCountRef.current >= 5) {
          setIsFaceDetected(false);
        }
      }
    };

    runCheckRef.current = runCheck;
    faceCheckIntervalRef.current = setInterval(runCheck, 1200);
    return () => {
      if (faceCheckIntervalRef.current) clearInterval(faceCheckIntervalRef.current);
    };
  }, [cameraActive, isFullscreen, aiModel, isInterviewCompleted, session?.status, cameraBrightness]);

  const handleStartCameraCheck = async () => {
    try {
      setPreFaceStatus("checking");
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: true,
      });
      mediaStreamRef.current = camStream;
      setPreCameraStream(camStream);
      if (preVideoRef.current) {
        preVideoRef.current.srcObject = camStream;
        preVideoRef.current.play().catch(() => {});
      }
    } catch (err) {
      alert("Please grant camera and microphone permissions in your browser to proceed with the mock interview.");
      console.error(err);
      setPreFaceStatus("idle");
    }
  };

  const handleStartInterview = async () => {
    if (preFaceStatus !== "detected") {
      alert(
        preFaceStatus === "too_dark"
          ? "Your camera environment appears too dark for the AI to detect your face. Please click 'Boost Brightness' or face a light source."
          : "Face not detected. Please ensure you are looking directly into the camera before starting."
      );
      return;
    }

    // 1. Request Screen Share for proctoring verification
    let scrStream = null;
    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      try {
        scrStream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: "monitor" },
          audio: true,
        });
        screenStreamRef.current = scrStream;
        setScreenShared(true);

        // Detect if candidate prematurely stops screen share
        scrStream.getVideoTracks()[0].onended = () => {
          console.warn("Screen sharing ended by candidate");
          setScreenShared(false);
        };
      } catch (scrErr) {
        console.info("Screen share prompt dismissed or not granted:", scrErr);
        const proceedWithoutScreen = confirm(
          "Screen sharing was not granted.\n\nSharing your screen provides official proctoring verification for your evaluation report.\n\nClick OK to proceed with camera-only, or Cancel to choose a screen to share."
        );
        if (!proceedWithoutScreen) {
          return;
        }
      }
    }

    // 2. Enter Fullscreen immediately on user gesture
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
          await document.documentElement.webkitRequestFullscreen();
        }
      }
    } catch (fsErr) {
      console.info("Fullscreen request note:", fsErr);
    }

    // 3. Ensure camera stream is active and has live video tracks
    let stream = mediaStreamRef.current || preCameraStream;
    const isStreamLive =
      stream &&
      stream.getVideoTracks().length > 0 &&
      stream.getVideoTracks().some((t) => t.readyState === "live");

    if (!isStreamLive) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          },
          audio: true,
        });
        mediaStreamRef.current = stream;
        setPreCameraStream(stream);
      } catch (camErr) {
        console.error("Could not re-acquire active camera stream:", camErr);
      }
    } else {
      mediaStreamRef.current = stream;
    }

    // Initialize composite screen + camera PIP recording (or direct camera if no screen)
    initCompositeRecording(stream, scrStream);
    setIsFaceDetected(true);
    setFaceStatus("detected");
    setCameraActive(true);
  };

  // Full Screen Mode state & controller
  const [isFullscreen, setIsFullscreen] = useState(
    () => typeof document !== "undefined" && Boolean(document.fullscreenElement),
  );

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange,
      );
    };
  }, []);

  const enterFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
          await document.documentElement.webkitRequestFullscreen();
        }
      }
    } catch (err) {
      console.warn("Fullscreen enter error:", err);
    }
  }, []);

  const isExamActive =
    cameraActive &&
    !isInterviewCompleted &&
    session?.status !== "completed";

  // Re-enter fullscreen on Enter or Space when lockout modal is shown
  useEffect(() => {
    if (isExamActive && !isFullscreen) {
      const handleKeyDown = (e) => {
        if (e.key === "Enter" || e.code === "Space") {
          e.preventDefault();
          enterFullscreen();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isExamActive, isFullscreen, enterFullscreen]);

  // Exit fullscreen cleanly on unmount
  useEffect(() => {
    return () => {
      if (typeof document !== "undefined" && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Question Text-to-Speech (TTS) & AI Reading State
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [activeSpeakingTurn, setActiveSpeakingTurn] = useState(null);
  const [speechVoices, setSpeechVoices] = useState([]);
  const lastSpokenTurnRef = useRef(null);
  const speechKeepAliveRef = useRef(null);

  // AI Voice Volume State (persisted, 0.1 to 1.0, default 1.0 = maximum volume)
  const [aiVolume, setAiVolume] = useState(() => {
    try {
      const saved = localStorage.getItem("mock_interview_ai_volume");
      return saved !== null ? parseFloat(saved) : 1.0;
    } catch {
      return 1.0;
    }
  });

  const handleAiVolumeChange = useCallback((newVol) => {
    const clamped = Math.min(1.0, Math.max(0.1, newVol));
    setAiVolume(clamped);
    try {
      localStorage.setItem("mock_interview_ai_volume", clamped.toString());
    } catch {
      /* ignore storage error */
    }
  }, []);

  // Prewarm Gemini Live token as soon as interview session is active
  useEffect(() => {
    prewarmGeminiLiveToken();
  }, []);

  // Load available speech synthesis voices for natural interviewer audio
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const updateVoices = () => {
      try {
        const v = window.speechSynthesis.getVoices();
        if (v && v.length > 0) {
          setSpeechVoices(v);
        }
      } catch (e) {
        console.debug("Error loading voices:", e);
      }
    };
    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // Auto-submit countdown (10s of silence) & speaking time extension
  const [silenceSecondsLeft, setSilenceSecondsLeft] = useState(10);
  const [timeExtendedNotice, setTimeExtendedNotice] = useState(false);

  // Extend speaking time by +10s (Space, Tab, or button click)
  const handleExtendTime = useCallback(() => {
    setSilenceSecondsLeft((prev) => prev + 10);
    setTimeExtendedNotice(true);
    setTimeout(() => setTimeExtendedNotice(false), 2500);
  }, []);

  // Non-destructive speech transcript appending (strictly English-only)
  const handleFinalTranscript = useCallback((speechText) => {
    const cleanEnglish = filterEnglishOnly(speechText);
    if (!cleanEnglish) return;
    setAnswerInput((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return cleanEnglish;
      return `${trimmed} ${cleanEnglish}`;
    });
  }, []);

  // Speech to Text Hook with Gemini Live + AudioWorklet + Browser Fallback
  const {
    state: sttState,
    isListening,
    activeEngine,
    preferredEngine,
    setPreferredEngine,
    switchToBrowserSpeech,
    interimTranscript,
    volumeLevel,
    error: sttError,
    mode: sttMode,
    setMode: setSttMode,
    startListening,
    stopListening,
    toggleListening,
  } = useSpeechToText({
    track: session?.track,
    onFinalTranscript: handleFinalTranscript,
  });

  // Stop AI speech and reset speaking state cleanly
  const stopAiSpeech = useCallback(() => {
    if (speechKeepAliveRef.current) {
      clearInterval(speechKeepAliveRef.current);
      speechKeepAliveRef.current = null;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsAiSpeaking(false);
    setActiveSpeakingTurn(null);
    setSilenceSecondsLeft(10);
  }, []);

  // Refs for stable callback identity
  const isListeningRef = useRef(isListening);
  isListeningRef.current = isListening;
  const isAiSpeakingRef = useRef(isAiSpeaking);
  isAiSpeakingRef.current = isAiSpeaking;
  const activeSpeakingTurnRef = useRef(activeSpeakingTurn);
  activeSpeakingTurnRef.current = activeSpeakingTurn;
  const aiVolumeRef = useRef(aiVolume);
  aiVolumeRef.current = aiVolume;
  const speechVoicesRef = useRef(speechVoices);
  speechVoicesRef.current = speechVoices;
  const stopListeningRef = useRef(stopListening);
  stopListeningRef.current = stopListening;

  // Read question aloud via Text-to-Speech
  const speakQuestion = useCallback(
    (turnNumber, questionText) => {
      if (!("speechSynthesis" in window) || !questionText) {
        setIsAiSpeaking(false);
        setActiveSpeakingTurn(null);
        return;
      }

      // If user toggles off current speaking turn
      if (isAiSpeakingRef.current && activeSpeakingTurnRef.current === turnNumber) {
        stopAiSpeech();
        return;
      }

      // Clear any ongoing speech & timer
      if (speechKeepAliveRef.current) {
        clearInterval(speechKeepAliveRef.current);
        speechKeepAliveRef.current = null;
      }

      // Pause microphone listening so speaker output isn't transcribed
      if (isListeningRef.current && stopListeningRef.current) {
        try {
          stopListeningRef.current();
        } catch (e) {
          console.debug("Error pausing mic for question reading:", e);
        }
      }

      setIsAiSpeaking(true);
      setActiveSpeakingTurn(turnNumber);
      lastSpokenTurnRef.current = turnNumber;

      const utterance = new SpeechSynthesisUtterance(questionText);
      utterance.volume = aiVolumeRef.current; // Full clarity volume (default 1.0 = 100%)
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      // Select loudest, most natural and clearest English voice
      const voices =
        speechVoicesRef.current && speechVoicesRef.current.length > 0
          ? speechVoicesRef.current
          : window.speechSynthesis.getVoices();

      const rankVoice = (v) => {
        if (!v || !v.lang || !v.lang.startsWith("en")) return -1;
        const name = v.name.toLowerCase();
        // High-clarity and amplified natural voices
        if (name.includes("online (natural)")) return 100;
        if (name.includes("natural")) return 90;
        if (name.includes("neural")) return 85;
        if (name.includes("google")) return 80;
        if (name.includes("aria") || name.includes("jenny")) return 75;
        if (name.includes("guy") || name.includes("christopher") || name.includes("eric")) return 70;
        if (name.includes("samantha")) return 65;
        if (name.includes("zira")) return 60;
        if (name.includes("mark")) return 50;
        return 30;
      };

      const sortedVoices = [...voices]
        .filter((v) => v.lang && v.lang.startsWith("en"))
        .sort((a, b) => rankVoice(b) - rankVoice(a));

      const naturalVoice = sortedVoices[0] || voices.find((v) => v.lang.startsWith("en"));

      if (naturalVoice) {
        utterance.voice = naturalVoice;
      }

      // Keep-alive interval for browsers with utterance timeout bug
      speechKeepAliveRef.current = setInterval(() => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        } else {
          if (speechKeepAliveRef.current) {
            clearInterval(speechKeepAliveRef.current);
            speechKeepAliveRef.current = null;
          }
        }
      }, 10000);

      const handleSpeechEnd = () => {
        if (speechKeepAliveRef.current) {
          clearInterval(speechKeepAliveRef.current);
          speechKeepAliveRef.current = null;
        }
        setIsAiSpeaking(false);
        setActiveSpeakingTurn(null);
        setSilenceSecondsLeft(10);
      };

      utterance.onend = handleSpeechEnd;
      utterance.onerror = (e) => {
        console.debug("Utterance error or cancelled:", e);
        handleSpeechEnd();
      };

      // In Chrome/Edge: cancel any previous utterance, ensure unpaused, then speak
      try {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          window.speechSynthesis.cancel();
        }
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch (err) {
        console.debug("Speech cancel/resume err:", err);
      }

      setTimeout(() => {
        try {
          if ("speechSynthesis" in window) {
            window.speechSynthesis.resume();
            window.speechSynthesis.speak(utterance);
          }
        } catch (speakErr) {
          console.error("SpeechSynthesis speak error:", speakErr);
          handleSpeechEnd();
        }
      }, 60);
    },
    [stopAiSpeech],
  );

  // Cancel question speech on unmount
  useEffect(() => {
    return () => {
      if (speechKeepAliveRef.current) {
        clearInterval(speechKeepAliveRef.current);
      }
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Cancel question speech when opening exit confirm modal
  useEffect(() => {
    if (showExitConfirm && "speechSynthesis" in window) {
      stopAiSpeech();
    }
  }, [showExitConfirm, stopAiSpeech]);

  // Cancel question reading and pause microphone immediately whenever candidate leaves full screen
  useEffect(() => {
    if (isExamActive && !isFullscreen) {
      stopAiSpeech();
      // Reset lastSpokenTurnRef so when they return to full screen, question reading will automatically resume
      lastSpokenTurnRef.current = null;
      if (isListeningRef.current && stopListeningRef.current) {
        try {
          stopListeningRef.current();
        } catch (e) {
          console.debug("Error pausing mic on fullscreen exit:", e);
        }
      }
    }
  }, [isExamActive, isFullscreen, stopAiSpeech]);

  // Automatically read question aloud when question loads on initial turn and in fullscreen
  useEffect(() => {
    if (
      !cameraActive ||
      !isFullscreen ||
      submitting ||
      generatingReport ||
      showExitConfirm ||
      !turns ||
      turns.length === 0
    ) {
      return;
    }

    const activeTurn = turns.find((t) => t.turn_number === currentTurnNumber);
    if (
      activeTurn &&
      activeTurn.question &&
      !activeTurn.student_answer &&
      lastSpokenTurnRef.current !== currentTurnNumber
    ) {
      speakQuestion(currentTurnNumber, activeTurn.question);
    }
  }, [
    cameraActive,
    isFullscreen,
    currentTurnNumber,
    turns,
    submitting,
    generatingReport,
    showExitConfirm,
    speakQuestion,
  ]);

  // Keyboard shortcut listener: Space or Tab to extend speaking time
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if setup modal or exit modal is active, out of fullscreen, already submitting, or AI is currently reading question
      if (
        !cameraActive ||
        !isFullscreen ||
        submitting ||
        generatingReport ||
        showExitConfirm ||
        isAiSpeaking
      ) {
        return;
      }

      if (e.code === "Space" || e.key === "Tab") {
        e.preventDefault();
        handleExtendTime();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    cameraActive,
    isFullscreen,
    submitting,
    generatingReport,
    showExitConfirm,
    isAiSpeaking,
    handleExtendTime,
  ]);

  // Auto-enable microphone ONLY after AI interviewer finishes speaking and in fullscreen
  useEffect(() => {
    if (
      cameraActive &&
      isFullscreen &&
      !isAiSpeaking &&
      !submitting &&
      !generatingReport &&
      !isListening &&
      sttState === STT_STATES.IDLE
    ) {
      const timer = setTimeout(() => {
        startListening().catch((err) =>
          console.debug("Auto-enable mic error:", err),
        );
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [
    cameraActive,
    isFullscreen,
    isAiSpeaking,
    currentTurnNumber,
    submitting,
    generatingReport,
    isListening,
    sttState,
    startListening,
  ]);

  // Reset silence timer on turn change
  useEffect(() => {
    setSilenceSecondsLeft(10);
    setTimeExtendedNotice(false);
  }, [currentTurnNumber]);

  // Reset silence timer whenever active speech is detected
  useEffect(() => {
    if (interimTranscript?.trim() || volumeLevel > 18) {
      setSilenceSecondsLeft((prev) => Math.max(prev, 10));
    }
  }, [interimTranscript, volumeLevel]);

  const chatEndRef = useRef(null);
  const videoRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const compositeCleanupRef = useRef(null);

  // Scroll chat to bottom
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [turns, submitting, generatingReport]);

  // Fetch session, turns, and report
  useEffect(() => {
    if (!sessionId || !profile?.id) return;

    async function loadSession() {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch Session
        const { data: sess, error: sessErr } = await supabase
          .from("mock_interview_sessions")
          .select("*")
          .eq("id", sessionId)
          .eq("student_id", profile.id)
          .single();

        if (sessErr || !sess) {
          throw new Error("Interview session not found or access denied.");
        }

        setSession(sess);

        // 2. Fetch Turns
        const { data: turnsData, error: turnsErr } = await supabase
          .from("mock_interview_turns")
          .select("*")
          .eq("session_id", sessionId)
          .order("turn_number", { ascending: true });

        if (turnsErr) throw turnsErr;
        setTurns(turnsData || []);

        // If completed, fetch report
        if (sess.status === "completed") {
          const { data: repData } = await supabase
            .from("mock_interview_reports")
            .select("*")
            .eq("session_id", sessionId)
            .maybeSingle();

          if (repData) {
            setReport(repData);
          }
        } else {
          // Determine active turn number
          const latestTurn = turnsData?.[turnsData.length - 1];
          if (latestTurn) {
            setCurrentTurnNumber(latestTurn.turn_number);
          }
        }
      } catch (err) {
        console.error("Error loading interview session:", err);
        setError(err.message || "Failed to load session.");
      } finally {
        setLoading(false);
      }
    }

    loadSession();
  }, [sessionId, profile?.id]);

  // Start composite screen + camera recorder
  const initCompositeRecording = (camStream, scrStream) => {
    recordedChunksRef.current = [];

    if (!scrStream) {
      // Fallback: Record Camera directly
      try {
        const mimeType = MediaRecorder.isTypeSupported(
          "video/webm;codecs=vp8,opus",
        )
          ? "video/webm;codecs=vp8,opus"
          : "video/webm";
        const recorder = new MediaRecorder(camStream, { mimeType });
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };
        recorder.start(2000);
        mediaRecorderRef.current = recorder;
      } catch (e) {
        console.warn("Recorder init error:", e);
      }
      return;
    }

    // Composite Screen + Camera PIP
    const screenVid = document.createElement("video");
    screenVid.srcObject = scrStream;
    screenVid.muted = true;
    screenVid.playsInline = true;
    screenVid.play().catch((e) => console.debug(e));

    const camVid = document.createElement("video");
    camVid.srcObject = camStream;
    camVid.muted = true;
    camVid.playsInline = true;
    camVid.play().catch((e) => console.debug(e));

    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext("2d");

    let isRecording = true;

    const renderLoop = () => {
      if (!isRecording) return;

      // 1. Draw Screen feed full canvas
      try {
        ctx.drawImage(screenVid, 0, 0, canvas.width, canvas.height);
      } catch {
        ctx.fillStyle = "#0a0d14";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // 2. Draw Camera PIP in bottom-right corner
      const pipW = 280;
      const pipH = 210;
      const pipX = canvas.width - pipW - 20;
      const pipY = canvas.height - pipH - 20;

      ctx.fillStyle = "#000000";
      ctx.fillRect(pipX - 2, pipY - 2, pipW + 4, pipH + 4);
      ctx.strokeStyle = "#6366f1";
      ctx.lineWidth = 3;
      ctx.strokeRect(pipX - 2, pipY - 2, pipW + 4, pipH + 4);

      try {
        ctx.drawImage(camVid, pipX, pipY, pipW, pipH);
      } catch (camDrawErr) {
        console.debug("Camera frame draw error:", camDrawErr);
      }

      // Badge on PIP
      ctx.fillStyle = "rgba(239, 68, 68, 0.9)";
      ctx.fillRect(pipX + 8, pipY + 8, 70, 20);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px sans-serif";
      ctx.fillText("● REC ON", pipX + 14, pipY + 22);

      requestAnimationFrame(renderLoop);
    };

    renderLoop();

    const compositeStream = canvas.captureStream(25);

    // Merge audio tracks
    camStream.getAudioTracks().forEach((t) => compositeStream.addTrack(t));
    scrStream.getAudioTracks().forEach((t) => compositeStream.addTrack(t));

    try {
      const mimeType = MediaRecorder.isTypeSupported(
        "video/webm;codecs=vp8,opus",
      )
        ? "video/webm;codecs=vp8,opus"
        : "video/webm";
      const recorder = new MediaRecorder(compositeStream, { mimeType });
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      recorder.start(2000);
      mediaRecorderRef.current = recorder;
    } catch (e) {
      console.warn("Composite recorder start error:", e);
    }

    compositeCleanupRef.current = () => {
      isRecording = false;
    };
  };

  // Cleanup media streams upon exit
  useEffect(() => {
    return () => {
      if (compositeCleanupRef.current) compositeCleanupRef.current();
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        try {
          mediaRecorderRef.current.stop();
        } catch (err) {
          console.debug("Media recorder stop error:", err);
        }
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Ensure stream is attached to video element when it mounts
  useEffect(() => {
    if (cameraActive && mediaStreamRef.current && videoRef.current) {
      if (videoRef.current.srcObject !== mediaStreamRef.current) {
        videoRef.current.srcObject = mediaStreamRef.current;
      }
      videoRef.current
        .play()
        .catch((e) => console.debug("Video play error:", e));
    }
  }, [cameraActive]);

  // Finalize & Upload Video Recording (24-Hour Expiration)
  const uploadInterviewVideo = async () => {
    if (!mediaRecorderRef.current || recordedChunksRef.current.length === 0)
      return null;

    return new Promise((resolve) => {
      try {
        const performUpload = async () => {
          try {
            setUploadingRecording(true);
            const blob = new Blob(recordedChunksRef.current, {
              type: "video/webm",
            });

            // Instant local playback URL for zero-latency review
            const localBlobUrl = URL.createObjectURL(blob);
            setLocalVideoUrl(localBlobUrl);

            const fileName = `${profile.id}/${session.id}_${Date.now()}.webm`;

            const { error: upErr } = await supabase.storage
              .from("interview-recordings")
              .upload(fileName, blob, {
                contentType: "video/webm",
                upsert: true,
              });

            let finalUrl = localBlobUrl;

            if (!upErr) {
              // Try creating signed URL first (24h retention) to guarantee access even for private buckets
              const { data: signedData } = await supabase.storage
                .from("interview-recordings")
                .createSignedUrl(fileName, 86400);

              if (signedData?.signedUrl) {
                finalUrl = signedData.signedUrl;
              } else {
                const {
                  data: { publicUrl },
                } = supabase.storage
                  .from("interview-recordings")
                  .getPublicUrl(fileName);
                if (publicUrl) finalUrl = publicUrl;
              }

              // 24 Hours retention from now
              const expiresAt = new Date(
                Date.now() + 24 * 60 * 60 * 1000,
              ).toISOString();

              await supabase
                .from("mock_interview_sessions")
                .update({
                  recording_url: finalUrl,
                  recording_expires_at: expiresAt,
                })
                .eq("id", session.id);
            } else {
              console.warn("Storage upload note, using local blob:", upErr);
            }

            // Stop camera & screen tracks cleanly
            if (mediaStreamRef.current) {
              mediaStreamRef.current.getTracks().forEach((t) => t.stop());
            }
            if (screenStreamRef.current) {
              screenStreamRef.current.getTracks().forEach((t) => t.stop());
            }

            resolve(finalUrl);
          } catch (e) {
            console.error("Error during video upload:", e);
            resolve(null);
          } finally {
            setUploadingRecording(false);
          }
        };

        if (mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.onstop = () => {
            performUpload();
          };
          mediaRecorderRef.current.stop();
        } else {
          performUpload();
        }
      } catch (err) {
        console.error("Video upload failed:", err);
        resolve(null);
      }
    });
  };

  // Handle Answer Submission
  const handleSubmitAnswer = async (e) => {
    e?.preventDefault();
    if (submitting || generatingReport || !session || isAiSpeaking) return;

    // Auto-submit even if empty by substituting default fallback text
    const trimmed = answerInput.trim();
    const answerToSubmit = trimmed || "No verbal response provided.";

    if (isListening) {
      stopListening();
    }
    setSilenceSecondsLeft(10);
    setTimeExtendedNotice(false);

    setSubmitting(true);
    setError(null);

    try {
      const activeTurn = turns.find((t) => t.turn_number === currentTurnNumber);
      if (!activeTurn) throw new Error("Active turn not found");

      const result = await submitInterviewTurn({
        sessionId: session.id,
        track: session.track,
        turnNumber: currentTurnNumber,
        totalQuestions: session.question_count || 5,
        currentQuestion: activeTurn.question,
        answer: answerToSubmit,
      });

      // Update local turns state
      const updatedTurns = turns.map((t) => {
        if (t.turn_number === currentTurnNumber) {
          return {
            ...t,
            student_answer: answerToSubmit,
            ai_feedback: result.feedback,
          };
        }
        return t;
      });

      if (!result.isCompleted && result.nextQuestion) {
        updatedTurns.push({
          session_id: session.id,
          turn_number: result.nextTurnNumber,
          question: result.nextQuestion,
          student_answer: null,
          ai_feedback: null,
        });
        setCurrentTurnNumber(result.nextTurnNumber);
        setTurns(updatedTurns);
        setAnswerInput("");
        setSubmitting(false);

        // Promptly read the next question aloud
        speakQuestion(result.nextTurnNumber, result.nextQuestion);
        return;
      }

      setTurns(updatedTurns);
      setAnswerInput("");

      // If completed, immediately update status to completed and generate report
      if (result.isCompleted) {
        setIsInterviewCompleted(true);
        setSession((prev) => ({
          ...prev,
          status: "completed",
        }));
        setSubmitting(false);
        setGeneratingReport(true);

        try {
          const uploadTimeout = new Promise((res) =>
            setTimeout(() => res(null), 5000),
          );
          await Promise.race([uploadInterviewVideo(), uploadTimeout]);
        } catch (vErr) {
          console.warn("Video upload completed or skipped:", vErr);
        }

        await generateFinalReport(updatedTurns);
        return;
      }
    } catch (err) {
      console.error("Failed to submit answer:", err);
      setError(
        err.message || "Failed to submit your response. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // 10-Second Silence Auto-Submit Countdown
  const handleSubmitAnswerRef = useRef(handleSubmitAnswer);
  handleSubmitAnswerRef.current = handleSubmitAnswer;
  const isSpeakingRef = useRef(false);
  isSpeakingRef.current =
    Boolean(interimTranscript?.trim()) || volumeLevel > 18;

  useEffect(() => {
    // Only run countdown timer during active interview when in fullscreen and ready for speech
    if (
      !cameraActive ||
      !isFullscreen ||
      !isFaceDetected ||
      submitting ||
      generatingReport ||
      showExitConfirm ||
      isAiSpeaking
    ) {
      return;
    }

    const interval = setInterval(() => {
      // If student is speaking right now, keep silence timer reset
      if (isSpeakingRef.current) {
        setSilenceSecondsLeft((prev) => Math.max(prev, 10));
        return;
      }

      // Count down silence timer continuously even if answer is empty
      setSilenceSecondsLeft((prev) => {
        if (prev <= 1) {
          handleSubmitAnswerRef.current();
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [
    cameraActive,
    isFullscreen,
    isFaceDetected,
    submitting,
    generatingReport,
    showExitConfirm,
    isAiSpeaking,
  ]);

  // Allow concluding early to view full performance scorecard
  const handleEarlyConclude = async () => {
    if (submitting || generatingReport || !session) return;
    const answeredTurns = turns.filter(
      (t) => t.student_answer && t.student_answer.trim().length > 0,
    );
    if (answeredTurns.length === 0) {
      setShowExitConfirm(true);
      return;
    }
    setSubmitting(true);
    try {
      await uploadInterviewVideo();
      await generateFinalReport(turns);
    } catch (err) {
      console.error("Failed to conclude early:", err);
      setError("Failed to conclude session. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Generate Final Report
  const generateFinalReport = async (latestTurns = turns) => {
    setGeneratingReport(true);
    setError(null);
    try {
      const { report: finalReport, session: updatedSession } =
        await generateInterviewReport({
          sessionId: session.id,
          track: session.track,
          turns: latestTurns,
        });

      setReport(finalReport);
      setSession(
        updatedSession || {
          ...session,
          status: "completed",
          overall_score: finalReport.overall_score,
        },
      );

      // Award XP for completion
      await awardXp({
        eventType: "mock_interview_complete",
        referenceId: session.id,
        moduleType: "interview",
        reason: `Completed AI Mock Interview (${session.track})`,
        metadata: {
          track: session.track,
          score:
            updatedSession?.overall_score || finalReport.overall_score || 80,
          questions: session.question_count,
        },
      });
    } catch (err) {
      console.error("Failed to generate report:", err);
      setError(
        "Interview completed, but failed to load feedback report. Please refresh.",
      );
    } finally {
      setGeneratingReport(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "60vh",
          gap: "1rem",
          color: "var(--text-muted)",
        }}
      >
        <Sparkles
          className="animate-pulse"
          size={48}
          color="var(--primary-500)"
        />
        <h2
          style={{
            fontSize: "1.25rem",
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          Loading Mock Interview...
        </h2>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div
        className="glass-card"
        style={{
          maxWidth: 600,
          margin: "3rem auto",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <AlertCircle
          size={48}
          color="#ef4444"
          style={{ margin: "0 auto 1rem" }}
        />
        <h2
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: "0.5rem",
          }}
        >
          Unable to Load Session
        </h2>
        <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
          {error}
        </p>
        <button
          className="btn-primary"
          onClick={() => navigate("/student/mock-interview")}
        >
          Return to Interview Hub
        </button>
      </div>
    );
  }

  // If report exists and session is completed, render report view
  if (session?.status === "completed" && report) {
    return (
      <MockInterviewReportView
        session={{
          ...session,
          recording_url: localVideoUrl || session.recording_url,
        }}
        report={report}
        onBackToHub={() => navigate("/student/mock-interview")}
        onStartNew={() => navigate("/student/mock-interview")}
      />
    );
  }

  // If completed and compiling report, render prominent Interview Status screen
  if (isInterviewCompleted || generatingReport || session?.status === "completed") {
    return (
      <div style={{ maxWidth: 680, margin: "2.5rem auto", padding: "0 1.5rem" }}>
        <div
          className="glass-card"
          style={{
            padding: "2.5rem 2rem",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1.5rem",
          }}
        >
          {/* Status Badge & Icon */}
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: "50%",
              background:
                "linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(99, 102, 241, 0.2))",
              border: "2px solid #10b981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#10b981",
              boxShadow: "0 0 25px rgba(16, 185, 129, 0.25)",
            }}
          >
            <CheckCircle2 size={40} />
          </div>

          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "0.82rem",
                fontWeight: 700,
                padding: "0.25rem 0.85rem",
                borderRadius: "20px",
                background: "rgba(16, 185, 129, 0.15)",
                color: "#10b981",
                border: "1px solid rgba(16, 185, 129, 0.35)",
                boxShadow: "0 0 10px rgba(16, 185, 129, 0.12)",
                marginBottom: "0.75rem",
              }}
            >
              <CheckCircle2 size={14} /> Status: Interview Completed
            </div>
            <h2
              style={{
                fontSize: "1.75rem",
                fontWeight: 800,
                color: "var(--text-primary)",
                margin: 0,
              }}
            >
              Interview Finished!
            </h2>
            <p
              style={{
                color: "var(--text-muted)",
                marginTop: "0.5rem",
                fontSize: "0.92rem",
                lineHeight: 1.5,
              }}
            >
              All {session?.question_count || totalQuestions} questions in the{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                {session?.track}
              </strong>{" "}
              interview track have been answered.
            </p>
          </div>

          {/* Status Checklist Tracker */}
          <div
            style={{
              width: "100%",
              background: "var(--bg-secondary)",
              borderRadius: "12px",
              padding: "1.25rem",
              border: "1px solid var(--sidebar-border)",
              display: "flex",
              flexDirection: "column",
              gap: "0.85rem",
              textAlign: "left",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "0.88rem",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  color: "var(--text-primary)",
                  fontWeight: 600,
                }}
              >
                <CheckCircle2 size={16} color="#10b981" /> Spoken Responses Recorded
              </span>
              <span style={{ color: "#10b981", fontWeight: 700 }}>
                {session?.question_count || totalQuestions}/{session?.question_count || totalQuestions} Completed
              </span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "0.88rem",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  color: "var(--text-primary)",
                  fontWeight: 600,
                }}
              >
                <CheckCircle2 size={16} color="#10b981" /> Media Session Finalized
              </span>
              <span style={{ color: "#10b981", fontWeight: 700 }}>Done</span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "0.88rem",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  color: "var(--text-primary)",
                  fontWeight: 600,
                }}
              >
                <Loader2
                  size={16}
                  className="animate-spin"
                  color="var(--primary-600)"
                />{" "}
                AI Performance Report & Scorecard
              </span>
              <span style={{ color: "var(--primary-600)", fontWeight: 700 }}>
                Generating...
              </span>
            </div>
          </div>

          <p
            style={{
              fontSize: "0.82rem",
              color: "var(--text-muted)",
              margin: 0,
              fontStyle: "italic",
            }}
          >
            Evaluating conceptual depth, technical correctness, and computing category scores...
          </p>
        </div>
      </div>
    );
  }

  // Mandatory Camera & Face Verification Pre-Interview Screen
  if (!cameraActive) {
    return (
      <div style={{ maxWidth: 660, margin: "2rem auto", padding: "0 1rem" }}>
        <div
          className="glass-card"
          style={{
            padding: "2.5rem 2rem",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1.25rem",
          }}
        >
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: "20px",
              background:
                "linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(16, 185, 129, 0.2))",
              border: "2px solid rgba(99, 102, 241, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--primary-600)",
            }}
          >
            <Video size={34} />
          </div>

          <div>
            <h2
              style={{
                fontSize: "1.45rem",
                fontWeight: 800,
                color: "var(--text-primary)",
                marginBottom: "0.4rem",
              }}
            >
              Face & Proctoring Verification
            </h2>
            <p
              style={{
                color: "var(--text-muted)",
                fontSize: "0.9rem",
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              To maintain academic integrity and generate your official evaluation
              scorecard, your face must be verified before starting and remain
              visible throughout the interview.
            </p>
          </div>

          {/* Live Camera Viewfinder & Face Detection Feedback */}
          {preCameraStream ? (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.85rem" }}>
              <div
                style={{
                  width: "100%",
                  maxWidth: 440,
                  aspectRatio: "4/3",
                  borderRadius: "14px",
                  overflow: "hidden",
                  background: "#0a0d14",
                  position: "relative",
                  border:
                    preFaceStatus === "detected"
                      ? "3px solid #10b981"
                      : preFaceStatus === "too_dark"
                      ? "3px solid #f59e0b"
                      : "3px solid #ef4444",
                  boxShadow:
                    preFaceStatus === "detected"
                      ? "0 0 20px rgba(16, 185, 129, 0.25)"
                      : preFaceStatus === "too_dark"
                      ? "0 0 20px rgba(245, 158, 11, 0.25)"
                      : "0 0 20px rgba(239, 68, 68, 0.25)",
                }}
              >
                <video
                  ref={(el) => {
                    preVideoRef.current = el;
                    if (el && preCameraStream && el.srcObject !== preCameraStream) {
                      el.srcObject = preCameraStream;
                      el.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: "scaleX(-1)",
                    filter: `brightness(${cameraBrightness}) contrast(1.05)`,
                  }}
                />

                {/* Brightness Booster Button */}
                <button
                  type="button"
                  onClick={() => setCameraBrightness((b) => (b >= 1.75 ? 1.0 : Number((b + 0.25).toFixed(2))))}
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    padding: "0.3rem 0.65rem",
                    borderRadius: "8px",
                    fontSize: "0.74rem",
                    fontWeight: 700,
                    background: cameraBrightness > 1 ? "rgba(245, 158, 11, 0.95)" : "rgba(0,0,0,0.65)",
                    color: "#ffffff",
                    border: "1px solid rgba(255,255,255,0.25)",
                    cursor: "pointer",
                    backdropFilter: "blur(6px)",
                    zIndex: 2,
                  }}
                  title="Boost camera exposure / brightness if image is dark"
                >
                  <Sun size={13} /> {cameraBrightness > 1 ? `Boosted ${Math.round(cameraBrightness * 100)}%` : "Boost Brightness"}
                </button>

                {/* Real-time Status Badge Overlay */}
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    padding: "0.3rem 0.65rem",
                    borderRadius: "8px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    background:
                      preFaceStatus === "detected"
                        ? "rgba(16, 185, 129, 0.9)"
                        : preFaceStatus === "too_dark"
                        ? "rgba(245, 158, 11, 0.95)"
                        : "rgba(239, 68, 68, 0.95)",
                    color: "#ffffff",
                    backdropFilter: "blur(6px)",
                  }}
                >
                  {preFaceStatus === "detected" ? (
                    <>
                      <CheckCircle2 size={13} /> Face Verified & Centered
                    </>
                  ) : preFaceStatus === "too_dark" ? (
                    <>
                      <Sun size={13} /> Lighting Too Dark
                    </>
                  ) : preFaceStatus === "checking" ? (
                    <>
                      <Loader2 size={13} className="animate-spin" /> Verifying Face...
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={13} /> Face Not Detected
                    </>
                  )}
                </div>

                <div
                  style={{
                    position: "absolute",
                    bottom: 10,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "rgba(0,0,0,0.75)",
                    padding: "0.3rem 0.75rem",
                    borderRadius: "20px",
                    color: "#fff",
                    fontSize: "0.74rem",
                    whiteSpace: "nowrap",
                  }}
                >
                  {preFaceStatus === "detected"
                    ? "Looking great! Ready to start."
                    : preFaceStatus === "too_dark"
                    ? "Turn on lights or face a light source"
                    : "Position your face in center of frame"}
                </div>
              </div>

              {/* Status explanation alert */}
              <div
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  borderRadius: "10px",
                  fontSize: "0.84rem",
                  textAlign: "left",
                  background:
                    preFaceStatus === "detected"
                      ? "rgba(16, 185, 129, 0.1)"
                      : preFaceStatus === "too_dark"
                      ? "rgba(245, 158, 11, 0.1)"
                      : "rgba(239, 68, 68, 0.1)",
                  border: `1px solid ${
                    preFaceStatus === "detected"
                      ? "rgba(16, 185, 129, 0.3)"
                      : preFaceStatus === "too_dark"
                      ? "rgba(245, 158, 11, 0.3)"
                      : "rgba(239, 68, 68, 0.3)"
                  }`,
                  color:
                    preFaceStatus === "detected"
                      ? "#10b981"
                      : preFaceStatus === "too_dark"
                      ? "#d97706"
                      : "#ef4444",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                {preFaceStatus === "detected" ? (
                  <>
                    <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                    <span>
                      Face recognized in good lighting. You will be prompted to select a screen to share when starting.
                    </span>
                  </>
                ) : preFaceStatus === "too_dark" ? (
                  <>
                    <Sun size={16} style={{ flexShrink: 0 }} />
                    <span>
                      <strong>Camera feed is too dark:</strong> Please turn on your room lights or face a window/lamp so your face is clearly identifiable.
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                    <span>
                      <strong>Face missing:</strong> Please ensure your webcam is uncovered and you are facing the screen. The interview cannot start without face detection.
                    </span>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* First-step Enable Camera Box */
            <div
              style={{
                width: "100%",
                padding: "1.25rem",
                background: "var(--bg-elevated)",
                borderRadius: "12px",
                border: "1px solid var(--sidebar-border)",
                textAlign: "left",
                fontSize: "0.85rem",
                color: "var(--text-secondary)",
                display: "flex",
                flexDirection: "column",
                gap: "0.6rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <CheckCircle size={16} color="#10b981" /> Ensure your face is centered and well-lit.
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Monitor size={16} color="#6366f1" /> Screen sharing prompt will appear when starting to record full proctoring.
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Maximize size={16} color="#10b981" /> Full screen mode opens automatically for distraction-free environment.
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <CheckCircle size={16} color="#10b981" /> Video is recorded securely and auto-deleted after 24 hours.
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              width: "100%",
              marginTop: "0.5rem",
            }}
          >
            <button
              onClick={() => navigate("/student/mock-interview")}
              className="btn-secondary"
              style={{ flex: 1, padding: "0.75rem" }}
            >
              Cancel
            </button>

            {!preCameraStream ? (
              <button
                onClick={handleStartCameraCheck}
                className="btn-primary"
                style={{
                  flex: 2,
                  padding: "0.75rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                }}
              >
                <Camera size={18} /> Enable Camera & Check Face
              </button>
            ) : (
              <button
                onClick={handleStartInterview}
                disabled={preFaceStatus !== "detected"}
                className={preFaceStatus === "detected" ? "btn-primary" : "btn-secondary"}
                style={{
                  flex: 2,
                  padding: "0.75rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  cursor: preFaceStatus === "detected" ? "pointer" : "not-allowed",
                  opacity: preFaceStatus === "detected" ? 1 : 0.6,
                }}
                title={
                  preFaceStatus !== "detected"
                    ? "Face verification required before entering interview"
                    : "Starts fullscreen mock interview and prompts for screen share"
                }
              >
                {preFaceStatus === "detected" ? (
                  <>
                    <Maximize size={18} /> Share Screen & Start Interview
                  </>
                ) : (
                  <>
                    <Lock size={16} /> Face Verification Required to Start
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const totalQuestions = session?.question_count || 5;
  const progressPercent = Math.min(
    100,
    Math.round(((currentTurnNumber - 1) / totalQuestions) * 100),
  );

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "0.85rem",
        paddingBottom: "1.5rem",
      }}
    >
      {/* Top Header Card */}
      <div className="glass-card" style={{ padding: "0.85rem 1.25rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "12px",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                boxShadow: "0 4px 14px rgba(99, 102, 241, 0.35)",
              }}
            >
              <Bot size={24} />
            </div>
            <div>
              <h2
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  margin: 0,
                }}
              >
                {session?.track} Mock Interview
              </h2>
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Question {currentTurnNumber} of {totalQuestions}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: 140,
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "var(--text-muted)",
                }}
              >
                <span>Progress</span>
                <span>{progressPercent}%</span>
              </div>
              <div
                style={{
                  height: 6,
                  background: "var(--bg-elevated)",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progressPercent}%`,
                    background: "var(--primary-500)",
                    borderRadius: 3,
                    transition: "width 0.3s",
                  }}
                />
              </div>
            </div>

            {isFullscreen ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.35rem 0.8rem",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  borderRadius: "20px",
                  background: "rgba(16, 185, 129, 0.12)",
                  color: "#10b981",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                }}
                title="Full screen mode is strictly enforced until interview completion"
              >
                <Lock size={13} /> Full Screen Enforced
              </span>
            ) : (
              <button
                type="button"
                onClick={enterFullscreen}
                className="btn-primary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.35rem 0.8rem",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  background: "#ef4444",
                  color: "#ffffff",
                  border: "none",
                  cursor: "pointer",
                  animation: "pulse 1.5s infinite",
                }}
                title="Click to return to full screen mode"
              >
                <Maximize size={14} /> Return to Full Screen
              </button>
            )}

            {isExamActive ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.35rem 0.8rem",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  borderRadius: "20px",
                  background: "rgba(99, 102, 241, 0.12)",
                  color: "var(--primary-400)",
                  border: "1px solid rgba(99, 102, 241, 0.25)",
                }}
                title="Exam in progress: Full screen mode is enforced until completion"
              >
                <Lock size={13} /> Active Exam
              </span>
            ) : (
              <button
                onClick={() => setShowExitConfirm(true)}
                className="btn-secondary"
                style={{
                  padding: "0.45rem 0.85rem",
                  fontSize: "0.85rem",
                  color: "#ef4444",
                }}
                title="Exit Interview"
              >
                <LogOut size={16} /> Exit
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Camera & Retention Disclaimer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.5rem",
          padding: "0.45rem 0.85rem",
          borderRadius: "8px",
          background: "var(--bg-elevated)",
          border: "1px solid var(--sidebar-border)",
          fontSize: "0.78rem",
          color: "var(--text-muted)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              background: cameraActive
                ? "rgba(239, 68, 68, 0.15)"
                : "rgba(148, 163, 184, 0.15)",
              color: cameraActive ? "#ef4444" : "var(--text-muted)",
              fontWeight: 700,
              fontSize: "0.75rem",
              padding: "0.2rem 0.5rem",
              borderRadius: "6px",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: cameraActive ? "#ef4444" : "#94a3b8",
                animation: cameraActive ? "pulse 1.5s infinite" : "none",
              }}
            />
            {cameraActive
              ? screenShared
                ? "SCREEN + CAM REC"
                : "CAM REC ON"
              : "CAMERA OFF"}
          </div>
          <span>
            Interview screen & video are recorded and auto-deleted after{" "}
            <strong>24 hours</strong>.
          </span>
        </div>

        {uploadingRecording && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              color: "var(--primary-400)",
              fontWeight: 600,
            }}
          >
            <Loader2 size={14} className="animate-spin" /> Uploading
            recording...
          </div>
        )}
      </div>

      {/* Main Interview Grid with Camera Preview */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: cameraActive ? "1fr 280px" : "1fr",
          gap: "1.25rem",
          alignItems: "start",
        }}
      >
        {/* Left Column: Interview Stage (Questions + Integrated Speech Answer Panel) */}
        <div
          className="glass-card"
          style={{
            padding: "1.5rem 1.65rem 1.65rem",
            minHeight: "580px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "1.15rem",
          }}
        >
          {/* Scrollable Questions and Dialog History */}
          <div
            style={{
              minHeight: "150px",
              maxHeight: "320px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              paddingRight: "0.5rem",
              flex: "1 1 auto",
            }}
          >
          {turns.map((turn) => (
            <div
              key={turn.turn_number}
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              {/* AI Question Bubble */}
              <div style={{ display: "flex", gap: "0.85rem", maxWidth: "85%" }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                >
                  <Bot size={18} />
                </div>
                <div
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--sidebar-border)",
                    borderRadius: "0 16px 16px 16px",
                    padding: "1rem 1.25rem",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "0.35rem",
                      gap: "0.5rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: "var(--primary-600)",
                          textTransform: "uppercase",
                        }}
                      >
                        Interviewer • Question {turn.turn_number}
                      </span>
                      {isAiSpeaking &&
                        turn.turn_number === currentTurnNumber && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.35rem",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              color: "#6366f1",
                              background: "rgba(99, 102, 241, 0.12)",
                              padding: "0.15rem 0.55rem",
                              borderRadius: "10px",
                            }}
                          >
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "2px",
                                height: "10px",
                              }}
                            >
                              {[0.4, 0.9, 0.5, 1.0, 0.6].map((factor, i) => (
                                <span
                                  key={i}
                                  className="animate-pulse"
                                  style={{
                                    width: "2px",
                                    height: `${Math.round(10 * factor)}px`,
                                    background: "#6366f1",
                                    borderRadius: "1px",
                                    animationDelay: `${i * 0.12}s`,
                                  }}
                                />
                              ))}
                            </span>
                            Speaking Question...
                          </span>
                        )}
                    </div>
                    {"speechSynthesis" in window && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            isAiSpeaking &&
                            activeSpeakingTurn === turn.turn_number
                              ? stopAiSpeech()
                              : speakQuestion(turn.turn_number, turn.question)
                          }
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            padding: "0.2rem 0.55rem",
                            borderRadius: "6px",
                            border: "1px solid var(--sidebar-border)",
                            background:
                              isAiSpeaking &&
                              activeSpeakingTurn === turn.turn_number
                                ? "rgba(99, 102, 241, 0.15)"
                                : "var(--bg-secondary)",
                            color:
                              isAiSpeaking &&
                              activeSpeakingTurn === turn.turn_number
                                ? "var(--primary-600)"
                                : "var(--text-muted)",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                          title={
                            isAiSpeaking &&
                            activeSpeakingTurn === turn.turn_number
                              ? "Stop Reading"
                              : "Listen to Question"
                          }
                        >
                          {isAiSpeaking &&
                          activeSpeakingTurn === turn.turn_number ? (
                            <>
                              <VolumeX size={12} /> Stop Audio
                            </>
                          ) : (
                            <>
                              <Volume2 size={12} /> Replay Audio
                            </>
                          )}
                        </button>

                        {/* AI Volume control */}
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            fontSize: "0.72rem",
                            color: "var(--text-muted)",
                            marginLeft: "0.4rem",
                          }}
                          title={`AI Voice Volume: ${Math.round(aiVolume * 100)}%`}
                        >
                          <Volume2 size={12} />
                          <input
                            type="range"
                            min="0.2"
                            max="1.0"
                            step="0.05"
                            value={aiVolume}
                            onChange={(e) =>
                              handleAiVolumeChange(parseFloat(e.target.value))
                            }
                            style={{
                              width: "55px",
                              accentColor: "var(--primary-600)",
                              cursor: "pointer",
                            }}
                            aria-label="AI Volume"
                          />
                          <span style={{ fontWeight: 700 }}>
                            {Math.round(aiVolume * 100)}%
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.95rem",
                      color: "var(--text-primary)",
                      lineHeight: 1.55,
                    }}
                  >
                    {turn.question}
                  </p>
                </div>
              </div>

              {/* Student Answer Bubble */}
              {turn.student_answer && (
                <div
                  style={{
                    display: "flex",
                    gap: "0.85rem",
                    maxWidth: "85%",
                    alignSelf: "flex-end",
                    flexDirection: "row-reverse",
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--sidebar-border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--text-primary)",
                      flexShrink: 0,
                      marginTop: "2px",
                    }}
                  >
                    <User size={18} />
                  </div>
                  <div
                    style={{
                      background: "linear-gradient(135deg, #4f46e5, #6366f1)",
                      color: "white",
                      borderRadius: "16px 0 16px 16px",
                      padding: "1rem 1.25rem",
                      boxShadow: "0 4px 12px rgba(99, 102, 241, 0.25)",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.95rem",
                        lineHeight: 1.55,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {turn.student_answer}
                    </p>
                  </div>
                </div>
              )}

              {/* AI Feedback / Transition Bubble */}
              {turn.ai_feedback && (
                <div
                  style={{ display: "flex", gap: "0.85rem", maxWidth: "85%" }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      background: "rgba(99, 102, 241, 0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--primary-600)",
                      flexShrink: 0,
                      marginTop: "2px",
                    }}
                  >
                    <Sparkles size={18} />
                  </div>
                  <div
                    style={{
                      background: "rgba(99, 102, 241, 0.05)",
                      border: "1px dashed rgba(99, 102, 241, 0.3)",
                      borderRadius: "0 16px 16px 16px",
                      padding: "0.85rem 1.15rem",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.9rem",
                        color: "var(--text-secondary)",
                        fontStyle: "italic",
                        lineHeight: 1.5,
                      }}
                    >
                      {turn.ai_feedback}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Loading / Submitting indicator */}
          {(submitting || generatingReport) && (
            <div
              style={{
                display: "flex",
                gap: "0.85rem",
                alignItems: "center",
                padding: "0.5rem 0",
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: "var(--primary-100)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--primary-600)",
                }}
              >
                <Loader2 className="animate-spin" size={18} />
              </div>
              <span
                style={{
                  fontSize: "0.9rem",
                  color: "var(--text-muted)",
                  fontStyle: "italic",
                }}
              >
                {generatingReport
                  ? "Analyzing interview performance & compiling structured report..."
                  : "Interviewer is evaluating your response..."}
              </span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Integrated Bottom Answer Input Panel (Docked in the empty space) */}
        {!generatingReport && (
          <form
            onSubmit={handleSubmitAnswer}
            style={{
              marginTop: "auto",
              paddingTop: "1.1rem",
              borderTop: "1px solid var(--sidebar-border)",
              display: "flex",
              flexDirection: "column",
              gap: "0.85rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <label
                style={{
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                {currentTurnNumber >= totalQuestions ? (
                  <span
                    style={{
                      color: "#7c3aed",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                    }}
                  >
                    <Sparkles size={16} /> Final Question ({currentTurnNumber}{" "}
                    of {totalQuestions}) — Submitting concludes interview
                  </span>
                ) : (
                  `Your Spoken Response (Question ${currentTurnNumber} of ${totalQuestions})`
                )}
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.55rem",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--primary-600)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    fontWeight: 600,
                  }}
                >
                  <Lock size={12} /> Speech-Only (No Typing)
                </span>
                {answerInput && !submitting && (
                  <button
                    type="button"
                    onClick={() => setAnswerInput("")}
                    style={{
                      fontSize: "0.72rem",
                      color: "#ef4444",
                      background: "rgba(239, 68, 68, 0.08)",
                      border: "1px solid rgba(239, 68, 68, 0.25)",
                      padding: "0.18rem 0.5rem",
                      borderRadius: "5px",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      fontWeight: 600,
                    }}
                    title="Clear spoken response to record again"
                  >
                    <RotateCcw size={11} /> Clear & Re-record
                  </button>
                )}
              </div>
            </div>

            {/* Speech to Text Control Bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.55rem 0.85rem",
                borderRadius: "10px",
                background: isListening
                  ? "rgba(99, 102, 241, 0.08)"
                  : "var(--bg-secondary)",
                border: `1px solid ${isListening ? "rgba(99, 102, 241, 0.3)" : "var(--sidebar-border)"}`,
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.55rem",
                  flexWrap: "wrap",
                }}
              >
                {/* Push-to-Talk vs Click-to-Speak button */}
                {sttMode === "push-to-talk" ? (
                  <button
                    type="button"
                    onMouseDown={() => {
                      if (isAiSpeaking) stopAiSpeech();
                      startListening();
                    }}
                    onMouseUp={stopListening}
                    onTouchStart={() => {
                      if (isAiSpeaking) stopAiSpeech();
                      startListening();
                    }}
                    onTouchEnd={stopListening}
                    disabled={submitting}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      padding: "0.4rem 0.9rem",
                      borderRadius: "7px",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      border: "none",
                      background: isListening
                        ? "#ef4444"
                        : "var(--primary-600)",
                      color: "#ffffff",
                      boxShadow: isListening
                        ? "0 0 12px rgba(239, 68, 68, 0.4)"
                        : undefined,
                      userSelect: "none",
                    }}
                  >
                    <Mic
                      size={14}
                      className={isListening ? "animate-pulse" : ""}
                    />
                    {isListening ? "Release to End" : "Hold to Speak"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (isAiSpeaking) {
                        stopAiSpeech();
                      }
                      if (
                        sttState === STT_STATES.CONNECTING_GEMINI ||
                        sttState === STT_STATES.REQUESTING_MIC
                      ) {
                        switchToBrowserSpeech();
                      } else {
                        toggleListening();
                      }
                    }}
                    disabled={submitting}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      padding: "0.4rem 0.9rem",
                      borderRadius: "7px",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      border: "none",
                      background: isListening
                        ? activeEngine === "gemini-live"
                          ? "#ef4444"
                          : "#d97706"
                        : sttState === STT_STATES.CONNECTING_GEMINI
                          ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                          : "var(--primary-600)",
                      color: "#ffffff",
                      boxShadow: isListening
                        ? "0 0 12px rgba(239, 68, 68, 0.4)"
                        : undefined,
                    }}
                    title={
                      sttState === STT_STATES.CONNECTING_GEMINI
                        ? "Connecting to Gemini... Click to instantly switch to Browser Mic!"
                        : undefined
                    }
                  >
                    {sttState === STT_STATES.REQUESTING_MIC ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />{" "}
                        Requesting Mic...
                      </>
                    ) : sttState === STT_STATES.CONNECTING_GEMINI ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />{" "}
                        Connecting Gemini... (Click to use Browser Mic)
                      </>
                    ) : sttState === STT_STATES.STOPPING ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />{" "}
                        Finalizing...
                      </>
                    ) : isListening ? (
                      <>
                        <MicOff size={14} /> Stop Speaking
                      </>
                    ) : (
                      <>
                        <Mic size={14} /> Start Speaking
                      </>
                    )}
                  </button>
                )}

                {/* Instant Escape Hatch button if Gemini connection takes time */}
                {sttState === STT_STATES.CONNECTING_GEMINI && (
                  <button
                    type="button"
                    onClick={() => switchToBrowserSpeech()}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.3rem",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      padding: "0.35rem 0.65rem",
                      borderRadius: "6px",
                      background: "rgba(245, 158, 11, 0.15)",
                      color: "#d97706",
                      border: "1px solid rgba(245, 158, 11, 0.4)",
                      cursor: "pointer",
                      animation: "pulse 1.8s infinite ease-in-out",
                    }}
                    title="Skip waiting for Gemini and speak immediately using your browser microphone"
                  >
                    ⚡ Use Browser Mic Now
                  </button>
                )}

                {/* Engine status indicator */}
                {activeEngine === "gemini-live" && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "0.72rem",
                      background: "rgba(16, 185, 129, 0.15)",
                      color: "#10b981",
                      padding: "0.2rem 0.55rem",
                      borderRadius: "12px",
                      fontWeight: 700,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "#10b981",
                      }}
                    />
                    Gemini Live 3.5
                  </span>
                )}

                {activeEngine === "browser-speech" && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "0.72rem",
                      background: "rgba(245, 158, 11, 0.15)",
                      color: "#f59e0b",
                      padding: "0.2rem 0.55rem",
                      borderRadius: "12px",
                      fontWeight: 600,
                    }}
                  >
                    ⚠ Gemini fallback (Browser Speech)
                  </span>
                )}

                {/* English-Only Indicator */}
                <span
                  style={{
                    fontSize: "0.72rem",
                    background: "rgba(99, 102, 241, 0.1)",
                    color: "var(--primary-600)",
                    padding: "0.18rem 0.5rem",
                    borderRadius: "12px",
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "3px",
                  }}
                  title="Speech recognition strictly configured for English technical interviews"
                >
                  EN Only
                </span>

                {/* Live Volume Waveform when listening */}
                {isListening && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "3px",
                      height: "18px",
                      padding: "0 4px",
                    }}
                    title="Voice Activity Level"
                  >
                    {[0.3, 0.7, 1.0, 0.8, 0.4].map((factor, idx) => (
                      <span
                        key={idx}
                        style={{
                          width: "3px",
                          borderRadius: "2px",
                          background:
                            activeEngine === "gemini-live"
                              ? "#6366f1"
                              : "#f59e0b",
                          height: `${Math.max(4, Math.min(18, Math.round(volumeLevel * factor * 0.18)))}px`,
                          transition: "height 0.08s ease",
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Engine Selector & Mode Selector */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.8rem",
                  flexWrap: "wrap",
                }}
              >
                {/* Engine Selector */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                  }}
                >
                  <span>Engine:</span>
                  <button
                    type="button"
                    onClick={() => setPreferredEngine("auto")}
                    style={{
                      padding: "0.15rem 0.5rem",
                      borderRadius: "5px",
                      border: "1px solid var(--sidebar-border)",
                      background:
                        preferredEngine === "auto"
                          ? "rgba(99, 102, 241, 0.15)"
                          : "transparent",
                      color:
                        preferredEngine === "auto"
                          ? "var(--primary-600)"
                          : "var(--text-muted)",
                      fontWeight: preferredEngine === "auto" ? 700 : 400,
                      cursor: "pointer",
                      fontSize: "0.74rem",
                    }}
                    title="Gemini Live with automatic browser fallback"
                  >
                    Gemini Live
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreferredEngine("browser-speech")}
                    style={{
                      padding: "0.15rem 0.5rem",
                      borderRadius: "5px",
                      border: "1px solid var(--sidebar-border)",
                      background:
                        preferredEngine === "browser-speech"
                          ? "rgba(245, 158, 11, 0.15)"
                          : "transparent",
                      color:
                        preferredEngine === "browser-speech"
                          ? "#d97706"
                          : "var(--text-muted)",
                      fontWeight:
                        preferredEngine === "browser-speech" ? 700 : 400,
                      cursor: "pointer",
                      fontSize: "0.74rem",
                    }}
                    title="Instant speech recognition with zero cloud connection latency"
                  >
                    ⚡ Browser Mic (Instant)
                  </button>
                </div>

                {/* Mode Selector */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                  }}
                >
                  <span>Mode:</span>
                <button
                  type="button"
                  onClick={() => setSttMode("click")}
                  style={{
                    padding: "0.15rem 0.5rem",
                    borderRadius: "5px",
                    border: "1px solid var(--sidebar-border)",
                    background:
                      sttMode === "click"
                        ? "rgba(99, 102, 241, 0.15)"
                        : "transparent",
                    color:
                      sttMode === "click"
                        ? "var(--primary-600)"
                        : "var(--text-muted)",
                    fontWeight: sttMode === "click" ? 700 : 400,
                    cursor: "pointer",
                    fontSize: "0.74rem",
                  }}
                >
                  Click to speak
                </button>
                <button
                  type="button"
                  onClick={() => setSttMode("push-to-talk")}
                  style={{
                    padding: "0.15rem 0.5rem",
                    borderRadius: "5px",
                    border: "1px solid var(--sidebar-border)",
                    background:
                      sttMode === "push-to-talk"
                        ? "rgba(99, 102, 241, 0.15)"
                        : "transparent",
                    color:
                      sttMode === "push-to-talk"
                        ? "var(--primary-600)"
                        : "var(--text-muted)",
                    fontWeight: sttMode === "push-to-talk" ? 700 : 400,
                    cursor: "pointer",
                    fontSize: "0.74rem",
                  }}
                >
                  Hold to speak
                </button>
              </div>
            </div>
          </div>

            {/* AI Reading Question banner vs Auto-Submit 10s Countdown banner */}
            {isAiSpeaking ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.6rem 0.95rem",
                  borderRadius: "10px",
                  background:
                    "linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.12))",
                  border: "1px solid rgba(99, 102, 241, 0.35)",
                  flexWrap: "wrap",
                  gap: "0.6rem",
                  animation: "pulse 2.2s infinite ease-in-out",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.65rem",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background:
                        "linear-gradient(135deg, #6366f1, #8b5cf6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      flexShrink: 0,
                    }}
                  >
                    <Volume2 size={16} className="animate-pulse" />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "0.84rem",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                      }}
                    >
                      <span>AI Interviewer is asking Question {currentTurnNumber}</span>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          color: "#6366f1",
                          background: "rgba(99, 102, 241, 0.15)",
                          padding: "0.1rem 0.45rem",
                          borderRadius: "8px",
                          fontWeight: 700,
                        }}
                      >
                        Audio Playing
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "0.73rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Please listen to the question. Microphone will automatically open for your response right after.
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    flexWrap: "wrap",
                  }}
                >
                  {/* Interactive AI Volume Slider */}
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.45rem",
                      background: "var(--bg-card)",
                      padding: "0.25rem 0.65rem",
                      borderRadius: "6px",
                      border: "1px solid var(--sidebar-border)",
                    }}
                    title="AI Interviewer Voice Volume"
                  >
                    <Volume2 size={14} style={{ color: "var(--primary-600)" }} />
                    <input
                      type="range"
                      min="0.2"
                      max="1.0"
                      step="0.05"
                      value={aiVolume}
                      onChange={(e) =>
                        handleAiVolumeChange(parseFloat(e.target.value))
                      }
                      style={{
                        width: "70px",
                        accentColor: "var(--primary-600)",
                        cursor: "pointer",
                      }}
                      aria-label="AI Speech Volume"
                    />
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        minWidth: "34px",
                        color: "var(--text-primary)",
                      }}
                    >
                      {Math.round(aiVolume * 100)}%
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={stopAiSpeech}
                    className="btn-secondary"
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      padding: "0.35rem 0.85rem",
                      borderRadius: "6px",
                      background: "var(--bg-elevated)",
                      color: "var(--primary-600)",
                      border: "1px solid var(--primary-400)",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                    }}
                    title="Skip question audio and start answering immediately"
                  >
                    Skip & Answer Now →
                  </button>
                </div>
              </div>
            ) : (
              cameraActive &&
              !submitting && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.45rem 0.85rem",
                    borderRadius: "8px",
                    background:
                      silenceSecondsLeft <= 4
                        ? "rgba(239, 68, 68, 0.1)"
                        : "rgba(99, 102, 241, 0.08)",
                    border: `1px solid ${
                      silenceSecondsLeft <= 4
                        ? "rgba(239, 68, 68, 0.35)"
                        : "rgba(99, 102, 241, 0.25)"
                    }`,
                    flexWrap: "wrap",
                    gap: "0.5rem",
                    transition: "all 0.25s ease",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.45rem",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      color:
                        silenceSecondsLeft <= 4
                          ? "#dc2626"
                          : "var(--text-primary)",
                    }}
                  >
                    <Clock
                      size={15}
                      style={{
                        color:
                          silenceSecondsLeft <= 4
                            ? "#ef4444"
                            : "var(--primary-600)",
                      }}
                      className={
                        silenceSecondsLeft <= 4
                          ? "animate-pulse"
                          : ""
                      }
                    />
                    <span>
                      Auto-submitting in{" "}
                      <strong
                        style={{
                          fontSize: "0.95rem",
                          color:
                            silenceSecondsLeft <= 4
                              ? "#ef4444"
                              : "var(--primary-600)",
                        }}
                      >
                        {silenceSecondsLeft}s
                      </strong>
                      {answerInput.trim()
                        ? " of silence"
                        : " (Speak now or press Space/Tab to extend)"}
                    </span>
                    {timeExtendedNotice && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "3px",
                          fontSize: "0.74rem",
                          color: "#10b981",
                          background: "rgba(16, 185, 129, 0.15)",
                          padding: "0.12rem 0.5rem",
                          borderRadius: "10px",
                          fontWeight: 700,
                        }}
                      >
                        <Sparkles size={11} /> +10s Extended!
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleExtendTime}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      color: "var(--primary-600)",
                      background: "rgba(99, 102, 241, 0.12)",
                      border: "1px solid rgba(99, 102, 241, 0.3)",
                      padding: "0.25rem 0.65rem",
                      borderRadius: "6px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    title="Press Space or Tab on your keyboard to extend speaking time by +10s"
                  >
                    <span>+10s Extend Time</span>
                    <span
                      style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--sidebar-border)",
                        padding: "0.05rem 0.35rem",
                        borderRadius: "4px",
                        fontSize: "0.68rem",
                        fontWeight: 800,
                        color: "var(--text-secondary)",
                      }}
                    >
                      Space / Tab
                    </span>
                  </button>
                </div>
              )
            )}

            <div style={{ position: "relative" }}>
              <textarea
                rows={3}
                value={answerInput}
                readOnly
                disabled={submitting}
                placeholder={
                  isAiSpeaking
                    ? "🎧 Interviewer is reading the question aloud... Your microphone will automatically open as soon as they finish so you can answer."
                    : "🎙 Auto-listening: Speak your answer verbally in English. (Auto-submits after 10s of silence, press Space or Tab to extend time)..."
                }
                style={{
                  width: "100%",
                  minHeight: "92px",
                  padding: "0.85rem 1rem",
                  borderRadius: "10px",
                  border: isListening
                    ? "1px solid #6366f1"
                    : "1px solid var(--sidebar-border)",
                  background: isListening
                    ? "rgba(99, 102, 241, 0.03)"
                    : "var(--bg-primary)",
                  color: "var(--text-primary)",
                  fontSize: "0.95rem",
                  lineHeight: 1.5,
                  resize: "vertical",
                  fontFamily: "inherit",
                  outline: "none",
                  boxSizing: "border-box",
                  cursor: "default",
                  userSelect: "text",
                }}
              />
              {!answerInput && !isListening && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "10px",
                    right: "12px",
                    fontSize: "0.72rem",
                    color: "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    pointerEvents: "none",
                    background: "var(--bg-secondary)",
                    padding: "0.2rem 0.5rem",
                    borderRadius: "4px",
                    border: "1px solid var(--sidebar-border)",
                  }}
                >
                  <Mic size={11} color="var(--primary-600)" /> Speech Required
                </div>
              )}
            </div>

            {/* Interim Transcript Live Banner */}
            {interimTranscript && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.45rem 0.75rem",
                  borderRadius: "8px",
                  background: "rgba(99, 102, 241, 0.08)",
                  border: "1px dashed rgba(99, 102, 241, 0.35)",
                  fontSize: "0.85rem",
                  color: "var(--text-primary)",
                }}
              >
                <Mic
                  size={14}
                  className="animate-pulse"
                  style={{ color: "#6366f1", flexShrink: 0 }}
                />
                <span style={{ fontStyle: "italic" }}>
                  Live: "{interimTranscript}"
                </span>
              </div>
            )}

            {/* STT Status / Fallback Notice */}
            {sttError && (
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "#f59e0b",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                }}
              >
                <AlertCircle size={13} /> {sttError}
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "0.75rem",
                paddingTop: "0.35rem",
                paddingBottom: "0.25rem",
              }}
            >
              <span
                style={{
                  fontSize: "0.78rem",
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                }}
              >
                <HelpCircle size={14} /> Speak in English using mic. Typing is
                disabled.
              </span>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
              >
                {currentTurnNumber > 1 &&
                  currentTurnNumber < totalQuestions && (
                    <button
                      type="button"
                      onClick={handleEarlyConclude}
                      disabled={submitting || generatingReport}
                      className="btn-secondary"
                      style={{ padding: "0.55rem 1rem", fontSize: "0.82rem" }}
                      title="Conclude interview now with completed turns and view performance report"
                    >
                      Finish Early
                    </button>
                  )}

                <button
                  type="submit"
                  disabled={submitting || isAiSpeaking || !isFaceDetected}
                  className="btn-primary"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    padding: "0.6rem 1.45rem",
                    fontSize: "0.88rem",
                    fontWeight: 600,
                    background:
                      currentTurnNumber >= totalQuestions
                        ? "linear-gradient(135deg, #7c3aed, #4f46e5)"
                        : undefined,
                    opacity: submitting || isAiSpeaking || !isFaceDetected ? 0.6 : 1,
                    cursor: isAiSpeaking || !isFaceDetected ? "not-allowed" : "pointer",
                  }}
                  title={
                    !isFaceDetected
                      ? "Face must be verified in camera to submit response"
                      : isAiSpeaking
                      ? "Please wait for the interviewer to finish reading the question"
                      : undefined
                  }
                >
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" size={15} />{" "}
                      {currentTurnNumber >= totalQuestions
                        ? "Compiling..."
                        : "Submitting..."}
                    </>
                  ) : isAiSpeaking ? (
                    <>
                      <Volume2 className="animate-pulse" size={15} /> Reading Question...
                    </>
                  ) : currentTurnNumber >= totalQuestions ? (
                    <>
                      <CheckCircle2 size={15} /> Submit & Complete Interview
                    </>
                  ) : (
                    <>
                      <Send size={15} /> Submit Answer
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
        </div>

        {/* Floating / Side Camera Preview Tile */}
        {cameraActive && (
          <div
            className="glass-card"
            style={{
              padding: "0.85rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.65rem",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  color: "var(--text-muted)",
                }}
              >
                Live Camera
              </span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  fontSize: "0.72rem",
                  color: "#ef4444",
                  fontWeight: 700,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#ef4444",
                  }}
                />{" "}
                REC
              </div>
            </div>

            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "4/3",
                borderRadius: "10px",
                overflow: "hidden",
                background: "#000",
              }}
            >
              <video
                ref={(el) => {
                  videoRef.current = el;
                  if (
                    el &&
                    mediaStreamRef.current &&
                    el.srcObject !== mediaStreamRef.current
                  ) {
                    el.srcObject = mediaStreamRef.current;
                    el.play().catch((e) =>
                      console.debug("Video play error:", e),
                    );
                  }
                }}
                autoPlay
                muted
                playsInline
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: "scaleX(-1)",
                  filter: `brightness(${cameraBrightness}) contrast(1.05)`,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: 6,
                  left: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  background: "rgba(0,0,0,0.6)",
                  padding: "0.15rem 0.4rem",
                  borderRadius: 4,
                  color: "#fff",
                  fontSize: "0.65rem",
                }}
              >
                <Mic size={10} color="#10b981" /> Mic Active
              </div>

              {/* Brightness Boost Toggle */}
              <button
                type="button"
                onClick={() => setCameraBrightness((b) => (b >= 1.75 ? 1.0 : Number((b + 0.25).toFixed(2))))}
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.2rem",
                  background: cameraBrightness > 1 ? "rgba(245, 158, 11, 0.9)" : "rgba(0,0,0,0.6)",
                  border: "none",
                  padding: "0.15rem 0.4rem",
                  borderRadius: 4,
                  color: "#fff",
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                title="Boost camera brightness if lighting is dim"
              >
                <Sun size={10} /> {cameraBrightness > 1 ? `${Math.round(cameraBrightness * 100)}%` : "Light"}
              </button>

              {/* Real-time Face Detection Pill Badge */}
              <div
                style={{
                  position: "absolute",
                  bottom: 6,
                  right: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  background:
                    faceStatus === "detected"
                      ? "rgba(16, 185, 129, 0.85)"
                      : faceStatus === "too_dark"
                      ? "rgba(245, 158, 11, 0.9)"
                      : "rgba(239, 68, 68, 0.9)",
                  padding: "0.15rem 0.45rem",
                  borderRadius: 4,
                  color: "#fff",
                  fontSize: "0.65rem",
                  fontWeight: 700,
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "#fff",
                  }}
                />
                {faceStatus === "detected"
                  ? "Face OK"
                  : faceStatus === "too_dark"
                  ? "Too Dark"
                  : "No Face"}
              </div>
            </div>

            <p
              style={{
                fontSize: "0.72rem",
                color: "var(--text-muted)",
                margin: 0,
                lineHeight: 1.35,
              }}
            >
              Your video & audio are securely recorded for instructor evaluation
              and auto-deleted after 24 hours.
            </p>
          </div>
        )}
      </div>

      {/* ── Strict Face Verification Proctoring Lockout Modal ── */}
      {isExamActive && isFullscreen && !isFaceDetected && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(15, 23, 42, 0.96)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
          }}
        >
          <div
            className="glass-card"
            style={{
              maxWidth: 520,
              width: "100%",
              padding: "2.25rem 2rem",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1.25rem",
              border: "2px solid rgba(239, 68, 68, 0.55)",
              boxShadow: "0 0 50px rgba(239, 68, 68, 0.35)",
            }}
          >
            <div
              style={{
                width: 68,
                height: 68,
                borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.15)",
                border: "2px solid #ef4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ef4444",
                animation: "pulse 1.8s infinite ease-in-out",
              }}
            >
              <VideoOff size={34} />
            </div>

            <div>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "0.76rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  padding: "0.2rem 0.65rem",
                  borderRadius: "12px",
                  background: "rgba(239, 68, 68, 0.2)",
                  color: "#ef4444",
                  marginBottom: "0.6rem",
                  letterSpacing: "0.05em",
                }}
              >
                <AlertTriangle size={13} /> Proctoring Alert: Face Missing
              </span>
              <h2
                style={{
                  fontSize: "1.45rem",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  margin: 0,
                }}
              >
                {faceStatus === "too_dark"
                  ? "Camera Feed Too Dark"
                  : "Face Not Detected"}
              </h2>
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "0.88rem",
                  lineHeight: 1.5,
                  marginTop: "0.5rem",
                }}
              >
                {faceStatus === "too_dark"
                  ? "Your webcam feed appears underexposed. Click 'Boost Camera Brightness' below or turn on room lighting to resume."
                  : "Your face has left the camera frame. Please position yourself facing the camera to continue the assessment."}
              </p>
            </div>

            {/* Live Camera Re-alignment viewfinder */}
            <div
              style={{
                width: "100%",
                maxWidth: 320,
                aspectRatio: "4/3",
                borderRadius: "12px",
                overflow: "hidden",
                background: "#000",
                border: "2px dashed #ef4444",
                position: "relative",
              }}
            >
              <video
                ref={(el) => {
                  if (el && mediaStreamRef.current && el.srcObject !== mediaStreamRef.current) {
                    el.srcObject = mediaStreamRef.current;
                    el.play().catch(() => {});
                  }
                }}
                autoPlay
                muted
                playsInline
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: "scaleX(-1)",
                  filter: `brightness(${cameraBrightness}) contrast(1.05)`,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: 8,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "rgba(0,0,0,0.75)",
                  padding: "0.25rem 0.65rem",
                  borderRadius: "6px",
                  color: "#fff",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                Align face in center with good lighting
              </div>
            </div>

            {/* Controls to resolve dark camera or force re-check */}
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", justifyContent: "center", width: "100%" }}>
              <button
                type="button"
                onClick={() => {
                  setCameraBrightness((b) => (b >= 1.75 ? 1.0 : Number((b + 0.25).toFixed(2))));
                  setTimeout(() => {
                    if (runCheckRef.current) runCheckRef.current();
                  }, 200);
                }}
                className="btn-secondary"
                style={{
                  padding: "0.55rem 1rem",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  background: "rgba(245, 158, 11, 0.15)",
                  borderColor: "rgba(245, 158, 11, 0.4)",
                  color: "#f59e0b",
                  cursor: "pointer",
                }}
              >
                <Sun size={15} /> Boost Brightness ({Math.round(cameraBrightness * 100)}%)
              </button>

              <button
                type="button"
                onClick={async () => {
                  let stream = mediaStreamRef.current;
                  const isLive =
                    stream &&
                    stream.getVideoTracks().length > 0 &&
                    stream.getVideoTracks().some((t) => t.readyState === "live");

                  if (!isLive) {
                    try {
                      stream = await navigator.mediaDevices.getUserMedia({
                        video: {
                          width: { ideal: 1280 },
                          height: { ideal: 720 },
                          facingMode: "user",
                        },
                        audio: true,
                      });
                      mediaStreamRef.current = stream;
                      setPreCameraStream(stream);
                      if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                        videoRef.current.play().catch(() => {});
                      }
                    } catch (camErr) {
                      console.error("Camera re-acquisition error:", camErr);
                    }
                  }
                  if (videoRef.current && videoRef.current.paused) {
                    videoRef.current.play().catch(() => {});
                  }
                  if (runCheckRef.current) runCheckRef.current();
                }}
                className="btn-primary"
                style={{
                  padding: "0.55rem 1.1rem",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  cursor: "pointer",
                }}
              >
                <RotateCcw size={15} /> Re-verify Face Now
              </button>
            </div>

            <div
              style={{
                fontSize: "0.78rem",
                color: "var(--text-muted)",
                background: "var(--bg-elevated)",
                padding: "0.55rem 0.85rem",
                borderRadius: "8px",
                border: "1px solid var(--sidebar-border)",
                lineHeight: 1.4,
              }}
            >
              💡 <strong>Tip:</strong> If you are already in a well-lit room, click <strong>Boost Brightness</strong> above or tilt your laptop screen slightly towards your face so screen light illuminates you.
            </div>
          </div>
        </div>
      )}

      {/* ── Strict Full Screen Enforcement Lockout Modal ── */}
      {isExamActive && !isFullscreen && (
        <div
          onClick={enterFullscreen}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(15, 23, 42, 0.94)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
            cursor: "pointer",
          }}
        >
          <div
            className="glass-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 520,
              width: "100%",
              padding: "2.5rem 2rem",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1.25rem",
              border: "2px solid rgba(239, 68, 68, 0.5)",
              boxShadow: "0 0 50px rgba(239, 68, 68, 0.3)",
              cursor: "default",
            }}
          >
            <div
              style={{
                width: 70,
                height: 70,
                borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.15)",
                border: "2px solid #ef4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ef4444",
                animation: "pulse 1.8s infinite ease-in-out",
              }}
            >
              <Maximize size={34} />
            </div>

            <div>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  padding: "0.2rem 0.65rem",
                  borderRadius: "12px",
                  background: "rgba(239, 68, 68, 0.2)",
                  color: "#ef4444",
                  marginBottom: "0.6rem",
                  letterSpacing: "0.05em",
                }}
              >
                <AlertCircle size={13} /> Full Screen Mode Required
              </span>
              <h2
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  margin: 0,
                }}
              >
                Full Screen Exited
              </h2>
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "0.9rem",
                  lineHeight: 1.5,
                  marginTop: "0.5rem",
                }}
              >
                To maintain interview integrity, you must remain in full screen
                mode until you finish all questions and submit the final response.
              </p>
            </div>

            <div
              style={{
                width: "100%",
                padding: "0.85rem",
                borderRadius: "10px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--sidebar-border)",
                fontSize: "0.82rem",
                color: "var(--text-secondary)",
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                gap: "0.4rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.45rem",
                }}
              >
                <CheckCircle2 size={15} color="#10b981" /> Spoken responses and
                webcam are preserved.
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.45rem",
                }}
              >
                <Lock size={15} color="#6366f1" /> Window switching and tab
                changing are restricted.
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.45rem",
                  color: "#f59e0b",
                  fontWeight: 600,
                }}
              >
                <PauseCircle size={15} color="#f59e0b" /> Question reading and timer are paused until you return.
              </div>
            </div>

            <button
              type="button"
              onClick={enterFullscreen}
              className="btn-primary"
              style={{
                width: "100%",
                padding: "0.85rem",
                fontSize: "0.95rem",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.55rem",
                background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                boxShadow: "0 0 20px rgba(99, 102, 241, 0.4)",
              }}
            >
              <Maximize size={18} /> Return to Full Screen Mode
            </button>
          </div>
        </div>
      )}

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "1rem",
          }}
        >
          <div
            style={{
              maxWidth: 460,
              width: "100%",
              padding: "2rem",
              background: "var(--card-bg)",
              borderRadius: "16px",
              border: "1px solid var(--sidebar-border)",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5)",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <h3
              style={{
                fontSize: "1.3rem",
                fontWeight: 800,
                color: "var(--text-primary)",
                margin: 0,
              }}
            >
              Leave Mock Interview?
            </h3>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.95rem",
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              You are currently on{" "}
              <strong>
                Question {currentTurnNumber} of {totalQuestions}
              </strong>
              . If you leave now, your recorded progress is saved and you can
              resume anytime from your Interview Hub.
            </p>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.75rem",
                marginTop: "1rem",
              }}
            >
              <button
                className="btn-secondary"
                style={{ padding: "0.65rem 1.25rem", fontWeight: 600 }}
                onClick={() => setShowExitConfirm(false)}
              >
                Continue Interview
              </button>
              <button
                className="btn-primary"
                style={{
                  background: "#ef4444",
                  borderColor: "#ef4444",
                  color: "#fff",
                  padding: "0.65rem 1.25rem",
                  fontWeight: 700,
                }}
                onClick={() => {
                  if (
                    typeof document !== "undefined" &&
                    document.fullscreenElement
                  ) {
                    document.exitFullscreen().catch(() => {});
                  }
                  navigate("/student/mock-interview");
                }}
              >
                Exit to Hub
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
