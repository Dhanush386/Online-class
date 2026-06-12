import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ToastProvider } from './components/Toast'
import ErrorBoundary from './components/ErrorBoundary'
import PWAInstallBanner from './components/shared/PWAInstallBanner'

// ── Page loader shown while lazy chunks are fetching ──────────────────────────
function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-main)' }}>
      <div style={{
        width: 40, height: 40, border: '3px solid rgba(99,102,241,0.3)',
        borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite'
      }} />
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
const UploadVideo           = lazy(() => import('./pages/organizer/UploadVideo'))
const ScheduleManager       = lazy(() => import('./pages/organizer/ScheduleManager'))
const StudentManagement     = lazy(() => import('./pages/organizer/StudentManagement'))
const Notifications         = lazy(() => import('./pages/organizer/Notifications'))
const OrganizerProfile      = lazy(() => import('./pages/organizer/OrganizerProfile'))
const RenewalManagement     = lazy(() => import('./pages/organizer/RenewalManagement'))
const LiveClassroom         = lazy(() => import('./pages/organizer/LiveClassroom'))
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

// ── Home redirect based on role ───────────────────────────────────────────────
function HomeRedirect() {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) return <PageLoader />

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />

  const role = profile?.role || 'student'
  if (['organizer', 'sub_admin', 'main_admin'].includes(role)) {
    return <Navigate to="/organizer" replace />
  }
  return <Navigate to="/student" replace />
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ErrorBoundary>
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
                  <Route path="upload"                            element={<UploadVideo />} />
                  <Route path="schedule"                          element={<ScheduleManager />} />
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
                  <Route path="renew"                             element={<RenewAccess />} />
                  <Route path="classroom/:videoId"               element={<LiveClassroom />} />
                </Route>

                {/* Fallback */}
                <Route path="/"  element={<HomeRedirect />} />
                <Route path="*"  element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
