import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import LoadingScreen from './components/LoadingScreen';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import EmployeesPage from './pages/EmployeesPage';
import LeavesPage from './pages/LeavesPage';
import LeaveApplyPage from './pages/LeaveApplyPage';
import LeaveRequestDetailPage from './pages/LeaveRequestDetailPage';
import DocumentsPage from './pages/DocumentsPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import SettingsPage from './pages/SettingsPage';
import AuditLogsPage from './pages/AuditLogsPage';
import NotFoundPage from './pages/NotFoundPage';
import KPIMatrixPage from './pages/KPIMatrixPage';
import KPIMatrixEmployeePage from './pages/KPIMatrixEmployeePage';
import PerformanceDashboard from './pages/PerformanceDashboard';
import PerformanceEmployeePage from './pages/PerformanceEmployeePage';
import LeaveStatusBoardPage from './pages/LeaveStatusBoardPage';
import PayslipsPage from './pages/PayslipsPage';
import PayslipTemplatesPage from './pages/PayslipTemplatesPage';
import TravelPage from './pages/TravelPage';
import TravelApplyPage from './pages/TravelApplyPage';
import TravelDetailPage from './pages/TravelDetailPage';
import TravelSettingsPage from './pages/TravelSettingsPage';
import OfficialTravelPage from './pages/OfficialTravelPage';
import TravelReimbursementPage from './pages/TravelReimbursementPage';
import LocalMovementPage from './pages/LocalMovementPage';
import LocalMovementBookingPage from './pages/LocalMovementBookingPage';
import LocalMovementReimbursementPage from './pages/LocalMovementReimbursementPage';
import LeaveReportPage from './pages/LeaveReportPage';
import TravelReportPage from './pages/TravelReportPage';
import ReportPage from './pages/ReportPage';

function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
}

function LandingRedirect() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  const { loading, isAuthenticated } = useAuth();

  if (loading && isAuthenticated) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route path="/" element={<LandingRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['employee', 'supervisor', 'admin', 'ceo', 'finance']}><DashboardPage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute allowedRoles={['employee', 'supervisor', 'admin', 'ceo', 'finance']}><ProfilePage /></ProtectedRoute>} />
      <Route path="/employees" element={<ProtectedRoute allowedRoles={['supervisor', 'admin', 'ceo']}><EmployeesPage /></ProtectedRoute>} />
      <Route path="/leaves" element={<ProtectedRoute allowedRoles={['employee', 'supervisor', 'admin', 'ceo', 'finance']}><LeavesPage /></ProtectedRoute>} />
      <Route path="/leave-status" element={<ProtectedRoute allowedRoles={['employee', 'supervisor', 'admin', 'ceo', 'finance']}><LeaveStatusBoardPage /></ProtectedRoute>} />
      <Route path="/leaves/new" element={<ProtectedRoute allowedRoles={['employee', 'supervisor', 'admin', 'finance']}><LeaveApplyPage /></ProtectedRoute>} />
      <Route path="/leaves/:id" element={<ProtectedRoute allowedRoles={['employee', 'supervisor', 'admin', 'ceo', 'finance']}><LeaveRequestDetailPage /></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute allowedRoles={['employee', 'supervisor', 'admin', 'ceo', 'finance']}><DocumentsPage /></ProtectedRoute>} />
      <Route path="/kpi-matrix" element={<ProtectedRoute allowedRoles={['admin', 'ceo', 'finance']}><KPIMatrixPage /></ProtectedRoute>} />
      <Route path="/kpi-matrix/:employeeId" element={<ProtectedRoute allowedRoles={['admin', 'ceo', 'finance']}><KPIMatrixEmployeePage /></ProtectedRoute>} />
      <Route path="/performance-dashboard" element={<ProtectedRoute allowedRoles={['admin', 'ceo', 'finance']}><PerformanceDashboard /></ProtectedRoute>} />
      <Route path="/performance-dashboard/:employeeId" element={<ProtectedRoute allowedRoles={['admin', 'ceo', 'finance']}><PerformanceEmployeePage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute allowedRoles={['admin', 'ceo', 'finance']}><SettingsPage /></ProtectedRoute>} />
      <Route path="/audit-logs" element={<ProtectedRoute allowedRoles={['admin']}><AuditLogsPage /></ProtectedRoute>} />
      <Route path="/payslips" element={<ProtectedRoute allowedRoles={['employee', 'supervisor', 'admin', 'ceo', 'finance']}><PayslipsPage /></ProtectedRoute>} />
      <Route path="/payslip-templates" element={<ProtectedRoute allowedRoles={['admin']}><PayslipTemplatesPage /></ProtectedRoute>} />
      <Route path="/travel" element={<ProtectedRoute allowedRoles={['employee', 'supervisor', 'admin', 'ceo', 'finance']}><TravelPage /></ProtectedRoute>} />
      <Route path="/travel/official" element={<ProtectedRoute allowedRoles={['employee', 'supervisor', 'admin', 'finance']}><OfficialTravelPage /></ProtectedRoute>} />
      <Route path="/travel/apply" element={<ProtectedRoute allowedRoles={['employee', 'supervisor', 'admin', 'finance']}><TravelApplyPage /></ProtectedRoute>} />
      <Route path="/travel/reimbursement" element={<ProtectedRoute allowedRoles={['employee', 'supervisor', 'admin', 'finance']}><TravelReimbursementPage /></ProtectedRoute>} />
      <Route path="/travel/local" element={<ProtectedRoute allowedRoles={['employee', 'supervisor', 'admin', 'finance']}><LocalMovementPage /></ProtectedRoute>} />
      <Route path="/travel/local/booking" element={<ProtectedRoute allowedRoles={['employee', 'supervisor', 'admin', 'finance']}><LocalMovementBookingPage /></ProtectedRoute>} />
      <Route path="/travel/local/reimbursement" element={<ProtectedRoute allowedRoles={['employee', 'supervisor', 'admin', 'finance']}><LocalMovementReimbursementPage /></ProtectedRoute>} />
      <Route path="/travel/:id" element={<ProtectedRoute allowedRoles={['employee', 'supervisor', 'admin', 'ceo', 'finance']}><TravelDetailPage /></ProtectedRoute>} />
      <Route path="/travel/settings" element={<ProtectedRoute allowedRoles={['admin']}><TravelSettingsPage /></ProtectedRoute>} />
      <Route path="/report" element={<ProtectedRoute allowedRoles={['admin', 'ceo']}><ReportPage /></ProtectedRoute>} />
      <Route path="/leave-report" element={<ProtectedRoute allowedRoles={['admin', 'ceo']}><LeaveReportPage /></ProtectedRoute>} />
      <Route path="/travel-report" element={<ProtectedRoute allowedRoles={['admin', 'ceo']}><TravelReportPage /></ProtectedRoute>} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
