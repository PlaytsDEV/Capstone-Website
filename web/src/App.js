import "./App.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ScrollToTop from "./shared/components/ScrollToTop";
import { FirebaseAuthProvider } from "./shared/hooks/FirebaseAuthContext";
import { AuthProvider, useAuth } from "./shared/hooks/useAuth";
import GlobalLoading from "./shared/components/GlobalLoading";

// Public Pages
import LandingPage from "./features/public/pages/LandingPage";
import GPuyatPage from "./features/public/pages/GPuyatPage";
import GPuyatRoomsPage from "./features/public/pages/GPuyatRoomsPage";
import PrivateRoomPage from "./features/public/pages/PrivateRoomPage";
import DoubleSharingPage from "./features/public/pages/DoubleSharingPage";
import QuadrupleSharingPage from "./features/public/pages/QuadrupleSharingPage";
import GuadalupePage from "./features/public/pages/GuadalupePage";
import GuadalupeRoomsPage from "./features/public/pages/GuadalupeRoomsPage";
import FAQsPage from "./features/public/pages/FAQsPage";

// Admin Pages
import AdminLoginPage from "./features/admin/pages/AdminLoginPage";
import AdminDashboardPage from "./features/admin/pages/Dashboard";
import InquiriesPage from "./features/admin/pages/InquiriesPage";
import ReservationsPage from "./features/admin/pages/ReservationsPage";
import RoomAvailabilityPage from "./features/admin/pages/RoomAvailabilityPage";
import TenantsPage from "./features/admin/pages/TenantsPage";

// Guards
import RequireAdmin from "./shared/guards/RequireAdmin";
import RequireNonAdmin from "./shared/guards/RequireNonAdmin";
import ProtectedRoute from "./shared/components/ProtectedRoute";

// Tenant Pages
import SignIn from "./features/tenant/pages/SignIn.jsx";
import SignUp from "./features/tenant/pages/SignUp.jsx";
import BranchSelection from "./features/tenant/pages/BranchSelection.jsx";
import ForgotPassword from "./features/tenant/pages/ForgotPassword.jsx";
import CheckAvailabilityPage from "./features/tenant/pages/CheckAvailabilityPage";
import ProfilePage from "./features/tenant/pages/ProfilePage";
import BillingPage from "./features/tenant/pages/BillingPage";
import ContractsPage from "./features/tenant/pages/ContractsPage";
/**
 * Inner App component that uses auth context
 * Must be rendered inside AuthProvider to access useAuth hook
 */
function AppContent() {
  const { globalLoading } = useAuth();

  return (
    <Router>
      <ScrollToTop />
      {/* Global loading overlay for auth operations */}
      {globalLoading && <GlobalLoading />}
      <Routes>
        {/* Public Page */}
        <Route
          path="/"
          element={
            <RequireNonAdmin>
              <LandingPage />
            </RequireNonAdmin>
          }
        />
        <Route
          path="/gil-puyat"
          element={
            <RequireNonAdmin>
              <GPuyatPage />
            </RequireNonAdmin>
          }
        />
        <Route
          path="/gil-puyat/rooms"
          element={
            <ProtectedRoute>
              <GPuyatRoomsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gil-puyat/rooms/private"
          element={
            <ProtectedRoute>
              <PrivateRoomPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gil-puyat/rooms/double"
          element={
            <ProtectedRoute>
              <DoubleSharingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/:branch/rooms/quadruple"
          element={
            <ProtectedRoute>
              <QuadrupleSharingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/guadalupe"
          element={
            <RequireNonAdmin>
              <GuadalupePage />
            </RequireNonAdmin>
          }
        />
        <Route
          path="/guadalupe/rooms"
          element={
            <ProtectedRoute>
              <GuadalupeRoomsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/faqs"
          element={
            <RequireNonAdmin>
              <FAQsPage />
            </RequireNonAdmin>
          }
        />

        <Route path="/admin/login" element={<AdminLoginPage />} />

        <Route
          path="/faqs"
          element={
            <RequireNonAdmin>
              <FAQsPage />
            </RequireNonAdmin>
          }
        />

        {/* Admin routes - all require admin auth */}
        <Route
          path="/admin/dashboard"
          element={
            <RequireAdmin>
              <AdminDashboardPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/inquiries"
          element={
            <RequireAdmin>
              <InquiriesPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/reservations"
          element={
            <RequireAdmin>
              <ReservationsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/room-availability"
          element={
            <RequireAdmin>
              <RoomAvailabilityPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/tenants"
          element={
            <RequireAdmin>
              <TenantsPage />
            </RequireAdmin>
          }
        />

        {/* Tenant Page */}
        <Route
          path="/tenant/signin"
          element={
            <RequireNonAdmin>
              <SignIn />
            </RequireNonAdmin>
          }
        />
        <Route
          path="/tenant/signup"
          element={
            <RequireNonAdmin>
              <SignUp />
            </RequireNonAdmin>
          }
        />
        <Route
          path="/tenant/branch-selection"
          element={
            <RequireNonAdmin>
              <BranchSelection />
            </RequireNonAdmin>
          }
        />
        <Route
          path="/tenant/forgot-password"
          element={
            <RequireNonAdmin>
              <ForgotPassword />
            </RequireNonAdmin>
          }
        />
        <Route
          path="/check-availability"
          element={
            <ProtectedRoute requiredRole="user">
              <CheckAvailabilityPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tenant/profile"
          element={
            <ProtectedRoute requiredRole="user">
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tenant/billing"
          element={
            <ProtectedRoute requiredRole="user">
              <BillingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tenant/contracts"
          element={
            <ProtectedRoute requiredRole="user">
              <ContractsPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

/**
 * Root App component
 * Wraps AppContent with auth providers so useAuth hook works correctly
 */
function App() {
  return (
    <FirebaseAuthProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </FirebaseAuthProvider>
  );
}

export default App;
