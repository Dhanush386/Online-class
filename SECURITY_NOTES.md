# 🛡️ Learnova Security & Integrity Architecture

This document details the security posture, threat model, and known limitations of Learnova's assessment, authentication, and proctoring systems.

---

## 1. Exam & Device Integrity Architecture

### 🔐 Server-Side Session Token Issuance (`start_exam_session`)
When a student begins a proctored assessment, the client must negotiate a short-lived, signed cryptographic session token with the server via Postgres RPC:
* **Enrollment & Schedule Validation**: Server verifies the student is actively enrolled in the course and that the current timestamp is within the exam's `open_time` and `due_date`.
* **Single Attempt Enforcement**: Checks the database constraint `uq_assessment_student_attempt` to prevent concurrent or replay attempts.
* **Server-Side Device & Viewport Analysis**: Validates client `userAgent`, `viewport_width >= 1024`, and hardware `maxTouchPoints`. Mobile and tablet connections are rejected at the server level (`22023`).
* **Signed Token Generation**: Issues a single-use UUID token with a strict expiration timestamp (`duration + 15m grace window`).

### 📝 Verified Server-Side Grading Gate (`submit_assessment_with_token`)
* **Zero Client Score Trust**: The client transmits only the raw student answers `[{"question_id": "...", "selected_option": "..."}]`. The server looks up ground-truth correct options from the database `questions` table, evaluates each answer, computes the score, and persists the grade.
* **Token Invalidation**: Upon submission, the session token is **atomically invalidated** (`session_token = NULL`), preventing replay or post-submission tampering.
* **Fail-Closed Gate**: No direct client writes to `assessment_submissions` are permitted. If token validation fails, the submission is rejected.

---

## ⚠️ Known Limitations & Threat Model Caveats

> **Client-Side AI Inference (TensorFlow.js / Coco-SSD)**
> * The multi-face, absent-face, and object detection engine runs entirely in the student's local browser context via WebAssembly / WebGL.
> * **Limitation**: A sophisticated attacker with local system control could manipulate the WebRTC media stream (e.g., using OBS Virtual Camera) or alter the client-side JavaScript execution context.
> * **Design Role**: Client-side inference serves as an automated deterrence layer against casual infractions (tab switches, looking away, multiple people in frame). For high-stakes institutional certification, native OS-level secure browser technology (e.g., Safe Exam Browser) is recommended.

> **Client-Reported Device & Viewport Telemetry**
> * The server-side device check validates client-reported parameters (`window.innerWidth`, `navigator.userAgent`, `navigator.maxTouchPoints`).
> * **Limitation**: An adversary with browser DevTools access can emulate desktop dimensions or forge user-agents prior to firing the RPC request.
> * **Design Role**: Provides a centralized, server-enforced choke point eliminating accidental or standard mobile browser usage, but cannot replace cryptographic hardware attestation.

---

## 📋 Biometric Privacy, Consent & Data Retention Notice

> **Action Required Prior to Real User Onboarding (Legal & Compliance Flag)**
> * **Biometric-Adjacent Data**: Real-time webcam proctoring monitors facial landmarks and telemetry logs.
> * **Explicit Consent Requirement**: An explicit, unbundled biometric data processing consent screen must be presented to students prior to activating webcam feeds.
> * **Data Retention & Deletion Policy**: A clear retention schedule (e.g., automated purge of violation logs and session recordings after 30/90 days) must be legally established and executed via a scheduled Postgres cleanup worker.
