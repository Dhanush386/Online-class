import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Users, Search, ChevronDown, ChevronUp, Clock, BookOpen, TrendingUp, Plus, X, AlertCircle, Save, CheckCircle2, XCircle, Mail, Trash2, Calendar } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const toLocalISO = (date) => {
    if (!date) return ''
    const d = new Date(date)
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

const ExpiryControl = ({ studentId, currentExpiry, onUpdate, saving }) => {
    const [val, setVal] = useState(toLocalISO(currentExpiry))

    // Update local value if external value changes (e.g. after save)
    useEffect(() => {
        setVal(toLocalISO(currentExpiry))
    }, [currentExpiry])

    const hasChanged = val !== toLocalISO(currentExpiry)

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#9a3412' }}>Expires on:</span>
            <input
                type="datetime-local"
                className="form-input"
                style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', width: 'auto', background: 'white' }}
                value={val}
                onChange={(e) => setVal(e.target.value)}
                disabled={saving}
            />
            {hasChanged && (
                <button
                    onClick={() => onUpdate(studentId, val)}
                    disabled={saving}
                    className="btn-primary"
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem', background: '#f97316', border: 'none' }}
                >
                    {saving ? '...' : <Save size={12} />}
                </button>
            )}
            {currentExpiry && (
                <button
                    onClick={() => onUpdate(studentId, null)}
                    disabled={saving}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                >
                    Clear
                </button>
            )}
        </div>
    )
}

