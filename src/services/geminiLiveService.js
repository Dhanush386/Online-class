/* eslint-disable no-control-regex */
/**
 * Gemini Live WebSocket Client
 *
 * Connects to Google's BidiGenerateContentConstrained v1beta endpoint using an ephemeral token.
 * Streams 16 kHz Mono PCM16 audio for real-time transcription.
 * Implements models/gemini-3.5-transcribe-live with SMART mode and track-specific vocabulary hints.
 */

// Track-specific vocabulary hints to improve speech recognition accuracy
export const TRACK_VOCABULARIES = {
  "Frontend Development": [
    "React",
    "Virtual DOM",
    "Reconciliation",
    "Fiber",
    "Redux",
    "Zustand",
    "Context API",
    "useEffect",
    "useState",
    "useMemo",
    "useCallback",
    "useRef",
    "TypeScript",
    "JavaScript",
    "Next.js",
    "Vite",
    "Webpack",
    "TailwindCSS",
    "CSS Grid",
    "Flexbox",
    "Core Web Vitals",
    "LCP",
    "CLS",
    "INP",
    "SSR",
    "SSG",
    "Hydration",
    "HTML5",
    "DOM",
    "JSX",
    "Async Await",
    "Promises",
    "Event Loop",
    "Microtasks",
    "Bundle Size",
    "Tree Shaking",
    "Polyfills",
  ],
  "Backend Engineering": [
    "Node.js",
    "Express",
    "REST API",
    "GraphQL",
    "gRPC",
    "PostgreSQL",
    "MySQL",
    "MongoDB",
    "Redis",
    "Kafka",
    "RabbitMQ",
    "Docker",
    "Kubernetes",
    "Microservices",
    "Database Indexing",
    "ACID Transactions",
    "Optimistic Locking",
    "Pessimistic Locking",
    "Connection Pooling",
    "JWT",
    "OAuth2",
    "Rate Limiting",
    "Load Balancer",
    "Nginx",
    "Horizontal Scaling",
    "Idempotency",
    "Database Sharding",
    "Eventual Consistency",
    "CAP Theorem",
    "ORM",
    "Prisma",
  ],
  "Full Stack Development": [
    "React",
    "Node.js",
    "PostgreSQL",
    "REST API",
    "GraphQL",
    "Next.js",
    "TailwindCSS",
    "Supabase",
    "Firebase",
    "Docker",
    "JWT",
    "State Management",
    "Server Actions",
    "WebSockets",
    "CI/CD",
    "GitHub Actions",
    "TypeScript",
    "Prisma",
    "OAuth",
  ],
  "AI & Machine Learning": [
    "PyTorch",
    "TensorFlow",
    "scikit-learn",
    "Transformer",
    "Attention Mechanism",
    "LLM",
    "Fine-tuning",
    "LoRA",
    "Embeddings",
    "Vector Database",
    "RAG",
    "Gradient Descent",
    "Backpropagation",
    "Overfitting",
    "Regularization",
    "CNN",
    "RNN",
    "LSTM",
    "Tokenization",
    "Cross Entropy",
    "Cosine Similarity",
    "Hyperparameters",
    "LangChain",
    "Hugging Face",
  ],
  "System Design": [
    "High Availability",
    "Fault Tolerance",
    "Microservices",
    "Monolith",
    "Consistent Hashing",
    "Message Queue",
    "Pub/Sub",
    "Kafka",
    "Redis Caching",
    "CDN",
    "DNS Routing",
    "Database Replication",
    "Read Replicas",
    "Write-Ahead Log",
    "Circuit Breaker",
    "Bloom Filter",
    "Two-Phase Commit",
    "Event Sourcing",
    "CQRS",
    "Horizontal Partitioning",
    "SLA",
    "SLO",
  ],
  "DevOps & Cloud": [
    "Kubernetes",
    "Docker",
    "Terraform",
    "Ansible",
    "CI/CD",
    "GitHub Actions",
    "AWS",
    "GCP",
    "Azure",
    "Prometheus",
    "Grafana",
    "Ingress Controller",
    "Helm",
    "Containerd",
    "EC2",
    "S3",
    "Lambda",
    "Serverless",
    "Infrastructure as Code",
    "Secrets Management",
  ],
};

