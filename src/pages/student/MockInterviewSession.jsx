import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  Bot, User, Send, Loader2, Sparkles, 
  ArrowLeft, CheckCircle, AlertCircle, 
  HelpCircle, LogOut, Video, VideoOff, Mic
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import useXpAward from '../../hooks/useXpAward'
import MockInterviewReportView from '../../components/student/MockInterviewReportView'

export default function MockInterviewSession() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { awardXp } = useXpAward()

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [turns, setTurns] = useState([])
  const [report, setReport] = useState(null)
  const [currentTurnNumber, setCurrentTurnNumber] = useState(1)
  const [answerInput, setAnswerInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [error, setError] = useState(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  // Video recording states
  const [cameraActive, setCameraActive] = useState(false)
  const [uploadingRecording, setUploadingRecording] = useState(false)

  const chatEndRef = useRef(null)
  const videoRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const recordedChunksRef = useRef([])

  // Scroll chat to bottom
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [turns, submitting, generatingReport])

  // Fetch session, turns, and report
  useEffect(() => {
    if (!sessionId || !profile?.id) return

    async function loadSession() {
      setLoading(true)
      setError(null)
      try {
        // 1. Fetch Session
        const { data: sess, error: sessErr } = await supabase
          .from('mock_interview_sessions')
          .select('*')
          .eq('id', sessionId)
          .eq('student_id', profile.id)
          .single()

        if (sessErr || !sess) {
          throw new Error('Interview session not found or access denied.')
        }

        setSession(sess)

        // 2. Fetch Turns
        const { data: turnsData, error: turnsErr } = await supabase
          .from('mock_interview_turns')
          .select('*')
          .eq('session_id', sessionId)
          .order('turn_number', { ascending: true })

        if (turnsErr) throw turnsErr
        setTurns(turnsData || [])

        // If completed, fetch report
        if (sess.status === 'completed') {
          const { data: repData } = await supabase
            .from('mock_interview_reports')
            .select('*')
            .eq('session_id', sessionId)
            .maybeSingle()

          if (repData) {
            setReport(repData)
          }
        } else {
          // Determine active turn number
          const latestTurn = turnsData?.[turnsData.length - 1]
          if (latestTurn) {
            setCurrentTurnNumber(latestTurn.turn_number)
          }
        }
      } catch (err) {
        console.error('Error loading interview session:', err)
        setError(err.message || 'Failed to load session.')
      } finally {
        setLoading(false)
      }
    }

    loadSession()
  }, [sessionId, profile?.id])

  // Initialize Camera & Video Recording
  useEffect(() => {
    if (session?.status !== 'in_progress') return

    let active = true

    async function startCameraAndRecording() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: true
        })

        if (!active) {
          stream.getTracks().forEach(t => t.stop())
          return
        }

        mediaStreamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
        setCameraActive(true)

        // Initialize MediaRecorder
        recordedChunksRef.current = []
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? 'video/webm;codecs=vp8,opus'
          : 'video/webm'

        const recorder = new MediaRecorder(stream, { mimeType })
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunksRef.current.push(event.data)
          }
        }
        recorder.start(2000) // capture chunks every 2s
        mediaRecorderRef.current = recorder
      } catch (camErr) {
        console.warn('Camera/Mic permission denied or unavailable:', camErr)
      }
    }

    startCameraAndRecording()

    return () => {
      active = false
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop() } catch (err) { console.debug('Media recorder stop error:', err) }
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [session?.status, session?.id])

  // Finalize & Upload Video Recording (24-Hour Expiration)
  const uploadInterviewVideo = async () => {
    if (!mediaRecorderRef.current || recordedChunksRef.current.length === 0) return null

    return new Promise((resolve) => {
      try {
        const performUpload = async () => {
          try {
            setUploadingRecording(true)
            const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' })
            const fileName = `${profile.id}/${session.id}_${Date.now()}.webm`

            const { error: upErr } = await supabase.storage
              .from('interview-recordings')
              .upload(fileName, blob, {
                contentType: 'video/webm',
                upsert: true
              })

            if (upErr) {
              console.warn('Failed to upload interview recording:', upErr)
              resolve(null)
              return
            }

            const { data: { publicUrl } } = supabase.storage
              .from('interview-recordings')
              .getPublicUrl(fileName)

            // 24 Hours retention from now
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

            await supabase
              .from('mock_interview_sessions')
              .update({
                recording_url: publicUrl,
                recording_expires_at: expiresAt
              })
              .eq('id', session.id)

            // Stop camera tracks cleanly
            if (mediaStreamRef.current) {
              mediaStreamRef.current.getTracks().forEach(t => t.stop())
            }

            resolve(publicUrl)
          } catch (e) {
            console.error('Error during video upload:', e)
            resolve(null)
          } finally {
            setUploadingRecording(false)
          }
        }

        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.onstop = () => {
            performUpload()
          }
          mediaRecorderRef.current.stop()
        } else {
          performUpload()
        }
      } catch (err) {
        console.error('Video upload failed:', err)
        resolve(null)
      }
    })
  }

  // Handle Answer Submission
  const handleSubmitAnswer = async (e) => {
    e?.preventDefault()
    const trimmed = answerInput.trim()
    if (!trimmed || submitting || generatingReport || !session) return

    setSubmitting(true)
    setError(null)

    try {
      const activeTurn = turns.find(t => t.turn_number === currentTurnNumber)
      if (!activeTurn) throw new Error('Active turn not found')

      // 1. Call Edge Function with answer
      const { data, error: funcErr } = await supabase.functions.invoke('ai-mock-interview', {
        body: {
          action: 'answer',
          sessionId: session.id,
          turnNumber: currentTurnNumber,
          answer: trimmed
        }
      })

      if (funcErr) throw funcErr
      if (data?.error) throw new Error(data.error)

      // 2. Update local turns state
      const updatedTurns = turns.map(t => {
        if (t.turn_number === currentTurnNumber) {
          return {
            ...t,
            student_answer: trimmed,
            ai_feedback: data.feedback
          }
        }
        return t
      })

      if (!data.isCompleted && data.nextQuestion) {
        updatedTurns.push({
          session_id: session.id,
          turn_number: data.nextTurnNumber,
          question: data.nextQuestion,
          student_answer: null,
          ai_feedback: null
        })
        setCurrentTurnNumber(data.nextTurnNumber)
      }

      setTurns(updatedTurns)
      setAnswerInput('')

      // 3. If completed, upload video & trigger report generation
      if (data.isCompleted) {
        await uploadInterviewVideo()
        await generateFinalReport()
      }
    } catch (err) {
      console.error('Failed to submit answer:', err)
      setError(err.message || 'Failed to submit your response. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Generate Final Report
  const generateFinalReport = async () => {
    setGeneratingReport(true)
    setError(null)
    try {
      const { data, error: repErr } = await supabase.functions.invoke('ai-mock-interview', {
        body: {
          action: 'report',
          sessionId: session.id
        }
      })

      if (repErr) throw repErr
      if (data?.error) throw new Error(data.error)

      setReport(data.report)
      setSession(data.session)

      // Award XP for completion
      await awardXp({
        eventType: 'mock_interview_complete',
        referenceId: session.id,
        moduleType: 'interview',
        reason: `Completed AI Mock Interview (${session.track})`,
        metadata: {
          track: session.track,
          score: data.session?.overall_score || data.report?.overall_score,
          questions: session.question_count
        }
      })
    } catch (err) {
      console.error('Failed to generate report:', err)
      setError('Interview completed, but failed to load feedback report. Please refresh.')
    } finally {
      setGeneratingReport(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '1rem', color: 'var(--text-muted)' }}>
        <Sparkles className="animate-pulse" size={48} color="var(--primary-500)" />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>Loading Mock Interview...</h2>
      </div>
    )
  }

  if (error && !session) {
    return (
      <div className="glass-card" style={{ maxWidth: 600, margin: '3rem auto', padding: '2rem', textAlign: 'center' }}>
        <AlertCircle size={48} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Unable to Load Session</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{error}</p>
        <button className="btn-primary" onClick={() => navigate('/student/mock-interview')}>
          Return to Interview Hub
        </button>
      </div>
    )
  }

  // If report exists and session is completed, render report view
  if (session?.status === 'completed' && report) {
    return (
      <MockInterviewReportView
        session={session}
        report={report}
        onBackToHub={() => navigate('/student/mock-interview')}
        onStartNew={() => navigate('/student/mock-interview')}
      />
    )
  }

  const totalQuestions = session?.question_count || 5
  const progressPercent = Math.min(100, Math.round(((currentTurnNumber - 1) / totalQuestions) * 100))

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '2rem' }}>
      
      {/* Top Header Card */}
      <div className="glass-card" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ 
              width: 44, height: 44, 
              borderRadius: '12px', 
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              color: 'white',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)'
            }}>
              <Bot size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                {session?.track} Mock Interview
              </h2>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Question {currentTurnNumber} of {totalQuestions}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 140, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                <span>Progress</span>
                <span>{progressPercent}%</span>
              </div>
              <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progressPercent}%`, background: 'var(--primary-500)', borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
            </div>

            <button 
              onClick={() => setShowExitConfirm(true)}
              className="btn-secondary"
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem', color: '#ef4444' }}
              title="Exit Interview"
            >
              <LogOut size={16} /> Exit
            </button>
          </div>

        </div>
      </div>

      {/* Camera & Retention Disclaimer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        padding: '0.65rem 1rem',
        borderRadius: '10px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--sidebar-border)',
        fontSize: '0.82rem',
        color: 'var(--text-muted)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            background: cameraActive ? 'rgba(239, 68, 68, 0.15)' : 'rgba(148, 163, 184, 0.15)',
            color: cameraActive ? '#ef4444' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.75rem',
            padding: '0.2rem 0.5rem',
            borderRadius: '6px'
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: cameraActive ? '#ef4444' : '#94a3b8', animation: cameraActive ? 'pulse 1.5s infinite' : 'none' }} />
            {cameraActive ? 'REC ON' : 'CAMERA OFF'}
          </div>
          <span>Interview video is recorded and auto-deleted after <strong>24 hours</strong>.</span>
        </div>

        {uploadingRecording && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary-400)', fontWeight: 600 }}>
            <Loader2 size={14} className="animate-spin" /> Uploading recording...
          </div>
        )}
      </div>

      {/* Main Interview Grid with Camera Preview */}
      <div style={{ display: 'grid', gridTemplateColumns: cameraActive ? '1fr 240px' : '1fr', gap: '1.25rem', alignItems: 'start' }}>

        {/* Chat / Interview Stream */}
        <div 
          className="glass-card" 
          style={{ 
            padding: '1.5rem', 
            minHeight: '420px', 
            maxHeight: '560px', 
            overflowY: 'auto', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1.25rem' 
          }}
        >
        {turns.map((turn) => (
          <div key={turn.turn_number} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* AI Question Bubble */}
            <div style={{ display: 'flex', gap: '0.85rem', maxWidth: '85%' }}>
              <div style={{ 
                width: 34, height: 34, 
                borderRadius: '50%', 
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                color: 'white', flexShrink: 0, marginTop: '2px' 
              }}>
                <Bot size={18} />
              </div>
              <div style={{ 
                background: 'var(--bg-elevated)', 
                border: '1px solid var(--sidebar-border)', 
                borderRadius: '0 16px 16px 16px', 
                padding: '1rem 1.25rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-600)', textTransform: 'uppercase' }}>
                    Interviewer • Question {turn.turn_number}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: 1.55 }}>
                  {turn.question}
                </p>
              </div>
            </div>

            {/* Student Answer Bubble */}
            {turn.student_answer && (
              <div style={{ display: 'flex', gap: '0.85rem', maxWidth: '85%', alignSelf: 'flex-end', flexDirection: 'row-reverse' }}>
                <div style={{ 
                  width: 34, height: 34, 
                  borderRadius: '50%', 
                  background: 'var(--bg-elevated)', 
                  border: '1px solid var(--sidebar-border)', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  color: 'var(--text-primary)', flexShrink: 0, marginTop: '2px' 
                }}>
                  <User size={18} />
                </div>
                <div style={{ 
                  background: 'linear-gradient(135deg, #4f46e5, #6366f1)', 
                  color: 'white', 
                  borderRadius: '16px 0 16px 16px', 
                  padding: '1rem 1.25rem',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)'
                }}>
                  <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                    {turn.student_answer}
                  </p>
                </div>
              </div>
            )}

            {/* AI Feedback / Transition Bubble */}
            {turn.ai_feedback && (
              <div style={{ display: 'flex', gap: '0.85rem', maxWidth: '85%' }}>
                <div style={{ 
                  width: 34, height: 34, 
                  borderRadius: '50%', 
                  background: 'rgba(99, 102, 241, 0.1)', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  color: 'var(--primary-600)', flexShrink: 0, marginTop: '2px' 
                }}>
                  <Sparkles size={18} />
                </div>
                <div style={{ 
                  background: 'rgba(99, 102, 241, 0.05)', 
                  border: '1px dashed rgba(99, 102, 241, 0.3)', 
                  borderRadius: '0 16px 16px 16px', 
                  padding: '0.85rem 1.15rem'
                }}>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.5 }}>
                    {turn.ai_feedback}
                  </p>
                </div>
              </div>
            )}

          </div>
        ))}

        {/* Loading / Submitting indicator */}
        {(submitting || generatingReport) && (
          <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center', padding: '0.5rem 0' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--primary-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-600)' }}>
              <Loader2 className="animate-spin" size={18} />
            </div>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {generatingReport ? "Analyzing interview performance & compiling structured report..." : "Interviewer is evaluating your response..."}
            </span>
          </div>
        )}

        <div ref={chatEndRef} />
        </div>

        {/* Floating / Side Camera Preview Tile */}
        {cameraActive && (
          <div className="glass-card" style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>
                Live Camera
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: '#ef4444', fontWeight: 700 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} /> REC
              </div>
            </div>

            <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', borderRadius: '10px', overflow: 'hidden', background: '#000' }}>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
              />
              <div style={{ position: 'absolute', bottom: 6, left: 6, display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(0,0,0,0.6)', padding: '0.15rem 0.4rem', borderRadius: 4, color: '#fff', fontSize: '0.65rem' }}>
                <Mic size={10} color="#10b981" /> Mic Active
              </div>
            </div>

            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.35 }}>
              Your video & audio are securely recorded for instructor evaluation and auto-deleted after 24 hours.
            </p>
          </div>
        )}

      </div>

      {/* Answer Input Panel */}
      {!generatingReport && (
        <form onSubmit={handleSubmitAnswer} className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                Your Response (Question {currentTurnNumber} of {totalQuestions})
              </label>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {answerInput.length} chars • Ctrl + Enter to submit
              </span>
            </div>

            <textarea
              rows={4}
              value={answerInput}
              onChange={(e) => setAnswerInput(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault()
                  handleSubmitAnswer()
                }
              }}
              disabled={submitting}
              placeholder="Structure your answer with key concepts, trade-offs, architecture, and practical examples..."
              style={{
                width: '100%',
                padding: '0.85rem 1rem',
                borderRadius: '10px',
                border: '1px solid var(--sidebar-border)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '0.95rem',
                lineHeight: 1.5,
                resize: 'vertical',
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <HelpCircle size={14} /> Be concise and explain your reasoning clearly.
              </span>

              <button
                type="submit"
                disabled={!answerInput.trim() || submitting}
                className="btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 1.5rem',
                  opacity: (!answerInput.trim() || submitting) ? 0.6 : 1
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" size={16} /> Submitting...
                  </>
                ) : (
                  <>
                    <Send size={16} /> Submit Answer
                  </>
                )}
              </button>
            </div>

          </div>
        </form>
      )}

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem'
        }}>
          <div className="glass-card" style={{ maxWidth: 440, width: '100%', padding: '1.75rem', background: 'var(--bg-primary)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Leave Mock Interview?
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              You are currently on Question {currentTurnNumber} of {totalQuestions}. If you leave now, you can resume this session later from your Interview Hub.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button 
                className="btn-secondary" 
                onClick={() => setShowExitConfirm(false)}
              >
                Continue Interview
              </button>
              <button 
                className="btn-primary" 
                style={{ background: '#ef4444' }}
                onClick={() => navigate('/student/mock-interview')}
              >
                Exit to Hub
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
