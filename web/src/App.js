import "./App.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Public Pages
import LandingPage from "./features/public/pages/LandingPage";
import GPuyatPage from "./features/public/pages/GPuyatPage";
import GPuyatRoomsPage from "./features/public/pages/GPuyatRoomsPage";
import PrivateRoomPage from "./features/public/pages/PrivateRoomPage";
import DoubleSharingPage from "./features/public/pages/DoubleSharingPage";
import QuadrupleSharingPage from "./features/public/pages/QuadrupleSharingPage";
import GuadalupePage from "./features/public/pages/GuadalupePage";
import GuadalupeRoomsPage from "./features/public/pages/GuadalupeRoomsPage";

// Tenant Pages
import TenantDashboard from "./features/tenant/pages/TenantDashboard";
import ProfilePage from "./features/tenant/pages/ProfilePage";
import BillingPage from "./features/tenant/pages/BillingPage";
import ContractsPage from "./features/tenant/pages/ContractsPage";

// Admin Pages
import AdminLoginPage from "./features/admin/pages/AdminLoginPage";
import AdminDashboardPage from "./features/admin/pages/Dashboard";
import InquiriesPage from "./features/admin/pages/InquiriesPage";
import ReservationsPage from "./features/admin/pages/ReservationsPage";
import RoomAvailabilityPage from "./features/admin/pages/RoomAvailabilityPage";
import TenantsPage from "./features/admin/pages/TenantsPage";
import TenantDetailsPage from "./features/admin/pages/TenantDetailsPage";
import ReportsPage from "./features/admin/pages/ReportsPage";

// Super Admin Pages
import SuperAdminDashboard from "./features/super-admin/pages/SuperAdminDashboard";
import UserManagementPage from "./features/super-admin/pages/UserManagementPage";
import RolePermissionsPage from "./features/super-admin/pages/RolePermissionsPage";
import BranchManagementPage from "./features/super-admin/pages/BranchManagementPage";
import AllTenantsPage from "./features/super-admin/pages/AllTenantsPage";
import ActivityLogsPage from "./features/super-admin/pages/ActivityLogsPage";
import SystemSettingsPage from "./features/super-admin/pages/SystemSettingsPage";

// Shared Guards
import RequireAuth from "./shared/guards/RequireAuth";
import RequireAdmin from "./shared/guards/RequireAdmin";
import RequireSuperAdmin from "./shared/guards/RequireSuperAdmin";

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/gil-puyat" element={<GPuyatPage />} />
        <Route path="/gil-puyat/rooms" element={<GPuyatRoomsPage />} />
        <Route path="/gil-puyat/rooms/private" element={<PrivateRoomPage />} />
        <Route path="/gil-puyat/rooms/double" element={<DoubleSharingPage />} />
        <Route
          path="/:branch/rooms/quadruple"
          element={<QuadrupleSharingPage />}
        />
        <Route path="/guadalupe" element={<GuadalupePage />} />
        <Route path="/guadalupe/rooms" element={<GuadalupeRoomsPage />} />

        {/* Tenant Routes - Protected */}
        <Route element={<RequireAuth />}>
          <Route path="/tenant/dashboard" element={<TenantDashboard />} />
          <Route path="/tenant/profile" element={<ProfilePage />} />
          <Route path="/tenant/billing" element={<BillingPage />} />
          <Route path="/tenant/contracts" element={<ContractsPage />} />
        </Route>

        {/* Admin Routes - Protected */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route element={<RequireAdmin />}>
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="/admin/inquiries" element={<InquiriesPage />} />
          <Route path="/admin/reservations" element={<ReservationsPage />} />
          <Route
            path="/admin/room-availability"
            element={<RoomAvailabilityPage />}
          />
          <Route path="/admin/tenants" element={<TenantsPage />} />
          <Route path="/admin/tenants/:id" element={<TenantDetailsPage />} />
          <Route path="/admin/reports" element={<ReportsPage />} />
        </Route>

        {/* Super Admin Routes - Protected */}
        <Route element={<RequireSuperAdmin />}>
          <Route
            path="/super-admin/dashboard"
            element={<SuperAdminDashboard />}
          />
          <Route path="/super-admin/users" element={<UserManagementPage />} />
          <Route path="/super-admin/roles" element={<RolePermissionsPage />} />
          <Route
            path="/super-admin/branches"
            element={<BranchManagementPage />}
          />
          <Route path="/super-admin/tenants" element={<AllTenantsPage />} />
          <Route
            path="/super-admin/activity-logs"
            element={<ActivityLogsPage />}
          />
          <Route
            path="/super-admin/settings"
            element={<SystemSettingsPage />}
          />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
