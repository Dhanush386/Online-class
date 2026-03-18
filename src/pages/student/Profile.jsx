import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { 
    User, Mail, Phone, MapPin, Briefcase, GraduationCap, 
    Link as LinkIcon, Github, Twitter, Linkedin, Trophy, 
    Camera, Upload, Trash2, Plus, ChevronDown, ChevronRight,
    Search, Languages, Globe, Calendar, CheckCircle2, AlertCircle,
    X, Loader2, Save, MessageSquare, HelpCircle
} from 'lucide-react'

const sections = [
    { id: 'basic', label: 'Basic Details', icon: CheckCircle2 },
    { id: 'education', label: 'Education Details', icon: CheckCircle2 },
    { id: 'work', label: 'Work Experience', icon: CheckCircle2 },
    { id: 'projects', label: 'Projects & Achievements', icon: CheckCircle2 }
]

const basicSubSections = [
    { id: 'profile', label: 'Student Profile' },
    { id: 'contact', label: 'Student Contact Details' },
    { id: 'parent', label: 'Parent/Guardian Details' },
    { id: 'address', label: 'Current Address' },
    { id: 'expertise', label: 'Current Expertise' },
    { id: 'preference', label: 'Your Preference' }
]

export default function Profile() {
    const { profile, user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [activeSection, setActiveSection] = useState('basic')
    const [activeSubSection, setActiveSubSection] = useState('profile')
    const [toast, setToast] = useState(null)
    const [isCameraOpen, setIsCameraOpen] = useState(false)
    
    // Form State
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        certificate_name: '',
        gender: 'Male',
        languages_communication: [],
        language_teaching: 'Tamil',
        language_watching: 'Tamil',
        dob: '',
        linkedin_url: '',
        twitter_url: '',
        github_url: '',
        codechef_url: '',
        hackerrank_url: '',
        leetcode_url: '',
        resume_url: '',
        photo_url: '',
        whatsapp_number: '',
        parent_first_name: '',
        parent_last_name: '',
        parent_relation: 'Mother',
        parent_occupation: 'Farmer',
        parent_email: '',
        parent_phone: '',
        parent_whatsapp: '',
        address_line1: '',
        address_line2: '',
        country: 'India',
        pincode: '',
        state: 'Tamil Nadu',
        district: 'Krishnagiri',
        city: 'Krishnagiri',
        coding_level: "I don't have knowledge in coding",
        has_laptop: true,
        technical_skills: [],
        education_details: [],
        work_experience: [],
        projects_achievements: []
    })

    const fileInputRef = useRef(null)
    const resumeInputRef = useRef(null)
    const videoRef = useRef(null)
    const canvasRef = useRef(null)
    const [stream, setStream] = useState(null)

    useEffect(() => {
        loadProfile()
    }, [user])

    async function loadProfile() {
        if (!user) return
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('student_profiles')
                .select('*')
                .eq('student_id', user.id)
                .single()

            if (error && error.code !== 'PGRST116') throw error
            
            if (data) {
                setFormData(prev => ({ ...prev, ...data }))
            } else {
                // Initialize with some data from user profile if available
                setFormData(prev => ({
                    ...prev,
                    first_name: profile?.name?.split(' ')[0] || '',
                    last_name: profile?.name?.split(' ').slice(1).join(' ') || '',
                    certificate_name: profile?.name || ''
                }))
            }
        } catch (err) {
            console.error('Error loading profile:', err)
            setToast({ type: 'error', message: 'Failed to load profile details' })
        } finally {
            setLoading(false)
        }
    }

    async function handleSave() {
        try {
            setSaving(true)
            const { error } = await supabase
                .from('student_profiles')
                .upsert({
                    student_id: user.id,
                    ...formData,
                    updated_at: new Date().toISOString()
                })

            if (error) throw error
            setToast({ type: 'success', message: 'Profile updated successfully!' })
        } catch (err) {
            console.error('Error saving profile:', err)
            setToast({ type: 'error', message: 'Failed to save profile' })
        } finally {
            setSaving(false)
        }
    }

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }))
    }

    const handleFileUpload = async (e, type) => {
        const file = e.target.files[0]
        if (!file) return

        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `${user.id}/${type}_${Math.random()}.${fileExt}`
            const filePath = `${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('profiles')
                .upload(filePath, file, { upsert: true })

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('profiles')
                .getPublicUrl(filePath)

            setFormData(prev => ({
                ...prev,
                [type === 'photo' ? 'photo_url' : 'resume_url']: publicUrl
            }))
            setToast({ type: 'success', message: `${type === 'photo' ? 'Photo' : 'Resume'} uploaded!` })
        } catch (err) {
            console.error('Error uploading file:', err)
            setToast({ type: 'error', message: 'Upload failed' })
        }
    }

    const startCamera = async () => {
        try {
            const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 400, height: 480 } })
            setStream(s)
            setIsCameraOpen(true)
            if (videoRef.current) videoRef.current.srcObject = s
        } catch (err) {
            console.error('Camera access denied:', err)
            setToast({ type: 'error', message: 'Please allow camera access' })
        }
    }

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop())
            setStream(null)
        }
        setIsCameraOpen(false)
    }

    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return

        const context = canvasRef.current.getContext('2d')
        canvasRef.current.width = videoRef.current.videoWidth
        canvasRef.current.height = videoRef.current.videoHeight
        context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height)

        canvasRef.current.toBlob(async (blob) => {
            const file = new File([blob], "captured_photo.jpg", { type: "image/jpeg" })
            
            // Reuse upload logic with synthetic event
            const syntheticEvent = { target: { files: [file] } }
            await handleFileUpload(syntheticEvent, 'photo')
            stopCamera()
        }, 'image/jpeg', 0.9)
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Loader2 className="animate-spin" size={32} color="#10b981" />
            </div>
        )
    }

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: '4rem', position: 'relative' }}>
            {/* Local Toast Notification */}
            {toast && (
                <div style={{
                    position: 'fixed',
                    top: '2rem',
                    right: '2rem',
                    zIndex: 2000,
                    padding: '1rem 1.5rem',
                    borderRadius: 12,
                    background: toast.type === 'success' ? '#10b981' : '#ef4444',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                    animation: 'slideIn 0.3s ease-out'
                }}>
                    {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{toast.message}</span>
                    <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 4 }}>
                        <X size={16} />
                    </button>
                    <style>{`
                        @keyframes slideIn {
                            from { transform: translateX(100%); opacity: 0; }
                            to { transform: translateX(0); opacity: 1; }
                        }
                    `}</style>
                </div>
            )}
            
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                
                {/* Left Sidebar Navigation */}
                <div style={{ width: 300, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {sections.map(section => (
                        <div key={section.id} style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                            <button
                                onClick={() => setActiveSection(section.id)}
                                style={{
                                    width: '100%',
                                    padding: '1.25rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    textAlign: 'left'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ 
                                        width: 28, 
                                        height: 28, 
                                        borderRadius: '50%', 
                                        background: activeSection === section.id ? '#10b981' : '#f1f5f9',
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center' 
                                    }}>
                                        <section.icon size={16} color={activeSection === section.id ? 'white' : '#64748b'} />
                                    </div>
                                    <span style={{ fontWeight: 600, color: activeSection === section.id ? '#10b981' : '#334155' }}>{section.label}</span>
                                </div>
                                {section.id === 'basic' ? (
                                    <ChevronDown size={18} color="#64748b" style={{ transform: activeSection === 'basic' ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
                                ) : (
                                    <ChevronRight size={18} color="#64748b" />
                                )}
                            </button>

                            {section.id === 'basic' && activeSection === 'basic' && (
                                <div style={{ padding: '0 1.25rem 1.25rem 3.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', position: 'relative' }}>
                                    {/* Timeline line */}
                                    <div style={{ position: 'absolute', left: '2rem', top: 0, bottom: '2rem', width: 2, background: '#f1f5f9' }} />
                                    
                                    {basicSubSections.map(sub => (
                                        <button
                                            key={sub.id}
                                            onClick={() => setActiveSubSection(sub.id)}
                                            style={{
                                                padding: '0.6rem 1rem',
                                                borderRadius: 8,
                                                background: activeSubSection === sub.id ? 'rgba(16,185,129,0.08)' : 'none',
                                                color: activeSubSection === sub.id ? '#10b981' : '#64748b',
                                                border: 'none',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                fontSize: '0.85rem',
                                                fontWeight: 500,
                                                position: 'relative',
                                                zIndex: 1
                                            }}
                                        >
                                            <div style={{ 
                                                position: 'absolute', 
                                                left: '-1.65rem', 
                                                top: '50%', 
                                                transform: 'translateY(-50%)', 
                                                width: 8, 
                                                height: 8, 
                                                borderRadius: '50%', 
                                                background: activeSubSection === sub.id ? '#10b981' : '#cbd5e1',
                                                border: '2px solid white'
                                            }} />
                                            {sub.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Right Content Area */}
                <div style={{ flex: 1, background: 'white', borderRadius: 24, padding: '2.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.04)', minHeight: 600 }}>
                    {activeSection === 'basic' && (
                        <>
                            {activeSubSection === 'profile' && (
                                <section>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                        <div>
                                            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>Student Profile</h2>
                                            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Information you provide will be used for IRC Certificate etc.. Write your Name and other details carefully, just as you would in an official document.</p>
                                        </div>
                                        <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', background: 'none', border: 'none', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>
                                            <HelpCircle size={18} /> Help Guide
                                        </button>
                                    </div>

                                    <div style={{ marginBottom: '2.5rem' }}>
                                        <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Photo</label>
                                        <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1rem' }}>This will be your profile photo. Same will be used for exams, placements etc..</p>
                                        
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                                            <div style={{ 
                                                width: 150, 
                                                height: 180, 
                                                borderRadius: 12, 
                                                background: '#f8fafc', 
                                                border: '2px dashed #e2e8f0',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                overflow: 'hidden',
                                                position: 'relative'
                                            }}>
                                                {formData.photo_url ? (
                                                    <img src={formData.photo_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <Camera size={40} color="#cbd5e1" />
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                <input 
                                                    type="file" 
                                                    ref={fileInputRef} 
                                                    style={{ display: 'none' }} 
                                                    accept="image/*"
                                                    onChange={(e) => handleFileUpload(e, 'photo')}
                                                />
                                                <button 
                                                    onClick={() => fileInputRef.current.click()}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', color: '#475569' }}
                                                >
                                                    <Upload size={18} /> Upload Photo
                                                </button>
                                                <button 
                                                    onClick={startCamera}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', background: 'rgba(16,185,129,0.08)', border: 'none', borderRadius: 8, fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', color: '#10b981' }}
                                                >
                                                    <Camera size={18} /> Take Snapshot
                                                </button>
                                                <button 
                                                    onClick={() => setFormData(p => ({ ...p, photo_url: '' }))}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', background: 'none', border: 'none', borderRadius: 8, fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', color: '#ef4444' }}
                                                >
                                                    <X size={18} /> Remove Photo
                                                </button>
                                            </div>
                                        </div>

                                        {isCameraOpen && (
                                            <div style={{
                                                position: 'fixed',
                                                inset: 0,
                                                background: 'rgba(0,0,0,0.85)',
                                                backdropFilter: 'blur(8px)',
                                                zIndex: 3000,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                padding: '2rem'
                                            }}>
                                                <div style={{
                                                    background: 'white',
                                                    borderRadius: 32,
                                                    width: '100%',
                                                    maxWidth: 500,
                                                    padding: '2rem',
                                                    textAlign: 'center',
                                                    position: 'relative',
                                                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
                                                }}>
                                                    <button 
                                                        onClick={stopCamera}
                                                        style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: '#f1f5f9', border: 'none', padding: '0.75rem', borderRadius: '50%', cursor: 'pointer', color: '#64748b' }}
                                                    >
                                                        <X size={20} />
                                                    </button>
                                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>Capture Profile Photo</h3>
                                                    <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1.5rem' }}>Position your face in the center for a clear snapshot</p>
                                                    
                                                    <div style={{ 
                                                        width: '100%', 
                                                        aspectRatio: '3/4', 
                                                        background: '#000', 
                                                        borderRadius: 24, 
                                                        overflow: 'hidden',
                                                        marginBottom: '2rem',
                                                        position: 'relative'
                                                    }}>
                                                        <video 
                                                            ref={videoRef} 
                                                            autoPlay 
                                                            playsInline 
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} 
                                                        />
                                                        {/* Face Overlay */}
                                                        <div style={{ position: 'absolute', inset: '15%', border: '2px dashed rgba(255,255,255,0.5)', borderRadius: '50%' }} />
                                                    </div>

                                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                                        <button 
                                                            onClick={stopCamera}
                                                            style={{ flex: 1, padding: '1rem', borderRadius: 12, background: '#f1f5f9', color: '#64748b', fontWeight: 600, border: 'none', cursor: 'pointer' }}
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button 
                                                            onClick={capturePhoto}
                                                            style={{ 
                                                                flex: 2, 
                                                                padding: '1rem', 
                                                                borderRadius: 12, 
                                                                background: '#10b981', 
                                                                color: 'white', 
                                                                fontWeight: 700, 
                                                                border: 'none', 
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                gap: '0.5rem',
                                                                boxShadow: '0 10px 15px -3px rgba(16,185,129,0.3)'
                                                            }}
                                                        >
                                                            <Camera size={20} /> Capture Snapshot
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Hidden Canvas for Capturing */}
                                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>First Name</label>
                                            <input 
                                                name="first_name"
                                                value={formData.first_name}
                                                onChange={handleChange}
                                                placeholder="Ex: Sachin"
                                                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.95rem' }}
                                            />
                                            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.4rem' }}>Ex: Sachin</p>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Surname/Last Name</label>
                                            <input 
                                                name="last_name"
                                                value={formData.last_name}
                                                onChange={handleChange}
                                                placeholder="Ex: Tendulkar"
                                                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.95rem' }}
                                            />
                                            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.4rem' }}>Ex: Tendulkar</p>
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Name on your IRC Certificate</label>
                                        <input 
                                            name="certificate_name"
                                            value={formData.certificate_name}
                                            onChange={handleChange}
                                            placeholder="Full name as it should appear"
                                            style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.95rem' }}
                                        />
                                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.4rem' }}>How would you like your name to appear on certificates?</p>
                                    </div>

                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Gender</label>
                                        <div style={{ display: 'flex', gap: '2rem' }}>
                                            {['Male', 'Female', 'Transgender'].map(g => (
                                                <label key={g} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.95rem', color: '#64748b' }}>
                                                    <input 
                                                        type="radio" 
                                                        name="gender" 
                                                        value={g} 
                                                        checked={formData.gender === g}
                                                        onChange={handleChange}
                                                        style={{ width: 18, height: 18, accentColor: '#10b981' }}
                                                    />
                                                    {g}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </section>
                            )}

                            {activeSubSection === 'contact' && (
                                <section>
                                    <div style={{ marginBottom: '2rem' }}>
                                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>Student Contact Details</h2>
                                        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>We will use the contact details you provide to send you the important updates during the program</p>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Phone Number</label>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <div style={{ padding: '0.8rem 1rem', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: '0.95rem' }}>IN +91</div>
                                                <input 
                                                    name="phone"
                                                    value={formData.phone || ''}
                                                    onChange={handleChange}
                                                    placeholder="Enter phone number"
                                                    style={{ flex: 1, padding: '0.8rem 1rem', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.95rem' }}
                                                />
                                            </div>
                                            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.4rem' }}>Primary contact number</p>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>WhatsApp Number</label>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <div style={{ padding: '0.8rem 1rem', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: '0.95rem' }}>IN +91</div>
                                                <input 
                                                    name="whatsapp_number"
                                                    value={formData.whatsapp_number || ''}
                                                    onChange={handleChange}
                                                    placeholder="Enter WhatsApp number"
                                                    style={{ flex: 1, padding: '0.8rem 1rem', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.95rem' }}
                                                />
                                            </div>
                                            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.4rem' }}>For important updates on WhatsApp</p>
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: '2rem' }}>
                                        <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Email ID</label>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <input 
                                                value={user?.email || ''}
                                                disabled
                                                style={{ flex: 1, padding: '0.8rem 1rem', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: '0.95rem' }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontSize: '0.8rem', marginTop: '0.5rem', fontWeight: 600 }}>
                                            <CheckCircle2 size={14} /> Your Email address is verified
                                        </div>
                                    </div>

                                    <div style={{ background: '#f8fafc', borderRadius: 12, padding: '1.25rem', border: '1px solid #e2e8f0' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}>
                                            <input type="checkbox" checked style={{ width: 20, height: 20, accentColor: '#10b981' }} />
                                            <div>
                                                <p style={{ fontWeight: 600, color: '#334155', fontSize: '0.95rem' }}>I would like to receive updates in WhatsApp.</p>
                                            </div>
                                        </label>
                                    </div>
                                </section>
                            )}

                            {activeSubSection === 'parent' && (
                                <section>
                                    <div style={{ marginBottom: '2rem' }}>
                                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>Parent/Guardian Details</h2>
                                        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Person/Guardian is the one who supports the student during their journey. Student's progress will be shared regularly with Parent/Guardian.</p>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>First Name</label>
                                            <input 
                                                name="parent_first_name"
                                                value={formData.parent_first_name}
                                                onChange={handleChange}
                                                placeholder="Ex: Ramesh"
                                                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.95rem' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Surname/Last Name</label>
                                            <input 
                                                name="parent_last_name"
                                                value={formData.parent_last_name}
                                                onChange={handleChange}
                                                placeholder="Ex: Tendulkar"
                                                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.95rem' }}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Relation with the student</label>
                                            <select 
                                                name="parent_relation" 
                                                value={formData.parent_relation} 
                                                onChange={handleChange}
                                                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 10, border: '1px solid #e2e8f0', background: 'white', fontSize: '0.95rem' }}
                                            >
                                                <option>Mother</option>
                                                <option>Father</option>
                                                <option>Guardian</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Occupation</label>
                                            <select 
                                                name="parent_occupation" 
                                                value={formData.parent_occupation} 
                                                onChange={handleChange}
                                                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 10, border: '1px solid #e2e8f0', background: 'white', fontSize: '0.95rem' }}
                                            >
                                                <option>Farmer</option>
                                                <option>Employee</option>
                                                <option>Business</option>
                                                <option>Others</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Parent/Guardian Email ID</label>
                                        <input 
                                            name="parent_email"
                                            value={formData.parent_email}
                                            onChange={handleChange}
                                            placeholder="Enter email address"
                                            style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.95rem' }}
                                        />
                                    </div>
                                </section>
                            )}

                            {activeSubSection === 'address' && (
                                <section>
                                    <div style={{ marginBottom: '2.5rem' }}>
                                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>Current Address</h2>
                                        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Please provide your complete address to send rewards, resources, certificates, etc.</p>
                                    </div>

                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Address Line 1</label>
                                        <input 
                                            name="address_line1"
                                            value={formData.address_line1}
                                            onChange={handleChange}
                                            placeholder="House No, Street name, etc"
                                            style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.95rem' }}
                                        />
                                    </div>

                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Address Line 2</label>
                                        <input 
                                            name="address_line2"
                                            value={formData.address_line2}
                                            onChange={handleChange}
                                            placeholder="Locality, Area, etc"
                                            style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.95rem' }}
                                        />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Country</label>
                                            <select 
                                                name="country" 
                                                value={formData.country} 
                                                onChange={handleChange}
                                                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 10, border: '1px solid #e2e8f0', background: 'white', fontSize: '0.95rem' }}
                                            >
                                                <option>India</option>
                                                <option>Others</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Postal/Pin Code</label>
                                            <input 
                                                name="pincode"
                                                value={formData.pincode}
                                                onChange={handleChange}
                                                placeholder="6-digit PIN code"
                                                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.95rem' }}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>State</label>
                                            <select 
                                                name="state" 
                                                value={formData.state} 
                                                onChange={handleChange}
                                                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 10, border: '1px solid #e2e8f0', background: 'white', fontSize: '0.95rem' }}
                                            >
                                                <option>Tamil Nadu</option>
                                                <option>Karnataka</option>
                                                <option>Kerala</option>
                                                <option>Andhra Pradesh</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>District</label>
                                            <select 
                                                name="district" 
                                                value={formData.district} 
                                                onChange={handleChange}
                                                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 10, border: '1px solid #e2e8f0', background: 'white', fontSize: '0.95rem' }}
                                            >
                                                <option>Krishnagiri</option>
                                                <option>Dharmapuri</option>
                                                <option>Salem</option>
                                            </select>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {activeSubSection === 'expertise' && (
                                <section>
                                    <div style={{ marginBottom: '2rem' }}>
                                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>Current Expertise</h2>
                                        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Please provide the following details to mentor you better</p>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Current Coding Level</label>
                                            <select 
                                                name="coding_level" 
                                                value={formData.coding_level} 
                                                onChange={handleChange}
                                                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 10, border: '1px solid #e2e8f0', background: 'white', fontSize: '0.95rem' }}
                                            >
                                                <option>I don't have knowledge in coding</option>
                                                <option>Beginner</option>
                                                <option>Intermediate</option>
                                                <option>Advanced</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '1.25rem' }}>Do you have a Laptop/Computer?</label>
                                            <div style={{ display: 'flex', gap: '2rem' }}>
                                                {['Yes', 'No'].map(v => (
                                                    <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                                                        <input 
                                                            type="radio" 
                                                            name="has_laptop" 
                                                            checked={formData.has_laptop === (v === 'Yes')}
                                                            onChange={() => setFormData(p => ({ ...p, has_laptop: v === 'Yes' }))}
                                                            style={{ width: 18, height: 18, accentColor: '#10b981' }}
                                                        />
                                                        <span style={{ fontSize: '0.95rem', color: '#64748b' }}>{v}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Technical Skills (if any)</label>
                                        <div style={{ position: 'relative' }}>
                                            <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                                                <Search size={18} />
                                            </div>
                                            <input 
                                                placeholder="Add skills/frameworks you know"
                                                style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 3rem', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.95rem' }}
                                            />
                                        </div>
                                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem' }}>Mention NA if you don't have any skills</p>
                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.75rem', background: 'rgba(99,102,241,0.1)', color: '#6366f1', borderRadius: 6, fontSize: '0.85rem', fontWeight: 600 }}>
                                                NA <X size={14} style={{ cursor: 'pointer' }} />
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {activeSubSection === 'preference' && (
                                <section>
                                    <div style={{ marginBottom: '2rem' }}>
                                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>Your Preference</h2>
                                        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Tailor your learning experience</p>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Preferred Language for teaching</label>
                                            <select 
                                                name="language_teaching" 
                                                value={formData.language_teaching} 
                                                onChange={handleChange}
                                                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 10, border: '1px solid #e2e8f0', background: 'white', fontSize: '0.95rem' }}
                                            >
                                                <option>Tamil</option>
                                                <option>English</option>
                                                <option>Hindi</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Preferred Language for watching video lectures</label>
                                            <select 
                                                name="language_watching" 
                                                value={formData.language_watching} 
                                                onChange={handleChange}
                                                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: 10, border: '1px solid #e2e8f0', background: 'white', fontSize: '0.95rem' }}
                                            >
                                                <option>Tamil</option>
                                                <option>English</option>
                                            </select>
                                        </div>
                                    </div>
                                </section>
                            )}
                        </>
                    )}

                    {activeSection === 'education' && (
                        <section>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>Education Details</h2>
                                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Add your educational background</p>
                                </div>
                                <button 
                                    onClick={() => setFormData(p => ({ 
                                        ...p, 
                                        education_details: [...p.education_details, { school: '', degree: '', year: '', city: '' }] 
                                    }))}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', borderRadius: 8, background: 'rgba(16,185,129,0.1)', color: '#10b981', border: 'none', fontWeight: 600, cursor: 'pointer' }}
                                >
                                    <Plus size={18} /> Add Education
                                </button>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {formData.education_details.length === 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', justifyContent: 'center', padding: '4rem 0' }}>
                                        <GraduationCap size={64} color="#e2e8f0" />
                                        <p style={{ color: '#94a3b8', fontSize: '1rem' }}>No education details added yet</p>
                                    </div>
                                ) : (
                                    formData.education_details.map((edu, idx) => (
                                        <div key={idx} style={{ padding: '1.5rem', border: '1px solid #e2e8f0', borderRadius: 16, position: 'relative' }}>
                                            <button 
                                                onClick={() => setFormData(p => ({ ...p, education_details: p.education_details.filter((_, i) => i !== idx) }))}
                                                style={{ position: 'absolute', top: '1rem', right: '1rem', border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                                <div>
                                                    <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '0.5rem', fontSize: '0.85rem' }}>School/College</label>
                                                    <input 
                                                        value={edu.school}
                                                        onChange={(e) => {
                                                            const newEdu = [...formData.education_details];
                                                            newEdu[idx].school = e.target.value;
                                                            setFormData(p => ({ ...p, education_details: newEdu }));
                                                        }}
                                                        style={{ width: '100%', padding: '0.75rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Degree/Course</label>
                                                    <input 
                                                        value={edu.degree}
                                                        onChange={(e) => {
                                                            const newEdu = [...formData.education_details];
                                                            newEdu[idx].degree = e.target.value;
                                                            setFormData(p => ({ ...p, education_details: newEdu }));
                                                        }}
                                                        style={{ width: '100%', padding: '0.75rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    )}

                    {activeSection === 'work' && (
                        <section>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>Work Experience</h2>
                                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Add your professional experience</p>
                                </div>
                                <button 
                                    onClick={() => setFormData(p => ({ 
                                        ...p, 
                                        work_experience: [...p.work_experience, { company: '', role: '', duration: '' }] 
                                    }))}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', borderRadius: 8, background: 'rgba(16,185,129,0.1)', color: '#10b981', border: 'none', fontWeight: 600, cursor: 'pointer' }}
                                >
                                    <Plus size={18} /> Add Experience
                                </button>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {formData.work_experience.length === 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', justifyContent: 'center', padding: '4rem 0' }}>
                                        <Briefcase size={64} color="#e2e8f0" />
                                        <p style={{ color: '#94a3b8', fontSize: '1rem' }}>No work experience added yet</p>
                                    </div>
                                ) : (
                                    formData.work_experience.map((work, idx) => (
                                        <div key={idx} style={{ padding: '1.5rem', border: '1px solid #e2e8f0', borderRadius: 16, position: 'relative' }}>
                                            <button 
                                                onClick={() => setFormData(p => ({ ...p, work_experience: p.work_experience.filter((_, i) => i !== idx) }))}
                                                style={{ position: 'absolute', top: '1rem', right: '1rem', border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                                <div>
                                                    <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Company</label>
                                                    <input 
                                                        value={work.company}
                                                        onChange={(e) => {
                                                            const newWork = [...formData.work_experience];
                                                            newWork[idx].company = e.target.value;
                                                            setFormData(p => ({ ...p, work_experience: newWork }));
                                                        }}
                                                        style={{ width: '100%', padding: '0.75rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Role</label>
                                                    <input 
                                                        value={work.role}
                                                        onChange={(e) => {
                                                            const newWork = [...formData.work_experience];
                                                            newWork[idx].role = e.target.value;
                                                            setFormData(p => ({ ...p, work_experience: newWork }));
                                                        }}
                                                        style={{ width: '100%', padding: '0.75rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    )}

                    {activeSection === 'projects' && (
                        <section>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>Projects & Achievements</h2>
                                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Highlight your best work and accomplishments</p>
                                </div>
                                <button 
                                    onClick={() => setFormData(p => ({ 
                                        ...p, 
                                        projects_achievements: [...p.projects_achievements, { title: '', description: '', link: '' }] 
                                    }))}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', borderRadius: 8, background: 'rgba(16,185,129,0.1)', color: '#10b981', border: 'none', fontWeight: 600, cursor: 'pointer' }}
                                >
                                    <Plus size={18} /> Add Project
                                </button>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {formData.projects_achievements.length === 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', justifyContent: 'center', padding: '4rem 0' }}>
                                        <Trophy size={64} color="#e2e8f0" />
                                        <p style={{ color: '#94a3b8', fontSize: '1rem' }}>No projects or achievements added yet</p>
                                    </div>
                                ) : (
                                    formData.projects_achievements.map((proj, idx) => (
                                        <div key={idx} style={{ padding: '1.5rem', border: '1px solid #e2e8f0', borderRadius: 16, position: 'relative' }}>
                                            <button 
                                                onClick={() => setFormData(p => ({ ...p, projects_achievements: p.projects_achievements.filter((_, i) => i !== idx) }))}
                                                style={{ position: 'absolute', top: '1rem', right: '1rem', border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                <div>
                                                    <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Project Title</label>
                                                    <input 
                                                        value={proj.title}
                                                        onChange={(e) => {
                                                            const newProj = [...formData.projects_achievements];
                                                            newProj[idx].title = e.target.value;
                                                            setFormData(p => ({ ...p, projects_achievements: newProj }));
                                                        }}
                                                        style={{ width: '100%', padding: '0.75rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', fontWeight: 600, color: '#475569', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Link/URL</label>
                                                    <input 
                                                        value={proj.link}
                                                        onChange={(e) => {
                                                            const newProj = [...formData.projects_achievements];
                                                            newProj[idx].link = e.target.value;
                                                            setFormData(p => ({ ...p, projects_achievements: newProj }));
                                                        }}
                                                        style={{ width: '100%', padding: '0.75rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    )}
                </div>
            </div>

            {/* Bottom Floating Save Bar */}
            <div style={{ 
                position: 'fixed', 
                bottom: '2rem', 
                left: '50%', 
                transform: 'translateX(-50%)', 
                background: 'rgba(255,255,255,0.8)', 
                backdropFilter: 'blur(10px)',
                padding: '0.75rem 2rem',
                borderRadius: 99,
                boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                border: '1px solid rgba(255,255,255,1)',
                display: 'flex',
                alignItems: 'center',
                gap: '2rem',
                zIndex: 1000
            }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#e2e8f0' }} />
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#e2e8f0' }} />
                </div>
                <button 
                    onClick={handleSave}
                    disabled={saving}
                    style={{ 
                        background: '#10b981', 
                        color: 'white', 
                        border: 'none', 
                        padding: '0.6rem 2rem', 
                        borderRadius: 99, 
                        fontWeight: 700, 
                        fontSize: '0.95rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        transition: 'all 0.2s'
                    }}
                >
                    {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    {saving ? 'Saving...' : 'Save Profile'}
                </button>
            </div>
        </div>
    )
}
