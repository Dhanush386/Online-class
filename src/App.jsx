import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import MobileBlocker from './components/MobileBlocker'

// Auth Pages
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ForgotPassword from './pages/auth/ForgotPassword'

// Public Pages
import SharedProject from './pages/public/SharedProject'

// Layouts
import OrganizerLayout from './layouts/OrganizerLayout'
import StudentLayout from './layouts/StudentLayout'

// Organizer Pages
import OrganizerDashboard from './pages/organizer/OrganizerDashboard'
import CourseManagement from './pages/organizer/CourseManagement'
import OrganizerAssessments from './pages/organizer/OrganizerAssessments'
import AssessmentQuestions from './pages/organizer/AssessmentQuestions'
import CodingManagement from './pages/organizer/CodingManagement'
import UploadVideo from './pages/organizer/UploadVideo'
import ScheduleManager from './pages/organizer/ScheduleManager'
import StudentManagement from './pages/organizer/StudentManagement'
import CodePlayground from './pages/shared/CodePlayground'

// Student Pages
import StudentDashboard from './pages/student/StudentDashboard'
import MyCourses from './pages/student/MyCourses'
import CourseDetail from './pages/student/CourseDetail'
import Assessments from './pages/student/Assessments'
import TakeAssessment from './pages/student/TakeAssessment'
import AssessmentReview from './pages/student/AssessmentReview'
import CodingPractice from './pages/student/CodingPractice'
import CodeWorkspace from './pages/student/CodeWorkspace'
import StudentSchedule from './pages/student/StudentSchedule'
import Achievements from './pages/student/Achievements'

export default function App() {
  return (
    <BrowserRouter>
      <MobileBlocker />
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/p/:projectId" element={<SharedProject />} />

          {/* Organizer */}
          <Route path="/organizer" element={
            <ProtectedRoute requiredRole="organizer">
              <OrganizerLayout />
            </ProtectedRoute>
          }>
            <Route index element={<OrganizerDashboard />} />
            <Route path="courses" element={<CourseManagement />} />
            <Route path="assessments" element={<OrganizerAssessments />} />
            <Route path="assessments/:assessmentId/questions" element={<AssessmentQuestions />} />
            <Route path="coding" element={<CodingManagement />} />
            <Route path="upload" element={<UploadVideo />} />
            <Route path="schedule" element={<ScheduleManager />} />
            <Route path="students" element={<StudentManagement />} />
            <Route path="playground" element={<CodePlayground />} />
          </Route>

          {/* Student */}
          <Route path="/student" element={
            <ProtectedRoute requiredRole="student">
              <StudentLayout />
            </ProtectedRoute>
          }>
            <Route index element={<StudentDashboard />} />
            <Route path="courses" element={<MyCourses />} />
            <Route path="courses/:courseId" element={<CourseDetail />} />
            <Route path="assessments" element={<Assessments />} />
            <Route path="assessments/:assessmentId/take" element={<TakeAssessment />} />
            <Route path="assessments/:assessmentId/review" element={<AssessmentReview />} />
            <Route path="coding" element={<CodingPractice />} />
            <Route path="coding/:challengeId" element={<CodeWorkspace />} />
            <Route path="schedule" element={<StudentSchedule />} />
            <Route path="achievements" element={<Achievements />} />
            <Route path="playground" element={<CodePlayground />} />
          </Route>

          {/* Fallback */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