/**
 * Resolve track vocabulary with a robust fallback
 */
export function getTrackVocabulary(trackName) {
  if (!trackName) return TRACK_VOCABULARIES["Full Stack Development"];
  const matchedKey = Object.keys(TRACK_VOCABULARIES).find(
    (k) =>
      k.toLowerCase() === trackName.toLowerCase() ||
      trackName.toLowerCase().includes(k.toLowerCase()),
  );
  return matchedKey
    ? TRACK_VOCABULARIES[matchedKey]
    : TRACK_VOCABULARIES["Full Stack Development"];
}

/**
 * Strict English-only text filter.
 * Retains ASCII characters (English alphabet, numbers, punctuation, programming symbols)
 * and strips any non-Latin scripts.
 */
export function filterEnglishOnly(text) {
  if (!text) return "";
  return text
    .replace(/[^\x00-\x7F\u2010-\u2027\u2030-\u205E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Convert ArrayBuffer or Int16Array to Base64 string
 */
function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, Math.min(i + chunkSize, len)),
    );
  }
  return window.btoa(binary);
}

export class GeminiLiveService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.isSetupComplete = false;
    this.model = "models/gemini-3.5-transcribe-live";
  }

  /**
   * Connect to Gemini Live WebSocket
   *
   * @param {Object} options
   * @param {string} options.token - Short-lived ephemeral token
   * @param {string} [options.track] - Interview track for custom vocabulary
   * @param {('SMART'|'VERBATIM')} [options.mode='SMART'] - Transcription mode
   * @param {Function} options.onInterimTranscript - Callback for interim partial text
   * @param {Function} options.onFinalTranscript - Callback for finalized text
   * @param {Function} [options.onOpen] - Connection opened callback
   * @param {Function} [options.onClose] - Connection closed callback
   * @param {Function} [options.onError] - Error callback
   */
  async connect({
    token,
    track,
    mode = "SMART",
    onInterimTranscript,
    onFinalTranscript,
    onOpen,
    onClose,
    onError,
  }) {
    this.disconnect();

    if (!token) {
      throw new Error(
        "An ephemeral token is required to connect to Gemini Live.",
      );
    }

    const vocabulary = getTrackVocabulary(track);
    const endpoint = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(token)}`;

    return new Promise((resolve, reject) => {
      let opened = false;
      let timeoutTimer = null;

      const cleanupTimer = () => {
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
          timeoutTimer = null;
        }
      };

      // Set timeout for WebSocket connection & setup completion (3.5s max)
      timeoutTimer = setTimeout(() => {
        if (!this.isSetupComplete) {
          cleanupTimer();
          this.disconnect();
          reject(
            new Error(
              "Gemini Live connection timed out (3.5s). Falling back for immediate response.",
            ),
          );
        }
      }, 3500);

      try {
        this.socket = new WebSocket(endpoint);
      } catch (err) {
        cleanupTimer();
        reject(err);
        return;
      }

      this.socket.onopen = () => {
        opened = true;
        this.isConnected = true;

        // Send Initial Setup Frame strictly configured for English
        const setupPayload = {
          setup: {
            model: this.model,
            generationConfig: {
              responseModalities: ["TEXT"],
            },
            systemInstruction: {
              parts: [
                {
                  text: "You are an English speech-to-text transcriber for a professional technical interview. Transcribe spoken words strictly in English only. Ignore any non-English speech and do not output non-English characters.",
                },
              ],
            },
            inputAudioTranscription: {
              languageCodes: ["en-US"],
              mode: mode,
              customVocabulary: vocabulary,
            },
          },
        };

        try {
          this.socket.send(JSON.stringify(setupPayload));
        } catch (sendErr) {
          console.error("Failed to send setup frame to Gemini Live:", sendErr);
          cleanupTimer();
          this.disconnect();
          reject(sendErr);
          return;
        }

        if (onOpen) onOpen();
      };

      this.socket.onmessage = async (event) => {
        try {
          let textData = "";
          if (typeof event.data === "string") {
            textData = event.data;
          } else if (event.data instanceof Blob) {
            textData = await event.data.text();
          } else if (event.data instanceof ArrayBuffer) {
            textData = new TextDecoder().decode(event.data);
          }

          if (!textData) return;

          const msg = JSON.parse(textData);

          // 1. Setup completed acknowledge
          if (msg.setupComplete) {
            cleanupTimer();
            this.isSetupComplete = true;
            resolve(true);
            return;
          }

          // 2. Transcription and content events
          // Gemini Live returns input transcription events and model turn text
          if (msg.serverContent) {
            const sc = msg.serverContent;

            // Check interim input transcription
            if (sc.interimInputTranscription?.text) {
              const interim = filterEnglishOnly(
                sc.interimInputTranscription.text,
              );
              if (interim && onInterimTranscript) {
                onInterimTranscript(interim);
              }
            }

            // Check final input transcription
            if (sc.inputTranscription?.text) {
              const final = filterEnglishOnly(sc.inputTranscription.text);
              if (final && onFinalTranscript) {
                onFinalTranscript(final);
              }
            }

            // Check model turn text (interim / response transcription)
            if (sc.modelTurn?.parts) {
              const partText = filterEnglishOnly(
                sc.modelTurn.parts.map((p) => p.text || "").join(""),
              );

              if (partText) {
                if (sc.turnComplete && onFinalTranscript) {
                  onFinalTranscript(partText);
                } else if (onInterimTranscript) {
                  onInterimTranscript(partText);
                }
              }
            }
          }
        } catch (parseErr) {
          console.warn("Error parsing Gemini Live message:", parseErr);
        }
      };

      this.socket.onerror = (event) => {
        console.error("Gemini Live WebSocket error:", event);
        cleanupTimer();
        if (!this.isSetupComplete) {
          reject(new Error("Gemini Live WebSocket encountered a connection error before setup"));
        }
        if (onError)
          onError(
            new Error("Gemini Live WebSocket encountered a connection error"),
          );
      };

      this.socket.onclose = (event) => {
        cleanupTimer();
        this.isConnected = false;
        const wasSetupComplete = this.isSetupComplete;
        this.isSetupComplete = false;
        if (!wasSetupComplete) {
          reject(
            new Error(
              `Gemini Live WebSocket closed before setup completed (code: ${event.code})`,
            ),
          );
        }
        if (onClose) onClose(event.code, event.reason);
      };
    });
  }

  /**
   * Stream a 16kHz PCM16 audio chunk (~100ms) to Gemini Live
   * @param {ArrayBuffer|Int16Array} buffer
   */
  sendAudioChunk(buffer) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

    try {
      const base64Audio = bufferToBase64(buffer);
      const payload = {
        realtimeInput: {
          mediaChunks: [
            {
              mimeType: "audio/pcm;rate=16000",
              data: base64Audio,
            },
          ],
        },
      };
      this.socket.send(JSON.stringify(payload));
    } catch (err) {
      console.warn("Error streaming audio chunk to Gemini Live:", err);
    }
  }

  /**
   * Signal user activity end (e.g. on button release or pause)
   */
  endActivity() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

    try {
      this.socket.send(
        JSON.stringify({
          clientContent: {
            turns: [],
            turnComplete: true,
          },
        }),
      );
    } catch (err) {
      console.debug("Error sending endActivity signal:", err);
    }
  }

  /**
   * Disconnect and clean up socket
   */
  disconnect() {
    if (this.socket) {
      try {
        if (
          this.socket.readyState === WebSocket.OPEN ||
          this.socket.readyState === WebSocket.CONNECTING
        ) {
          if (this.socket.readyState === WebSocket.OPEN) {
            this.endActivity();
          }
          this.socket.close(1000, "Session ended");
        }
      } catch (err) {
        console.debug("Socket close error:", err);
      }
      this.socket = null;
    }
    this.isConnected = false;
    this.isSetupComplete = false;
  }
}
