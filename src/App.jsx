import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { MeetingProvider } from './contexts/MeetingContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ToastProvider } from './components/Toast'
import ErrorBoundary from './components/ErrorBoundary'
import PWAInstallBanner from './components/shared/PWAInstallBanner'
import CustomCursor from './components/cursor/CustomCursor'

// ── Page loader shown while lazy chunks are fetching ──────────────────────────
function PageLoader() {
  return (
    <div className="page-loader">
      <div style={{
        width: 48, height: 48,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
        marginBottom: '0.25rem',
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
          <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
          <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
        </svg>
      </div>
      <div className="loader-ring" />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Auth Pages (small, eager-loaded) ─────────────────────────────────────────
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ForgotPassword from './pages/auth/ForgotPassword'

// ── Layouts (needed for every authenticated page, kept eager) ─────────────────
import OrganizerLayout from './layouts/OrganizerLayout'
import StudentLayout from './layouts/StudentLayout'

// ── Public Pages ──────────────────────────────────────────────────────────────
const SharedProject = lazy(() => import('./pages/public/SharedProject'))

// ── Organizer Pages (lazy-loaded — large files) ───────────────────────────────
const OrganizerDashboard    = lazy(() => import('./pages/organizer/OrganizerDashboard'))
const CourseManagement      = lazy(() => import('./pages/organizer/CourseManagement'))
const AdminManagement       = lazy(() => import('./pages/organizer/AdminManagement'))
const OrganizerAssessments  = lazy(() => import('./pages/organizer/OrganizerAssessments'))
const AssessmentQuestions   = lazy(() => import('./pages/organizer/AssessmentQuestions'))
const CodingManagement      = lazy(() => import('./pages/organizer/CodingManagement'))
const LiveProctoring        = lazy(() => import('./pages/organizer/LiveProctoring'))
const UploadVideo           = lazy(() => import('./pages/organizer/UploadVideo'))
const ScheduleManager       = lazy(() => import('./pages/organizer/ScheduleManager'))
const StudentManagement     = lazy(() => import('./pages/organizer/StudentManagement'))
const Notifications         = lazy(() => import('./pages/organizer/Notifications'))
const OrganizerProfile      = lazy(() => import('./pages/organizer/OrganizerProfile'))
const RenewalManagement     = lazy(() => import('./pages/organizer/RenewalManagement'))
const LiveClassroom         = lazy(() => import('./pages/organizer/LiveClassroom'))
const OrganizerRecordings   = lazy(() => import('./pages/organizer/OrganizerRecordings'))
const OrganizerAnalytics    = lazy(() => import('./pages/organizer/OrganizerAnalytics'))
const CodePlayground        = lazy(() => import('./pages/shared/CodePlayground'))
const Support               = lazy(() => import('./pages/shared/Support'))

// ── Student Pages (lazy-loaded) ───────────────────────────────────────────────
const StudentDashboard  = lazy(() => import('./pages/student/StudentDashboard'))
const MyCourses         = lazy(() => import('./pages/student/MyCourses'))
const CourseDetail      = lazy(() => import('./pages/student/CourseDetail'))
const Assessments       = lazy(() => import('./pages/student/Assessments'))
const TakeAssessment    = lazy(() => import('./pages/student/TakeAssessment'))
const AssessmentReview  = lazy(() => import('./pages/student/AssessmentReview'))
const CodingPractice    = lazy(() => import('./pages/student/CodingPractice'))
const CodeWorkspace     = lazy(() => import('./pages/student/CodeWorkspace'))
const Achievements      = lazy(() => import('./pages/student/Achievements'))
const Profile           = lazy(() => import('./pages/student/Profile'))
const Leaderboard       = lazy(() => import('./pages/student/Leaderboard'))
const RenewAccess       = lazy(() => import('./pages/student/RenewAccess'))
const AIStudyAssistant  = lazy(() => import('./pages/student/AIStudyAssistant'))

// ── Home redirect based on role ───────────────────────────────────────────────
function HomeRedirect() {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  // Wait if AuthContext is initializing, OR if we have a user but are still fetching their profile
  if (loading || (user && !profile)) return <PageLoader />

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />

  const role = profile?.role || 'student'
  if (['organizer', 'sub_admin', 'main_admin'].includes(role)) {
    return <Navigate to="/organizer" replace />
  }
  return <Navigate to="/student" replace />
}

// ── App ───────────────────────────────────────────────────────────────────────
function AppInner() {
  const [subdomain, setSubdomain] = useState(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => console.error('SW registration failed:', err));
    }

    // Subdomain detection logic
    const host = window.location.hostname;
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';
    
    if (!isLocalhost && host.includes('learnovas.in') && host !== 'learnovas.in' && host !== 'www.learnovas.in') {
      const parts = host.split('.');
      if (parts.length >= 3) {
        setSubdomain(parts[0]);
      }
    }
  }, []);

  if (subdomain) {
    return (
      <Suspense fallback={<PageLoader />}>
        <SharedProject subdomainSlug={subdomain} />
      </Suspense>
    );
  }

  return (
    <MeetingProvider>
      <CustomCursor />
      <PWAInstallBanner />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/login"           element={<Login />} />
          <Route path="/register"        element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/p/:projectId"    element={<SharedProject />} />

          {/* Organizer / Admin */}
          <Route path="/organizer" element={
            <ProtectedRoute requiredRole="organizer">
              <OrganizerLayout />
            </ProtectedRoute>
          }>
            <Route index                                    element={<OrganizerDashboard />} />
            <Route path="courses"                           element={<CourseManagement />} />
            <Route path="admins"                            element={<AdminManagement />} />
            <Route path="assessments"                       element={<OrganizerAssessments />} />
            <Route path="assessments/:assessmentId/questions" element={<AssessmentQuestions />} />
            <Route path="coding"                            element={<CodingManagement />} />
            <Route path="proctoring"                        element={<LiveProctoring />} />
            <Route path="upload"                            element={<UploadVideo />} />
            <Route path="recordings"                        element={<OrganizerRecordings />} />
            <Route path="schedule"                          element={<ScheduleManager />} />
            <Route path="analytics"                         element={<OrganizerAnalytics />} />
            <Route path="students"                          element={<StudentManagement />} />
            <Route path="leaderboard"                       element={<Leaderboard />} />
            <Route path="notifications"                     element={<Notifications />} />
            <Route path="playground"                        element={<CodePlayground />} />
            <Route path="support"                           element={<Support />} />
            <Route path="profile"                           element={<OrganizerProfile />} />
            <Route path="renewals"                          element={<RenewalManagement />} />
            <Route path="classroom/:videoId"               element={<LiveClassroom />} />
          </Route>

          {/* Student */}
          <Route path="/student" element={
            <ProtectedRoute requiredRole="student">
              <StudentLayout />
            </ProtectedRoute>
          }>
            <Route index                                    element={<StudentDashboard />} />
            <Route path="courses"                           element={<MyCourses />} />
            <Route path="courses/:courseId"                 element={<CourseDetail />} />
            <Route path="assessments"                       element={<Assessments />} />
            <Route path="assessments/:assessmentId/take"   element={<TakeAssessment />} />
            <Route path="assessments/:assessmentId/review" element={<AssessmentReview />} />
            <Route path="coding"                            element={<CodingPractice />} />
            <Route path="coding/:challengeId"              element={<CodeWorkspace />} />
            <Route path="achievements"                      element={<Achievements />} />
            <Route path="playground"                        element={<CodePlayground />} />
            <Route path="support"                           element={<Support />} />
            <Route path="profile"                           element={<Profile />} />
            <Route path="leaderboard"                       element={<Leaderboard />} />
            <Route path="ai-coach"                          element={<AIStudyAssistant />} />
            <Route path="renew"                             element={<RenewAccess />} />
            <Route path="classroom/:videoId"               element={<LiveClassroom />} />
          </Route>

          {/* Fallback */}
          <Route path="/"  element={<HomeRedirect />} />
          <Route path="*"  element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </MeetingProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ErrorBoundary>
            <AppInner />
          </ErrorBoundary>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