export default function StudentManagement() {
    const { profile } = useAuth()
    const [students, setStudents] = useState([])
    const [courses, setCourses] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [expanded, setExpanded] = useState(null)
    const [assigningTo, setAssigningTo] = useState(null)
    const [selectedCourse, setSelectedCourse] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [tab, setTab] = useState('active')
    const [invites, setInvites] = useState([])
    const [organizers, setOrganizers] = useState([])
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteRole, setInviteRole] = useState('organizer')
    const [groups, setGroups] = useState([])
    const [groupMembers, setGroupMembers] = useState([])
    const [newGroupName, setNewGroupName] = useState('')
    const [groupCourseId, setGroupCourseId] = useState('')
    const [managingGroup, setManagingGroup] = useState(null)
    const [togglingMember, setTogglingMember] = useState(null) // studentId
    const [schedulingGroup, setSchedulingGroup] = useState(null)
    const [dayAccess, setDayAccess] = useState([])
    const [maxDay, setMaxDay] = useState(1)

    useEffect(() => {
        if (profile?.id) loadData()
    }, [profile])

    async function loadData(silent = false) {
        if (!silent) setLoading(true)
        try {
            // Fetch all users with role 'student'
            const { data: allStudents } = await supabase
                .from('users')
                .select('id, name, email, role, status, current_session_id, access_expires_at')
                .eq('role', 'student')

            // Fetch all enrollments
            const { data: enrollments } = await supabase
                .from('enrollments')
                .select('*, courses(title)')

            // Fetch all progress records
            const { data: allProgress } = await supabase
                .from('progress')
                .select('*')

            // Fetch all submissions for assessments and coding
            const [
                { data: allAssessSubmissions },
                { data: allCodingSubmissions }
            ] = await Promise.all([
                supabase.from('assessment_submissions').select('student_id, score, total_questions'),
                supabase.from('coding_submissions').select('student_id, score')
            ])

            // Fetch all courses owned by this organizer
            const { data: allCourses } = await supabase
                .from('courses')
                .select('id, title, organizer_id')
                .eq('organizer_id', profile.id)

            setCourses(allCourses || [])

            // Group enrollments & progress by student ID
            const enrollmentMap = {}
                ; (enrollments || []).forEach(e => {
                    if (!enrollmentMap[e.student_id]) enrollmentMap[e.student_id] = []

                    // Find matching progress
                    const prog = (allProgress || []).find(p => p.student_id === e.student_id && p.course_id === e.course_id)

                    enrollmentMap[e.student_id].push({
                        id: e.course_id,
                        course: e.courses?.title,
                        completion: prog?.completion_percentage || 0,
                        time: prog?.time_spent_minutes || 0,
                    })
                })

            // Combine students with their data
            const studentsWithData = (allStudents || []).map(s => {
                const studentAssessments = (allAssessSubmissions || []).filter(a => a.student_id === s.id)
                const totalPossible = studentAssessments.reduce((sum, a) => sum + (a.total_questions || 0), 0)
                const totalScored = studentAssessments.reduce((sum, a) => sum + (a.score || 0), 0)
                const assessAvg = totalPossible > 0 ? Math.round((totalScored / totalPossible) * 100) : 0

                const studentCoding = (allCodingSubmissions || []).filter(c => c.student_id === s.id)
                const codingTotal = studentCoding.reduce((sum, c) => sum + (c.score || 0), 0)

                return {
                    ...s,
                    enrollments: enrollmentMap[s.id] || [],
                    assessAvg,
                    codingTotal
                }
            })

            setStudents(studentsWithData)

            // Fetch other organizers
            const { data: allOrganizers } = await supabase
                .from('users')
                .select('*')
                .eq('role', 'organizer')
            setOrganizers(allOrganizers || [])

            // Fetch invites
            const { data: allInvites } = await supabase
                .from('organizer_invites')
                .select('*')
            setInvites(allInvites || [])

            // Fetch Groups
            const { data: allGroups } = await supabase
                .from('groups')
                .select('*, courses!groups_course_id_fkey(title)')
                .eq('organizer_id', profile.id)
            setGroups(allGroups || [])

            // Fetch Group Memberships
            const { data: allMembers } = await supabase
                .from('group_members')
                .select('*')
            setGroupMembers(allMembers || [])

        } catch (err) {
            console.error('Error loading student management data:', err)
        } finally {
            setLoading(false)
        }
    }

    async function handleAssignCourse(e) {
        e.preventDefault()
        if (!selectedCourse || !assigningTo) return

        setSaving(true)
        setError('')

        try {
            // 1. Create enrollment
            const { error: enrollError } = await supabase
                .from('enrollments')
                .insert({
                    student_id: assigningTo.id,
                    course_id: selectedCourse
                })

            if (enrollError) {
                if (enrollError.code === '23505') throw new Error('Student is already enrolled in this course')
                throw enrollError
            }

            // 2. Create initial progress record
            const { error: progressError } = await supabase.from('progress').insert({
                student_id: assigningTo.id,
                course_id: selectedCourse,
                completion_percentage: 0,
                time_spent_minutes: 0
            })

            if (progressError) console.error('Error creating progress:', progressError)

            setAssigningTo(null)
            setSelectedCourse('')
            loadData(true)
        } catch (err) {
            setError(err.message || 'Failed to assign course')
        } finally {
            setSaving(false)
        }
    }

    async function handleRemoveCourse(studentId, courseId) {
        if (!confirm('Are you sure you want to remove this course assignment? This will also clear the student\'s progress for this course.')) return

        setSaving(true)
        try {
            // 1. Delete enrollment
            const { error: enrollError } = await supabase
                .from('enrollments')
                .delete()
                .eq('student_id', studentId)
                .eq('course_id', courseId)

            if (enrollError) throw enrollError

            // 2. Delete progress
            const { error: progressError } = await supabase
                .from('progress')
                .delete()
                .eq('student_id', studentId)
                .eq('course_id', courseId)

            if (progressError) console.error('Error deleting progress:', progressError)

            loadData(true)
        } catch (err) {
            console.error('Error removing course:', err)
            setError(err.message || 'Failed to remove course')
        } finally {
            setSaving(false)
        }
    }

    async function handleUpdateStatus(studentId, newStatus) {
        setSaving(true)
        try {
            const { error } = await supabase
                .from('users')
                .update({ status: newStatus })
                .eq('id', studentId)

            if (error) throw error
            loadData(true)
        } catch (err) {
            console.error('Error updating status:', err)
            setError(err.message || 'Failed to update student status')
        } finally {
            setSaving(false)
        }
    }

    async function handleDeleteStudent(id) {
        if (!confirm('Are you sure you want to PERMANENTLY remove this student? This will delete their account and all their data (enrollments, progress, etc.). This cannot be undone.')) return
        setSaving(true)
        try {
            const { error } = await supabase.rpc('delete_user_permanently', { target_user_id: id })
            if (error) throw error
            loadData(true)
        } catch (err) {
            console.error('Error deleting student:', err)
            setError(err.message || 'Failed to delete student')
        } finally {
            setSaving(false)
        }
    }

    async function handleUpdateExpiry(studentId, expiryDate) {
        setSaving(true)
        try {
            const { error } = await supabase
                .from('users')
                .update({ access_expires_at: expiryDate ? new Date(expiryDate).toISOString() : null })
                .eq('id', studentId)
            if (error) throw error
            loadData(true)
        } catch (err) {
            console.error('Error updating expiry:', err)
            setError(err.message || 'Failed to update access expiry')
        } finally {
            setSaving(false)
        }
    }

    async function handleInviteOrganizer(e) {
        e.preventDefault()
        if (!inviteEmail) return
        setSaving(true)
        setError('')
        try {
            const { error: inviteError } = await supabase
                .from('organizer_invites')
                .insert({ 
                    email: inviteEmail.toLowerCase(), 
                    invited_by: profile.id,
                    role: inviteRole
                })

            if (inviteError) {
                if (inviteError.code === '23505') throw new Error('This email is already invited')
                throw inviteError
            }

            setInviteEmail('')
            loadData()
        } catch (err) {
            setError(err.message || 'Failed to send invite')
        } finally {
            setSaving(false)
        }
    }

    async function handleRemoveInvite(email) {
        try {
            const { error } = await supabase
                .from('organizer_invites')
                .delete()
                .eq('email', email)
            if (error) throw error
            loadData()
        } catch (err) {
            console.error('Error removing invite:', err)
        }
    }

    async function handleSyncStudents() {
        setSaving(true)
        setError('')
        try {
            const { data, error } = await supabase.rpc('sync_profiles_from_auth')
            if (error) throw error
            
            const count = data?.synced_count || 0
            alert(`Sync complete! ${count} missing profile entries were repaired.`)
            loadData(true)
        } catch (err) {
            console.error('Error syncing students:', err)
            setError(err.message || 'Failed to sync students from auth')
        } finally {
            setSaving(false)
        }
    }

    const filtered = students.filter(s => {
        const matchesSearch = s.name?.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase())
        if (tab === 'active') return matchesSearch && s.status === 'approved'
        if (tab === 'pending') return matchesSearch && s.status === 'pending'
        return false // Tab 'groups' handled separately
    })

    async function handleCreateGroup(e) {
        e.preventDefault()
        if (!newGroupName || !groupCourseId) return
        setSaving(true)
        try {
            const { error } = await supabase.from('groups').insert({
                name: newGroupName,
                course_id: groupCourseId,
                organizer_id: profile.id
            })
            if (error) {
                if (error.code === '23505') throw new Error(`A group named "${newGroupName}" already exists for this course.`);
                throw error
            }
            setNewGroupName('')
            loadData(true)
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    async function handleDeleteGroup(groupId) {
        if (!confirm('Delete this group? Students will be removed from it but will keep their course access.')) return
        try {
            await supabase.from('groups').delete().eq('id', groupId)
            loadData(true)
        } catch (err) { console.error(err) }
    }

    async function loadDayAccess(group) {
        setSchedulingGroup(group)
        setLoading(true)
        try {
            // 1. Get max day for the course
            const [
                { data: vids },
                { data: cods },
                { data: asss },
                { data: ress }
            ] = await Promise.all([
                supabase.from('videos').select('day_number').eq('course_id', group.course_id),
                supabase.from('coding_challenges').select('day_number').eq('course_id', group.course_id),
                supabase.from('assessments').select('day_number').eq('course_id', group.course_id),
                supabase.from('course_resources').select('day_number').eq('course_id', group.course_id)
            ])

            const allDays = [
                ...(vids || []).map(v => v.day_number),
                ...(cods || []).map(c => c.day_number),
                ...(asss || []).map(a => a.day_number),
                ...(ress || []).map(r => r.day_number)
            ]
            const max = Math.max(1, ...allDays.filter(d => d !== null))
            setMaxDay(max)

            // 2. Fetch existing day_access
            const { data } = await supabase
                .from('day_access')
                .select('*')
                .eq('group_id', group.id)
            setDayAccess(data || [])
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    async function handleUpdateDayAccess(day, field, value) {
        const existing = dayAccess.find(a => a.day_number === day)
        const payload = {
            course_id: schedulingGroup.course_id,
            group_id: schedulingGroup.id,
            day_number: day,
            [field]: value
        }

        try {
            const { error } = await supabase
                .from('day_access')
                .upsert(payload, { onConflict: 'course_id,day_number,group_id' })

            if (error) throw error

            // Update local state
            setDayAccess(prev => {
                const idx = prev.findIndex(a => a.day_number === day)
                if (idx > -1) {
                    const next = [...prev]
                    next[idx] = { ...next[idx], ...payload }
                    return next
                }
                return [...prev, payload]
            })
        } catch (err) {
            console.error(err)
            setError(err.message)
        }
    }

    async function toggleMembership(groupId, studentId) {
        if (togglingMember) return
        setTogglingMember(studentId)
        const isMember = groupMembers.some(m => m.group_id === groupId && m.student_id === studentId)
        try {
            if (isMember) {
                const { error } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('student_id', studentId)
                if (error) throw error
            } else {
                // Use upsert to prevent 409 Conflict (though composite primary key should be handled)
                const { error } = await supabase.from('group_members').upsert(
                    { group_id: groupId, student_id: studentId },
                    { onConflict: 'group_id,student_id' }
                )
                if (error) throw error
            }
            await loadData(true)
        } catch (err) {
            console.error(err)
            setError(err.message || 'Failed to update membership')
        } finally {
            setTogglingMember(null)
        }
    }

    function avgCompletion(enrollments) {
        if (!enrollments?.length) return 0
        return Math.round(enrollments.reduce((sum, e) => sum + e.completion, 0) / enrollments.length)
    }

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Student Management</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                        {students.length} registered student{students.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <div style={{ position: 'relative' }}>
                    <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        id="student-search"
                        name="student-search"
                        type="text"
                        placeholder="Search students by name or email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="form-input"
                        style={{ paddingLeft: '2.5rem' }}
                    />
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--card-border)' }}>
                <button
                    className={`nav-btn ${tab === 'active' ? 'active' : ''}`}
                    onClick={() => setTab('active')}
                    style={{ padding: '0.75rem 1rem', background: 'none', border: 'none', borderBottom: tab === 'active' ? '2px solid #6366f1' : '2px solid transparent', color: tab === 'active' ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}
                >
                    Active Students
                </button>
                <button
                    className={`nav-btn ${tab === 'pending' ? 'active' : ''}`}
                    onClick={() => setTab('pending')}
                    style={{ padding: '0.75rem 1rem', background: 'none', border: 'none', borderBottom: tab === 'pending' ? '2px solid #f59e0b' : '2px solid transparent', color: tab === 'pending' ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                >
                    Pending Approval
                    {students.filter(s => s.status === 'pending').length > 0 && (
                        <span style={{ background: '#f59e0b', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '1rem', fontSize: '0.7rem' }}>
                            {students.filter(s => s.status === 'pending').length}
                        </span>
                    )}
                </button>

                {tab === 'pending' && (
                    <button
                        onClick={handleSyncStudents}
                        disabled={saving}
                        className="btn-secondary"
                        style={{ marginLeft: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.75rem', gap: '0.4rem', color: '#6366f1', borderColor: 'rgba(99,102,241,0.2)' }}
                        title="Search for missing student profiles in the authentication system"
                    >
                        <Users size={14} /> {saving ? 'Syncing...' : 'Sync Students'}
                    </button>
                )}
                <button
                    className={`nav-btn ${tab === 'team' ? 'active' : ''}`}
                    onClick={() => setTab('team')}
                    style={{ padding: '0.75rem 1rem', background: 'none', border: 'none', borderBottom: tab === 'team' ? '2px solid #8b5cf6' : '2px solid transparent', color: tab === 'team' ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}
                >
                    Organizer Team
                </button>
                <button
                    className={`nav-btn ${tab === 'groups' ? 'active' : ''}`}
                    onClick={() => setTab('groups')}
                    style={{ padding: '0.75rem 1rem', background: 'none', border: 'none', borderBottom: tab === 'groups' ? '2px solid #10b981' : '2px solid transparent', color: tab === 'groups' ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                >
                    Batches & Groups
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '4rem' }}>
                    <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
                    <p style={{ color: 'var(--text-muted)' }}>Loading data...</p>
                </div>
            ) : tab === 'team' ? (
                <div className="animate-fade-in">
                    <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>Invite New Organizer</h3>
                        <form onSubmit={handleInviteOrganizer} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.75rem' }}>
                            <div style={{ position: 'relative' }}>
                                <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    id="invite-email"
                                    name="invite-email"
                                    type="email"
                                    className="form-input"
                                    placeholder="organizer@example.com"
                                    value={inviteEmail}
                                    onChange={e => setInviteEmail(e.target.value)}
                                    style={{ paddingLeft: '2.5rem' }}
                                    required
                                />
                            </div>
                            <select 
                                id="invite-role"
                                name="invite-role"
                                className="form-input"
                                value={inviteRole}
                                onChange={e => setInviteRole(e.target.value)}
                                style={{ width: 'auto' }}
                            >
                                <option value="organizer">Organizer</option>
                                <option value="sub_admin">Sub Admin</option>
                                <option value="main_admin">Main Admin</option>
                            </select>
                            <button type="submit" className="btn-primary" disabled={saving} style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                                {saving ? 'Inviting...' : 'Invite'}
                            </button>
                        </form>
                        {error && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.5rem' }}>{error}</p>}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Users size={16} /> Current Organizers ({organizers.length})
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {organizers.map(org => (
                                    <div key={org.id} className="glass-card" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ width: 32, height: 32, background: 'var(--card-border)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700 }}>
                                            {org.name?.[0]?.toUpperCase()}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{org.name} {org.id === profile.id && '(You)'}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{org.email}</div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {profile?.role === 'main_admin' ? (
                                                <>
                                                    <select 
                                                        value={org.role} 
                                                        onChange={(e) => handleUpdateRole(org.id, e.target.value)}
                                                        className="form-input"
                                                        style={{ width: 'auto', fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                                                        disabled={org.id === profile.id}
                                                    >
                                                        <option value="organizer">Organizer</option>
                                                        <option value="sub_admin">Sub Admin</option>
                                                        <option value="main_admin">Main Admin</option>
                                                    </select>
                                                    {org.id !== profile.id && (
                                                        <button 
                                                            onClick={() => handleDeleteStudent(org.id)} 
                                                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: 0.7, padding: '0.2rem' }}
                                                            title="Permanently Delete User"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </>
                                            ) : (
                                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{org.role?.replace('_', ' ')}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Clock size={16} /> Pending Invites ({invites.length})
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {invites.length === 0 ? (
                                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                        No pending invitations
                                    </div>
                                ) : (
                                    invites.map(invite => (
                                        <div key={invite.email} className="glass-card" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{invite.email}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                    Invited {new Date(invite.created_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveInvite(invite.email)}
                                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: 0.7 }}
                                                title="Revoke Invite"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : tab === 'groups' ? (
                <div className="animate-fade-in">
                    <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>Create New Batch/Group</h3>
                        <form onSubmit={handleCreateGroup} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem' }}>
                            <input
                                id="new-group-name"
                                name="name"
                                className="form-input"
                                placeholder="Group Name (e.g. Batch A)"
                                value={newGroupName}
                                onChange={e => setNewGroupName(e.target.value)}
                                required
                            />
                            <select
                                id="group-course-select"
                                name="course_id"
                                className="form-input"
                                value={groupCourseId}
                                onChange={e => setGroupCourseId(e.target.value)}
                                required
                            >
                                <option value="">Select Course</option>
                                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                            </select>
                            <button type="submit" className="btn-primary" disabled={saving}>
                                {saving ? 'Creating...' : 'Create Group'}
                            </button>
                        </form>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
                        {groups.map(g => {
                            const membersCount = groupMembers.filter(m => m.group_id === g.id).length
                            return (
                                <div key={g.id} className="glass-card" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{g.name}</h3>
                                        <button onClick={() => handleDeleteGroup(g.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                        {g.courses?.title} • {membersCount} Students
                                    </p>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            onClick={() => setManagingGroup(g)}
                                            className="btn-secondary"
                                            style={{ flex: 1, fontSize: '0.8rem', padding: '0.5rem' }}
                                        >
                                            Members
                                        </button>
                                        <button
                                            onClick={() => loadDayAccess(g)}
                                            className="btn-secondary"
                                            style={{ flex: 1, fontSize: '0.8rem', padding: '0.5rem', color: '#6366f1', borderColor: 'rgba(99,102,241,0.2)' }}
                                        >
                                            <Calendar size={14} style={{ marginRight: '0.3rem' }} /> Day Schedule
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            ) : filtered.length === 0 ? (
                <div className="glass-card" style={{ padding: '4rem', textAlign: 'center' }}>
                    <Users size={48} style={{ margin: '0 auto 1rem', opacity: 0.3, display: 'block' }} />
                    <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>No students found</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {error && (
                        <div style={{ padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 8, fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <AlertCircle size={16} flexShrink={0} /> {error}
                        </div>
                    )}
                    {filtered.map(student => {
                        const avg = avgCompletion(student.enrollments)
                        const isOpen = expanded === student.id
                        return (
                            <div key={student.id} className="glass-card" style={{ overflow: 'hidden' }}>
                                <div
                                    className="stack-mobile"
                                    style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem 1.5rem', cursor: 'pointer' }}
                                    onClick={() => setExpanded(isOpen ? null : student.id)}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, width: '100%' }}>
                                        <div style={{ width: 44, height: 44, background: 'linear-gradient(135deg, #6366f1, #a855f7)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                                            {student.name?.[0]?.toUpperCase() || '?'}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {student.name}
                                                <div style={{ display: 'flex', gap: '0.3rem' }}>
                                                    {groupMembers.filter(m => m.student_id === student.id).map(m => {
                                                        const g = groups.find(gr => gr.id === m.group_id)
                                                        return g ? <span key={g.id} style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem', background: '#dcfce7', color: '#166534', borderRadius: 4, fontWeight: 700 }}>{g.name}</span> : null
                                                    })}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{student.email}</div>
                                        </div>
                                    </div>

                                    {tab === 'pending' ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
                                            <button
                                                className="btn-primary"
                                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', gap: '0.4rem', background: 'linear-gradient(135deg,#10b981,#059669)' }}
                                                onClick={(e) => { e.stopPropagation(); handleUpdateStatus(student.id, 'approved'); }}
                                            >
                                                <CheckCircle2 size={14} /> Approve
                                            </button>
                                            <button
                                                className="btn-secondary"
                                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', gap: '0.4rem', color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}
                                                onClick={(e) => { e.stopPropagation(); handleUpdateStatus(student.id, 'rejected'); }}
                                            >
                                                <XCircle size={14} /> Reject
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', width: window.innerWidth <= 768 ? '100%' : 'auto', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', gap: '1.5rem' }}>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{student.enrollments?.length || 0}</div>
                                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Courses</div>
                                                </div>
                                                <div style={{ textAlign: 'center', minWidth: 60 }}>
                                                    <div style={{ fontSize: '1rem', fontWeight: 700, color: avg > 70 ? '#10b981' : avg > 40 ? '#f59e0b' : '#f87171' }}>{avg}%</div>
                                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Progress</div>
                                                </div>
                                                <div style={{ textAlign: 'center', minWidth: 70 }}>
                                                    <div style={{ fontSize: '1rem', fontWeight: 700, color: student.assessAvg > 70 ? '#10b981' : student.assessAvg > 40 ? '#f59e0b' : '#f87171' }}>
                                                        {student.assessAvg}%
                                                    </div>
                                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Assignments</div>
                                                </div>
                                                <div style={{ textAlign: 'center', minWidth: 60 }}>
                                                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#6366f1' }}>
                                                        {student.codingTotal}
                                                    </div>
                                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Coding</div>
                                                </div>
                                            </div>
                                            <div style={{ width: 80 }} className="hide-mobile">
                                                <div className="progress-bar-track">
                                                    <div className="progress-bar-fill" style={{ width: `${avg}%`, background: avg > 70 ? 'linear-gradient(90deg,#10b981,#059669)' : avg > 40 ? 'linear-gradient(90deg,#f59e0b,#d97706)' : 'linear-gradient(90deg,#ef4444,#dc2626)' }} />
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <button
                                                    className="btn-secondary"
                                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', gap: '0.4rem' }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setAssigningTo(student);
                                                        setError('');
                                                    }}
                                                >
                                                    <Plus size={14} /> Assign
                                                </button>
                                                <button
                                                    className="btn-secondary"
                                                    style={{ padding: '0.4rem', color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteStudent(student.id);
                                                    }}
                                                    title="Remove Student"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                                {isOpen ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {isOpen && (
                                    <div style={{ padding: '0 1.5rem 1.5rem', borderTop: '1px solid var(--card-border)' }}>
                                        <div style={{ paddingTop: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                                            <div style={{ padding: '1rem', background: '#fff7ed', borderRadius: 10, border: '1px solid #fed7aa', gridColumn: '1 / -1', marginBottom: '0.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <Clock size={16} color="#f97316" />
                                                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#9a3412' }}>Access Control</span>
                                                    </div>
                                                    <ExpiryControl
                                                        studentId={student.id}
                                                        currentExpiry={student.access_expires_at}
                                                        onUpdate={handleUpdateExpiry}
                                                        saving={saving}
                                                    />
                                                </div>
                                                {student.access_expires_at && new Date(student.access_expires_at) < new Date() && (
                                                    <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#ef4444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                        <AlertCircle size={12} /> Access has expired
                                                    </p>
                                                )}
                                            </div>
                                            {student.enrollments?.length > 0 ? (
                                                student.enrollments.map((en, i) => (
                                                    <div key={i} style={{ padding: '1rem', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <BookOpen size={14} color="#818cf8" />
                                                                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{en.course}</span>
                                                            </div>
                                                            <button 
                                                                onClick={() => handleRemoveCourse(student.id, en.id)}
                                                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem', display: 'flex', alignItems: 'center' }}
                                                                title="Remove Course Assignment"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                                                            <span style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}><TrendingUp size={11} /> {en.completion}%</span>
                                                            <span style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}><Clock size={11} /> {en.time} min</span>
                                                        </div>
                                                        <div className="progress-bar-track">
                                                            <div className="progress-bar-fill" style={{ width: `${en.completion}%` }} />
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                                    This student is not yet enrolled in any of your courses.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {assigningTo && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}>
                    <div className="glass-card zoom-in" style={{ width: '100%', maxWidth: 400, padding: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Assign Course</h3>
                            <button onClick={() => setAssigningTo(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.5rem' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Student</div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{assigningTo.name}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{assigningTo.email}</div>
                        </div>
                        <form onSubmit={handleAssignCourse}>
                            <div className="form-group" style={{ marginBottom: '2rem' }}>
                                <label htmlFor="course-assign-select" className="form-label" style={{ marginBottom: '0.75rem' }}>Select Course</label>
                                <div style={{ position: 'relative' }}>
                                    <BookOpen size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <select
                                        id="course-assign-select"
                                        name="course_id"
                                        className="form-input"
                                        value={selectedCourse}
                                        onChange={(e) => setSelectedCourse(e.target.value)}
                                        required
                                        style={{ paddingLeft: '2.5rem', appearance: 'none' }}
                                    >
                                        <option value="">-- Choose a course --</option>
                                        {courses.map(c => (
                                            <option key={c.id} value={c.id}>{c.title}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={16} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                <button type="button" className="btn-secondary" onClick={() => setAssigningTo(null)} disabled={saving}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={saving || !selectedCourse}>
                                    {saving ? 'Assigning...' : 'Assign'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {managingGroup && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}>
                    <div className="glass-card zoom-in" style={{ width: '100%', maxWidth: 500, maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Manage Members: {managingGroup.name}</h3>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Only showing students enrolled in {managingGroup.courses?.title}</p>
                            </div>
                            <button onClick={() => setManagingGroup(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                            {students
                                .filter(s => s.enrollments.some(e => e.id === managingGroup.course_id))
                                .map(s => {
                                    const isMember = groupMembers.some(m => m.group_id === managingGroup.id && m.student_id === s.id)
                                    return (
                                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                                            <div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{s.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.email}</div>
                                            </div>
                                            <button
                                                onClick={() => toggleMembership(managingGroup.id, s.id)}
                                                disabled={togglingMember === s.id}
                                                className={isMember ? "btn-secondary" : "btn-primary"}
                                                style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', opacity: togglingMember === s.id ? 0.7 : 1 }}
                                            >
                                                {togglingMember === s.id ? '...' : (isMember ? 'Remove' : 'Add')}
                                            </button>
                                        </div>
                                    )
                                })
                            }
                        </div>
                    </div>
                </div>
            )}

            {schedulingGroup && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}>
                    <div className="glass-card zoom-in" style={{ width: '100%', maxWidth: 700, maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Day Schedule: {schedulingGroup.name}</h3>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Set timing and locking for each day in {schedulingGroup.courses?.title}</p>
                            </div>
                            <button onClick={() => setSchedulingGroup(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {Array.from({ length: maxDay }, (_, i) => i + 1).map(day => {
                                    const access = dayAccess.find(a => a.day_number === day) || { is_locked: false, open_time: '', close_time: '' }
                                    return (
                                        <div key={day} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 100px', gap: '1rem', alignItems: 'center', padding: '1rem', background: access.is_locked ? '#fff1f2' : '#f8fafc', borderRadius: 12, border: `1px solid ${access.is_locked ? '#fecaca' : '#e2e8f0'}` }}>
                                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Day {day}</div>
                                            <div>
                                                <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>OPEN TIME</label>
                                                <input
                                                    type="datetime-local"
                                                    className="form-input"
                                                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                                                    value={access.open_time ? toLocalISO(access.open_time) : ''}
                                                    onChange={e => handleUpdateDayAccess(day, 'open_time', e.target.value ? new Date(e.target.value).toISOString() : null)}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>CLOSE TIME</label>
                                                <input
                                                    type="datetime-local"
                                                    className="form-input"
                                                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                                                    value={access.close_time ? toLocalISO(access.close_time) : ''}
                                                    onChange={e => handleUpdateDayAccess(day, 'close_time', e.target.value ? new Date(e.target.value).toISOString() : null)}
                                                />
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <button
                                                    onClick={() => handleUpdateDayAccess(day, 'is_locked', !access.is_locked)}
                                                    className={access.is_locked ? "btn-primary" : "btn-secondary"}
                                                    style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', background: access.is_locked ? '#ef4444' : 'white', width: '100%' }}
                                                >
                                                    {access.is_locked ? 'Unlock' : 'Lock'}
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                        <div style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
                            <button onClick={() => setSchedulingGroup(null)} className="btn-secondary">Done</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
