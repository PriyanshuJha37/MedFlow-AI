import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './hooks/useToast';
import { ProtectedRoute, RoleRedirect } from './components/layout/ProtectedRoute';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import Login from './pages/Login';
import StaffDashboard from './pages/staff/Dashboard';
import StaffMedicines from './pages/staff/Medicines';
import StaffFootfall from './pages/staff/Footfall';
import StaffBeds from './pages/staff/Beds';
import StaffAttendance from './pages/staff/Attendance';
import StaffEmergency from './pages/staff/Emergency';
import AdminOverview from './pages/admin/Overview';
import AdminMedicines from './pages/admin/Medicines';
import AdminFootfall from './pages/admin/Footfall';
import AdminBeds from './pages/admin/Beds';
import AdminStaff from './pages/admin/Staff';
import AdminAlerts from './pages/admin/Alerts';
import AdminAnalytics from './pages/admin/Analytics';
import AdminTransfers from './pages/admin/Transfers';
import AdminSimulation from './pages/admin/Simulation';
import AdminFederatedLearning from './pages/admin/FederatedLearning';

const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="ml-64 flex flex-col min-h-screen">
        <Topbar />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<RoleRedirect />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/admin/overview" replace />} />
              <Route path="overview" element={<AdminOverview />} />
              <Route path="medicines" element={<AdminMedicines />} />
              <Route path="footfall" element={<AdminFootfall />} />
              <Route path="beds" element={<AdminBeds />} />
              <Route path="staff" element={<AdminStaff />} />
              <Route path="alerts" element={<AdminAlerts />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="transfers" element={<AdminTransfers />} />
              <Route path="simulation" element={<AdminSimulation />} />
              <Route path="federated" element={<AdminFederatedLearning />} />
            </Route>
            <Route
              path="/staff"
              element={
                <ProtectedRoute allowedRoles={['phc_staff']}>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/staff/dashboard" replace />} />
              <Route path="dashboard" element={<StaffDashboard />} />
              <Route path="medicines" element={<StaffMedicines />} />
              <Route path="footfall" element={<StaffFootfall />} />
              <Route path="beds" element={<StaffBeds />} />
              <Route path="attendance" element={<StaffAttendance />} />
              <Route path="emergency" element={<StaffEmergency />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
