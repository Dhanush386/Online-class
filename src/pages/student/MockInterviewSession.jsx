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
} from "lucide-react";
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

  // Video recording states
  const [cameraActive, setCameraActive] = useState(false);
  const [screenShared, setScreenShared] = useState(false);
  const [uploadingRecording, setUploadingRecording] = useState(false);

  // Question Text-to-Speech (TTS)
  const [activeSpeakingTurn, setActiveSpeakingTurn] = useState(null);

  const toggleSpeakQuestion = (turnNumber, questionText) => {
    if (!("speechSynthesis" in window)) return;

    if (activeSpeakingTurn === turnNumber) {
      window.speechSynthesis.cancel();
      setActiveSpeakingTurn(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(questionText);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onend = () => setActiveSpeakingTurn(null);
    utterance.onerror = () => setActiveSpeakingTurn(null);

    setActiveSpeakingTurn(turnNumber);
    window.speechSynthesis.speak(utterance);
  };

  // Cancel question speech on unmount
  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Cancel question speech when moving to another question
  useEffect(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setActiveSpeakingTurn(null);
  }, [currentTurnNumber]);

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

  // Auto-submit countdown (10s of silence) & speaking time extension
  const [silenceSecondsLeft, setSilenceSecondsLeft] = useState(10);
  const [timeExtendedNotice, setTimeExtendedNotice] = useState(false);

  // Extend speaking time by +10s (Space, Tab, or button click)
  const handleExtendTime = useCallback(() => {
    setSilenceSecondsLeft((prev) => prev + 10);
    setTimeExtendedNotice(true);
    setTimeout(() => setTimeExtendedNotice(false), 2500);
  }, []);

  // Keyboard shortcut listener: Space or Tab to extend speaking time
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if setup modal or exit modal is active, or already submitting
      if (!cameraActive || submitting || generatingReport || showExitConfirm) {
        return;
      }

      if (e.code === "Space" || e.key === "Tab") {
        e.preventDefault();
        handleExtendTime();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cameraActive, submitting, generatingReport, showExitConfirm, handleExtendTime]);

  // Auto-enable microphone when interview is active & idle
  useEffect(() => {
    if (
      cameraActive &&
      !submitting &&
      !generatingReport &&
      !isListening &&
      sttState === STT_STATES.IDLE
    ) {
      const timer = setTimeout(() => {
        startListening().catch((err) =>
          console.debug("Auto-enable mic error:", err),
        );
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [
    cameraActive,
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
      videoRef.current.srcObject = mediaStreamRef.current;
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
            const fileName = `${profile.id}/${session.id}_${Date.now()}.webm`;

            const { error: upErr } = await supabase.storage
              .from("interview-recordings")
              .upload(fileName, blob, {
                contentType: "video/webm",
                upsert: true,
              });

            if (upErr) {
              console.warn("Failed to upload interview recording:", upErr);
              resolve(null);
              return;
            }

            const {
              data: { publicUrl },
            } = supabase.storage
              .from("interview-recordings")
              .getPublicUrl(fileName);

            // 24 Hours retention from now
            const expiresAt = new Date(
              Date.now() + 24 * 60 * 60 * 1000,
            ).toISOString();

            await supabase
              .from("mock_interview_sessions")
              .update({
                recording_url: publicUrl,
                recording_expires_at: expiresAt,
              })
              .eq("id", session.id);

            // Stop camera tracks cleanly
            if (mediaStreamRef.current) {
              mediaStreamRef.current.getTracks().forEach((t) => t.stop());
            }

            resolve(publicUrl);
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
    const trimmed = answerInput.trim();
    if (!trimmed || submitting || generatingReport || !session) return;

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
        answer: trimmed,
      });

      // Update local turns state
      const updatedTurns = turns.map((t) => {
        if (t.turn_number === currentTurnNumber) {
          return {
            ...t,
            student_answer: trimmed,
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
      }

      setTurns(updatedTurns);
      setAnswerInput("");

      // If completed, upload video & trigger report generation
      if (result.isCompleted) {
        await uploadInterviewVideo();
        await generateFinalReport(updatedTurns);
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
  const answerInputRef = useRef(answerInput);
  answerInputRef.current = answerInput;
  const isSpeakingRef = useRef(false);
  isSpeakingRef.current =
    Boolean(interimTranscript?.trim()) || volumeLevel > 18;

  useEffect(() => {
    if (!cameraActive || submitting || generatingReport || showExitConfirm) {
      return;
    }

    const interval = setInterval(() => {
      // If student is speaking right now, reset silence timer
      if (isSpeakingRef.current) {
        setSilenceSecondsLeft((prev) => Math.max(prev, 10));
        return;
      }

      // Auto-submit after 10 seconds of silence once student has answered
      const currentAnswer = answerInputRef.current?.trim() || "";
      if (currentAnswer.length > 0) {
        setSilenceSecondsLeft((prev) => {
          if (prev <= 1) {
            handleSubmitAnswerRef.current();
            return 10;
          }
          return prev - 1;
        });
      } else {
        setSilenceSecondsLeft(10);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [cameraActive, submitting, generatingReport, showExitConfirm]);

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
        session={session}
        report={report}
        onBackToHub={() => navigate("/student/mock-interview")}
        onStartNew={() => navigate("/student/mock-interview")}
      />
    );
  }

  // Mandatory Camera Access Screen
  if (!cameraActive) {
    return (
      <div style={{ maxWidth: 640, margin: "2rem auto", padding: "0 1rem" }}>
        <div
          className="glass-card"
          style={{
            padding: "2.5rem",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1.25rem",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "20px",
              background:
                "linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(239, 68, 68, 0.2))",
              border: "2px solid rgba(99, 102, 241, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--primary-600)",
            }}
          >
            <Video size={36} />
          </div>

          <div>
            <h2
              style={{
                fontSize: "1.4rem",
                fontWeight: 800,
                color: "var(--text-primary)",
                marginBottom: "0.5rem",
              }}
            >
              Camera & Face Verification Required
            </h2>
            <p
              style={{
                color: "var(--text-muted)",
                fontSize: "0.92rem",
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              To ensure mock interview integrity and provide authentic video
              feedback for instructor verification, your camera must remain
              enabled with your face clearly visible throughout the entire
              session.
            </p>
          </div>

          <div
            style={{
              width: "100%",
              padding: "1rem",
              background: "var(--bg-elevated)",
              borderRadius: "12px",
              border: "1px solid var(--sidebar-border)",
              textAlign: "left",
              fontSize: "0.85rem",
              color: "var(--text-secondary)",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <CheckCircle size={16} color="#10b981" /> Ensure your face is
              centered and well-lit.
            </div>
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <CheckCircle size={16} color="#10b981" /> Speak clearly into your
              microphone when answering.
            </div>
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <CheckCircle size={16} color="#10b981" /> Video is recorded
              securely and auto-deleted after 24 hours.
            </div>
          </div>

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
            <button
              onClick={async () => {
                try {
                  // 1. Request Camera & Mic
                  const camStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                      width: { ideal: 640 },
                      height: { ideal: 480 },
                      facingMode: "user",
                    },
                    audio: true,
                  });
                  mediaStreamRef.current = camStream;
                  if (videoRef.current) {
                    videoRef.current.srcObject = camStream;
                  }

                  // 2. Request Screen Share for Dual Recording
                  let scrStream = null;
                  try {
                    scrStream = await navigator.mediaDevices.getDisplayMedia({
                      video: { cursor: "always" },
                      audio: false,
                    });
                    screenStreamRef.current = scrStream;
                    setScreenShared(true);
                  } catch (scrErr) {
                    console.info(
                      "Screen share skipped or denied, recording camera directly:",
                      scrErr,
                    );
                  }

                  // 3. Initialize Composite Recorder
                  initCompositeRecording(camStream, scrStream);
                  setCameraActive(true);
                } catch (err) {
                  alert(
                    "Please grant camera and microphone permissions in your browser to proceed with the mock interview.",
                  );
                  console.error(err);
                }
              }}
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
              <Video size={18} /> Enable Camera & Screen Recording
            </button>
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
                    {"speechSynthesis" in window && (
                      <button
                        type="button"
                        onClick={() =>
                          toggleSpeakQuestion(turn.turn_number, turn.question)
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
                            activeSpeakingTurn === turn.turn_number
                              ? "rgba(99, 102, 241, 0.15)"
                              : "var(--bg-secondary)",
                          color:
                            activeSpeakingTurn === turn.turn_number
                              ? "var(--primary-600)"
                              : "var(--text-muted)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        title={
                          activeSpeakingTurn === turn.turn_number
                            ? "Stop Reading"
                            : "Listen to Question"
                        }
                      >
                        {activeSpeakingTurn === turn.turn_number ? (
                          <>
                            <VolumeX size={12} /> Stop Audio
                          </>
                        ) : (
                          <>
                            <Volume2 size={12} /> Listen
                          </>
                        )}
                      </button>
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
                    onMouseDown={startListening}
                    onMouseUp={stopListening}
                    onTouchStart={startListening}
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
                    onClick={toggleListening}
                    disabled={
                      submitting ||
                      sttState === STT_STATES.REQUESTING_MIC ||
                      sttState === STT_STATES.CONNECTING_GEMINI
                    }
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
                        : "var(--primary-600)",
                      color: "#ffffff",
                      boxShadow: isListening
                        ? "0 0 12px rgba(239, 68, 68, 0.4)"
                        : undefined,
                    }}
                  >
                    {sttState === STT_STATES.REQUESTING_MIC ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />{" "}
                        Requesting Mic...
                      </>
                    ) : sttState === STT_STATES.CONNECTING_GEMINI ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />{" "}
                        Connecting Gemini...
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

            {/* Auto-Submit 10s Silence Countdown & Space/Tab Extend Timer Banner */}
            {cameraActive && !submitting && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.45rem 0.85rem",
                  borderRadius: "8px",
                  background:
                    answerInput.trim().length > 0 && silenceSecondsLeft <= 4
                      ? "rgba(239, 68, 68, 0.1)"
                      : "rgba(99, 102, 241, 0.08)",
                  border: `1px solid ${
                    answerInput.trim().length > 0 && silenceSecondsLeft <= 4
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
                      answerInput.trim().length > 0 && silenceSecondsLeft <= 4
                        ? "#dc2626"
                        : "var(--text-primary)",
                  }}
                >
                  <Clock
                    size={15}
                    style={{
                      color:
                        answerInput.trim().length > 0 && silenceSecondsLeft <= 4
                          ? "#ef4444"
                          : "var(--primary-600)",
                    }}
                    className={
                      answerInput.trim().length > 0 && silenceSecondsLeft <= 4
                        ? "animate-pulse"
                        : ""
                    }
                  />
                  {answerInput.trim().length > 0 ? (
                    <span>
                      Auto-submits in{" "}
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
                      </strong>{" "}
                      of silence
                    </span>
                  ) : (
                    <span
                      style={{
                        color: "var(--text-muted)",
                        fontSize: "0.8rem",
                      }}
                    >
                      🎙 Mic is auto-enabled — speak your response in English (Auto-submits after 10s of silence)
                    </span>
                  )}
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
            )}

            <div style={{ position: "relative" }}>
              <textarea
                rows={3}
                value={answerInput}
                readOnly
                disabled={submitting}
                placeholder="🎙 Auto-listening: Speak your answer verbally in English. (Auto-submits after 10s of silence, press Space or Tab to extend time)..."
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
                  disabled={!answerInput.trim() || submitting}
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
                    opacity: !answerInput.trim() || submitting ? 0.6 : 1,
                  }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" size={15} />{" "}
                      {currentTurnNumber >= totalQuestions
                        ? "Compiling..."
                        : "Submitting..."}
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
                onClick={() => navigate("/student/mock-interview")}
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
