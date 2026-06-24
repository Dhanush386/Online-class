import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { supabase } from '../../lib/supabase'
import { 
  ShieldAlert, Activity, FileText, CheckCircle, 
  X, Image as ImageIcon, RefreshCw, 
  FileDown, ShieldCheck, HelpCircle, Network, BarChart3, AlertOctagon 
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

export default function ProctoringReportModal({ 
  sessionId, 
  studentId, 
  assessmentId, 
  challengeId, 
  onClose 
}) {
  const [activeTab, setActiveTab] = useState('summary')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [session, setSession] = useState(null)
  const [violations, setViolations] = useState([])
  const [selectedImage, setSelectedImage] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchSessionDetails()
  }, [sessionId, studentId, assessmentId, challengeId])

  const fetchSessionDetails = async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('proctoring_sessions')
        .select(`
          id,
          student_id,
          assessment_id,
          challenge_id,
          start_time,
          end_time,
          final_risk_score,
          total_violations,
          status,
          review_status,
          ai_summary,
          users(name, email),
          assessments(title),
          coding_challenges(title)
        `)

      if (sessionId) {
        query = query.eq('id', sessionId)
      } else if (studentId) {
        query = query.eq('student_id', studentId)
        if (assessmentId) {
          query = query.eq('assessment_id', assessmentId)
        } else if (challengeId) {
          query = query.eq('challenge_id', challengeId)
        }
      }

      const { data, error: sessionErr } = await query
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (sessionErr) throw sessionErr
      if (!data) {
        setSession(null)
        setViolations([])
        setLoading(false)
        return
      }

      // If review_status is null or missing, set default to 'pending'
      if (!data.review_status) {
        data.review_status = 'pending'
      }

      setSession(data)

      // Fetch violations
      const { data: viols, error: violsErr } = await supabase
        .from('proctoring_violations')
        .select('*')
        .eq('session_id', data.id)
        .order('timestamp', { ascending: false })

      if (violsErr) throw violsErr
      setViolations(viols || [])
    } catch (err) {
      console.error('Error fetching proctoring details:', err)
      setError('Failed to load proctoring report details. The student may not have started the session yet.')
    } finally {
      setLoading(false)
    }
  }

  const updateReviewStatus = async (status) => {
    if (!session) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('proctoring_sessions')
        .update({ review_status: status })
        .eq('id', session.id)

      if (error) throw error
      setSession(prev => ({ ...prev, review_status: status }))
    } catch (err) {
      console.error('Error updating review status:', err)
      alert('Failed to update review status.')
    } finally {
      setSaving(false)
    }
  }

  const generateAISummary = async () => {
    if (!session) return
    setAiLoading(true)
    try {
      // Calculate violations counts
      const counts = {
        tabSwitch: violations.filter(v => v.violation_type === 'tab_switch').length,
        phoneDetected: violations.filter(v => v.violation_type === 'phone_detected').length,
        multipleFaces: violations.filter(v => v.violation_type === 'multiple_faces').length,
        faceLost: violations.filter(v => v.violation_type === 'face_lost').length,
      }

      const durationMin = calculateDurationMinutes()

      const { data, error } = await supabase.functions.invoke('proctor-ai-summary', {
        body: {
          studentName: session.users?.name || 'Student',
          assessmentTitle: session.assessments?.title || session.coding_challenges?.title || 'Assessment',
          riskScore: session.final_risk_score,
          violations: counts,
          durationMinutes: Math.round(durationMin)
        }
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      // Save summary back to database
      const summary = data.summary
      const { error: saveError } = await supabase
        .from('proctoring_sessions')
        .update({ ai_summary: summary })
        .eq('id', session.id)

      if (saveError) throw saveError

      setSession(prev => ({ ...prev, ai_summary: summary }))
    } catch (err) {
      console.error('Error calling AI summary edge function:', err)
      alert('Failed to generate AI Summary: ' + err.message)
    } finally {
      setAiLoading(false)
    }
  }

  const calculateDurationMinutes = () => {
    if (!session) return 0
    const start = new Date(session.start_time)
    const end = session.end_time ? new Date(session.end_time) : new Date()
    return Math.max(0.5, (end - start) / 60000)
  }

  const formatDuration = () => {
    if (!session) return 'N/A'
    const start = new Date(session.start_time)
    const end = session.end_time ? new Date(session.end_time) : new Date()
    const diffMs = end - start
    
    const hrs = Math.floor(diffMs / 3600000)
    const mins = Math.floor((diffMs % 3600000) / 60000)
    const secs = Math.floor((diffMs % 60000) / 1000)

    let parts = []
    if (hrs > 0) parts.push(`${hrs}h`)
    if (mins > 0 || hrs > 0) parts.push(`${mins}m`)
    parts.push(`${secs}s`)
    return parts.join(' ')
  }

  const getRiskStatus = (score) => {
    if (score >= 100) return { label: 'CRITICAL', color: '#ef4444', bg: '#fef2f2', border: '#fecaca' }
    if (score >= 60) return { label: 'HIGH RISK', color: '#f97316', bg: '#fff7ed', border: '#ffedd5' }
    if (score >= 30) return { label: 'WARNING', color: '#eab308', bg: '#fef9c3', border: '#fef08a' }
    return { label: 'SAFE', color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' }
  }

  const getNetworkQuality = () => {
    // Return connection status based on violations list or default
    if (violations.length === 0) return 'Excellent'
    const disconnections = violations.filter(v => v.violation_type === 'disconnected').length
    if (disconnections > 3) return 'Poor'
    if (disconnections > 1) return 'Fair'
    return 'Good'
  }

  const getQualityGrade = (quality) => {
    if (quality === 'Excellent') return '98%'
    if (quality === 'Good') return '85%'
    return '60%'
  }

  const getViolationColor = (increment) => {
    if (increment >= 40) return '#ef4444'
    if (increment >= 20) return '#f97316'
    return '#eab308'
  }

  const getBase64Image = async (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'Anonymous'
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/jpeg'))
      }
      img.onerror = (err) => {
        console.error("Failed to load image for PDF embedding:", err)
        reject(new Error("Failed to load image for PDF embedding"))
      }
      img.src = url
    })
  }

  const downloadPDFReport = async () => {
    if (!session) return
    const doc = new jsPDF()
    const risk = getRiskStatus(session.final_risk_score)
    const title = session.assessments?.title || session.coding_challenges?.title || 'Learnova Assessment'

    // ==========================================
    // PAGE 1: Candidate Details & Risk Summary
    // ==========================================
    doc.setFillColor(30, 41, 59) // slate-800
    doc.rect(0, 0, 210, 40, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18)
    doc.setFont("helvetica", "bold")
    doc.text("LEARNOVA SECURITY ASSESSMENT REPORT", 14, 25)

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 34)

    // Divider Line
    doc.setDrawColor(226, 232, 240) // border color
    doc.setLineWidth(0.5)

    // Section: Candidate Details
    doc.setTextColor(30, 41, 59)
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("Candidate Details", 14, 55)
    doc.line(14, 57, 196, 57)

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(`Name: ${session.users?.name || 'Unknown'}`, 14, 65)
    doc.text(`Email: ${session.users?.email || 'N/A'}`, 14, 72)
    doc.text(`Target Course/Assessment: ${title}`, 14, 79)

    // Section: Session Details
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("Session Details", 14, 95)
    doc.line(14, 97, 196, 97)

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(`Start Time: ${new Date(session.start_time).toLocaleString()}`, 14, 105)
    doc.text(`End Time: ${session.end_time ? new Date(session.end_time).toLocaleString() : 'Active/Unfinished'}`, 14, 112)
    doc.text(`Total Duration: ${formatDuration()}`, 14, 119)
    doc.text(`Review Status: ${session.review_status?.toUpperCase() || 'PENDING'}`, 14, 126)

    // Section: Risk Summary
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("Security & Risk Summary", 14, 142)
    doc.line(14, 144, 196, 144)

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(`Final Risk Score: ${session.final_risk_score}`, 14, 152)
    doc.text(`Risk Classification: ${risk.label}`, 14, 159)
    doc.text(`Total Recorded Violations: ${session.total_violations}`, 14, 166)

    // Highlight Box for Risk Tier
    let boxColor = [16, 185, 129] // safe green
    if (session.final_risk_score >= 100) boxColor = [239, 68, 68] // critical red
    else if (session.final_risk_score >= 60) boxColor = [249, 115, 22] // high orange
    else if (session.final_risk_score >= 30) boxColor = [234, 179, 8] // warning yellow

    doc.setFillColor(boxColor[0], boxColor[1], boxColor[2])
    doc.rect(14, 175, 182, 10, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont("helvetica", "bold")
    doc.text(`STATUS: ${risk.label} (${session.final_risk_score} RISK SCORE)`, 20, 181)

    // AI Summary Area on Page 1
    doc.setTextColor(30, 41, 59)
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("AI Review Analysis", 14, 205)
    doc.line(14, 207, 196, 207)

    doc.setFontSize(10)
    doc.setFont("helvetica", "oblique")
    const aiText = session.ai_summary || "No AI summary generated for this session. Use the online panel to run Gemini security analysis."
    const splitAiText = doc.splitTextToSize(aiText, 182)
    doc.text(splitAiText, 14, 215)

    // ==========================================
    // PAGE 2: Violation Timeline
    // ==========================================
    doc.addPage()
    doc.setTextColor(30, 41, 59)
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.text("Violation Log & Timeline", 14, 20)
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text("Chronological log of security alerts registered by the AI client-side proctoring engine.", 14, 26)
    doc.line(14, 29, 196, 29)

    const tableRows = violations.map(v => [
      new Date(v.timestamp).toLocaleTimeString(),
      v.violation_type?.replace('_', ' ')?.toUpperCase() || 'UNKNOWN',
      `+${v.risk_score_increment} Risk`,
      v.evidence_url ? 'Screenshot Attached' : 'No screenshot'
    ])

    doc.autoTable({
      startY: 33,
      head: [['Time', 'Violation Category', 'Risk Delta', 'Evidence']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 }
    })

    // ==========================================
    // PAGE 3+: Evidence Gallery
    // ==========================================
    const screenshotViolations = violations.filter(v => v.evidence_url)
    if (screenshotViolations.length > 0) {
      doc.addPage()
      doc.setTextColor(30, 41, 59)
      doc.setFontSize(14)
      doc.setFont("helvetica", "bold")
      doc.text("Evidence Gallery (Captured Screenshots)", 14, 20)
      doc.line(14, 23, 196, 23)

      let yPos = 30
      let pageCount = 3

      for (let index = 0; index < screenshotViolations.length; index++) {
        const v = screenshotViolations[index]
        
        // If we exceed vertical limit, start a new page
        if (yPos > 240) {
          doc.addPage()
          pageCount++
          yPos = 20
        }

        doc.setFontSize(10)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(239, 68, 68) // red text for severity
        doc.text(`${index + 1}. ${v.violation_type?.replace('_', ' ')?.toUpperCase()}`, 14, yPos)
        
        doc.setFontSize(8)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(100, 116, 139)
        doc.text(`Time: ${new Date(v.timestamp).toLocaleTimeString()} | Increment: +${v.risk_score_increment} Risk`, 14, yPos + 4)

        try {
          // Convert image link to Base64
          const base64Img = await getBase64Image(v.evidenceUrl || v.evidence_url)
          // Embed image (width 120, height 70 approx to match 4:3 aspect ratio)
          doc.addImage(base64Img, 'JPEG', 14, yPos + 7, 100, 56)
          yPos += 72
        } catch (e) {
          console.error("Failed to embed image in PDF:", e)
          doc.setTextColor(156, 163, 175)
          doc.setFont("helvetica", "oblique")
          doc.text("[Image could not be embedded - Network CORS restriction or invalid URL]", 14, yPos + 10)
          yPos += 20
        }
      }
    }

    doc.save(`Proctoring_Report_${session.users?.name || 'Student'}_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div className="glass-card zoom-in" style={{ padding: '3rem', width: 320, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'white', borderRadius: 16 }}>
          <RefreshCw className="animate-spin text-indigo-600 mb-4" size={32} />
          <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Loading proctoring logs...</p>
        </div>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div className="glass-card zoom-in" style={{ padding: '2.5rem', maxWidth: 450, width: '90%', textAlign: 'center', background: 'white', borderRadius: 16, border: '1px solid #fee2e2' }}>
          <AlertOctagon size={48} className="text-red-500 mx-auto mb-4" />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Report Unavailable</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
            {error || 'No active or historical proctoring session found for this student and evaluation.'}
          </p>
          <button onClick={onClose} className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
            Dismiss
          </button>
        </div>
      </div>
    )
  }

  const risk = getRiskStatus(session.final_risk_score)
  const title = session.assessments?.title || session.coding_challenges?.title || 'Evaluation'

  // Statistics calculation
  const totalViolations = violations.length
  const tabSwitches = violations.filter(v => v.violation_type === 'tab_switch').length
  const phones = violations.filter(v => v.violation_type === 'phone_detected').length
  const multipleFaces = violations.filter(v => v.violation_type === 'multiple_faces').length
  const faceLosses = violations.filter(v => v.violation_type === 'face_lost').length
  const netQuality = getNetworkQuality()

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div className="glass-card zoom-in" style={{ width: '100%', maxWidth: 850, height: '90vh', background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(135deg, #1e293b, #0f172a)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert size={20} color="#f87171" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Proctoring Session Report</h2>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: risk.bg, color: risk.color, border: `1px solid ${risk.border}` }}>
                {risk.label}
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
              Candidate: <strong>{session.users?.name || 'Student'}</strong> ({session.users?.email}) • {title}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button 
              onClick={downloadPDFReport}
              className="btn-primary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', padding: '0.5rem 1rem', background: '#3b82f6', border: 'none' }}
            >
              <FileDown size={16} /> PDF Report
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', padding: 4 }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', padding: '0 1rem' }}>
          {[
            { id: 'summary', label: 'Summary', icon: <FileText size={14} /> },
            { id: 'stats', label: 'Statistics', icon: <BarChart3 size={14} /> },
            { id: 'timeline', label: 'Timeline', icon: <Activity size={14} /> },
            { id: 'gallery', label: `Evidence (${violations.filter(v => v.evidence_url).length})`, icon: <ImageIcon size={14} /> },
            { id: 'ai', label: 'AI Review', icon: <ShieldCheck size={14} /> }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '1rem 1.25rem',
                border: 'none',
                background: 'none',
                borderBottom: activeTab === t.id ? '2px solid #3b82f6' : '2px solid transparent',
                color: activeTab === t.id ? '#3b82f6' : '#64748b',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Content body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          
          {/* TAB: Summary */}
          {activeTab === 'summary' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div style={{ padding: '1.25rem', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Current Risk Score</div>
                  <div style={{ fontSize: '2rem', fontWeight: 850, color: risk.color, marginTop: '0.25rem' }}>
                    {session.final_risk_score}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>Classification: {risk.label}</div>
                </div>

                <div style={{ padding: '1.25rem', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Session Duration</div>
                  <div style={{ fontSize: '2rem', fontWeight: 850, color: '#0f172a', marginTop: '0.25rem' }}>
                    {formatDuration()}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                    Started: {new Date(session.start_time).toLocaleTimeString()}
                  </div>
                </div>

                <div style={{ padding: '1.25rem', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total Violations</div>
                  <div style={{ fontSize: '2rem', fontWeight: 850, color: totalViolations > 0 ? '#ef4444' : '#10b981', marginTop: '0.25rem' }}>
                    {session.total_violations}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>Warnings sent: {violations.filter(v => v.violation_type === 'warning_sent').length}</div>
                </div>
              </div>

              {/* Status Update Actions */}
              <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>Faculty Review Controls</h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
                  Change the review state of this session submission for administrative tracking.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>Review Status:</span>
                  <select
                    value={session.review_status}
                    onChange={(e) => updateReviewStatus(e.target.value)}
                    disabled={saving}
                    style={{ padding: '0.5rem 1rem', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem', background: 'white', fontWeight: 600, color: '#1e293b' }}
                  >
                    <option value="pending">⏳ Pending Review</option>
                    <option value="reviewed_safe">🟢 Reviewed - Clear/Safe</option>
                    <option value="reviewed_flagged">🔴 Reviewed - Flagged/Suspicious</option>
                    <option value="needs_followup">🟡 Needs Follow-up</option>
                  </select>
                  {saving && <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Saving...</span>}
                </div>
              </div>

              {/* Auto escalation notice */}
              <div style={{ display: 'flex', gap: '0.75rem', padding: '1rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, color: '#1e40af', fontSize: '0.8rem', lineHeight: 1.5 }}>
                <HelpCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>Security Escalation Rules Policy:</strong> When the candidate exceeds <strong>200 Risk Points</strong> (or logs more than 3 active warnings/exits), the session is marked for automatic review. The student is never failed automatically without manual faculty validation.
                </div>
              </div>
            </div>
          )}

          {/* TAB: Statistics */}
          {activeTab === 'stats' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <BarChart3 size={16} /> Violation Frequency
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {[
                      { label: 'Tab Switch / Focus Lost', count: tabSwitches, color: '#3b82f6' },
                      { label: 'Cell Phone Detected', count: phones, color: '#ef4444' },
                      { label: 'Multiple Faces', count: multipleFaces, color: '#f59e0b' },
                      { label: 'Webcam Face Lost', count: faceLosses, color: '#6366f1' }
                    ].map(item => (
                      <div key={item.label} style={{ fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontWeight: 600 }}>
                          <span>{item.label}</span>
                          <span>{item.count}</span>
                        </div>
                        <div style={{ width: '100%', height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, (item.count / Math.max(1, totalViolations)) * 100)}%`, height: '100%', background: item.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Network size={16} /> Network Stability & Health
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: netQuality === 'Excellent' || netQuality === 'Good' ? '#ecfdf5' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                      📶
                    </div>
                    <div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>{netQuality} Connection</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                        Telemetry signals monitored over LiveKit SFU channel.
                      </div>
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
                      <span>Quality Grade:</span>
                      <strong style={{ color: '#0f172a' }}>{getQualityGrade(netQuality)}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Timeline */}
          {activeTab === 'timeline' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {violations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  <CheckCircle size={36} color="#10b981" style={{ margin: '0 auto 1rem' }} />
                  <p style={{ fontWeight: 600 }}>No violations or warnings logged.</p>
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Student is fully compliant with the security regulations.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {violations.map((v, i) => (
                    <div key={v.id || i} style={{ display: 'flex', justifyItems: 'center', justifySelf: 'stretch', gap: '1rem', padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', borderLeft: `4px solid ${getViolationColor(v.risk_score_increment)}` }}>
                      <div style={{ width: 64, flexShrink: 0, fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                        {new Date(v.timestamp).toLocaleTimeString()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>
                          {v.violation_type?.replace('_', ' ')?.toUpperCase()}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>
                          Added {v.risk_score_increment} points to risk score
                        </div>
                      </div>
                      {v.evidence_url && (
                        <button
                          onClick={() => setSelectedImage(v.evidence_url)}
                          style={{ padding: '4px 8px', background: 'white', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <ImageIcon size={12} /> View Snapshot
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: Evidence Gallery */}
          {activeTab === 'gallery' && (
            <div>
              {violations.filter(v => v.evidence_url).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  <ImageIcon size={36} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                  <p style={{ fontWeight: 600 }}>No screenshots recorded.</p>
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Screenshots are automatically captured when cell phones or multiple faces are detected.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                  {violations.filter(v => v.evidence_url).map((v, i) => (
                    <div 
                      key={v.id || i}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedImage(v.evidence_url)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedImage(v.evidence_url)
                        }
                      }}
                      style={{ cursor: 'pointer', overflow: 'hidden', border: '1px solid #cbd5e1', borderRadius: 8, background: '#000', display: 'flex', flexDirection: 'column', transition: 'transform 0.2s', position: 'relative' }}
                    >
                      <div style={{ position: 'relative', width: '100%', paddingBottom: '75%' }}>
                        <img 
                          src={v.evidence_url} 
                          alt="Evidence Snapshot" 
                          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                      <div style={{ background: '#f8fafc', padding: '0.5rem', borderTop: '1px solid #cbd5e1' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {v.violation_type === 'phone_detected' ? '📱' : '👥'} {v.violation_type?.replace('_', ' ')?.toUpperCase()}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}>
                          <span>{new Date(v.timestamp).toLocaleTimeString()}</span>
                          <span style={{ color: '#ef4444', fontWeight: 700 }}>+{v.risk_score_increment} Risk</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: AI Review */}
          {activeTab === 'ai' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ padding: '1.25rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 12, display: 'flex', gap: '0.75rem', color: '#0369a1' }}>
                <ShieldCheck size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>Gemini AI Co-Pilot Assistant</h4>
                  <p style={{ fontSize: '0.75rem', lineHeight: 1.4, marginTop: '0.25rem' }}>
                    Our AI models generate summaries based on student focus log timelines, device alerts, and behavioral patterns to assist examiners.
                  </p>
                </div>
              </div>

              <div style={{ minHeight: 120, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
                {aiLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100, gap: '0.5rem', color: '#475569', fontSize: '0.85rem' }}>
                    <RefreshCw className="animate-spin text-blue-600" size={20} />
                    Analyzing proctoring metrics via Supabase Edge Function...
                  </div>
                ) : (
                  <div>
                    <h4 style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>AI Summary Report</h4>
                    <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: '#1e293b', fontStyle: 'italic', margin: 0 }}>
                      {session.ai_summary || "No AI summary has been generated for this session yet. Click the button below to generate."}
                    </p>
                  </div>
                )}
                
                <div style={{ textAlign: 'right' }}>
                  <button
                    onClick={generateAISummary}
                    disabled={aiLoading}
                    className="btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', background: 'white', color: '#3b82f6', borderColor: '#3b82f6', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <RefreshCw size={14} className={aiLoading ? 'animate-spin' : ''} />
                    {session.ai_summary ? 'Re-generate Summary' : 'Generate AI Summary'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button onClick={onClose} className="btn-secondary" style={{ fontSize: '0.85rem' }}>
            Close Report
          </button>
        </div>

      </div>

      {/* Fullscreen Image Preview */}
      {selectedImage && (
        <div 
          role="button"
          tabIndex={0}
          onClick={() => setSelectedImage(null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
              e.preventDefault()
              setSelectedImage(null)
            }
          }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '2rem' }}
        >
          <div style={{ relative: 'true', maxWidth: '90%', maxHeight: '90%', background: '#000', borderRadius: 8, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <img 
              src={selectedImage} 
              alt="Fullscreen Evidence" 
              style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', display: 'block' }}
            />
            <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.5)', color: 'white', padding: '4px 8px', borderRadius: '50%', cursor: 'pointer', display: 'flex' }}>
              <X size={16} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

ProctoringReportModal.propTypes = {
  sessionId: PropTypes.string,
  studentId: PropTypes.string,
  assessmentId: PropTypes.string,
  challengeId: PropTypes.string,
  onClose: PropTypes.func.isRequired
}
