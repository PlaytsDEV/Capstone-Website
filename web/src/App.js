import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Public Pages
import LandingPage from './features/public/pages/LandingPage';
import GPuyatPage from './features/public/pages/GPuyatPage';
import GPuyatRoomsPage from './features/public/pages/GPuyatRoomsPage';
import PrivateRoomPage from './features/public/pages/PrivateRoomPage';
import DoubleSharingPage from './features/public/pages/DoubleSharingPage';
import QuadrupleSharingPage from './features/public/pages/QuadrupleSharingPage';
import GuadalupePage from './features/public/pages/GuadalupePage';
import GuadalupeRoomsPage from './features/public/pages/GuadalupeRoomsPage';

// Admin Pages
import AdminLoginPage from './features/admin/pages/AdminLoginPage';
import AdminDashboardPage from './features/admin/pages/Dashboard';
import InquiriesPage from './features/admin/pages/InquiriesPage';
import ReservationsPage from './features/admin/pages/ReservationsPage';
import RoomAvailabilityPage from './features/admin/pages/RoomAvailabilityPage';
import TenantsPage from './features/admin/pages/TenantsPage';

// Tenant Pages
import SignIn from './features/tenant/pages/SignIn';
import SignUp from './features/tenant/pages/SignUp';

function App() {
  return (
    <Router>
      <Routes>

        {/* Public Page */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/gil-puyat" element={<GPuyatPage />} />
        <Route path="/gil-puyat/rooms" element={<GPuyatRoomsPage />} />
        <Route path="/gil-puyat/rooms/private" element={<PrivateRoomPage />} />
        <Route path="/gil-puyat/rooms/double" element={<DoubleSharingPage />} />
        <Route path="/:branch/rooms/quadruple" element={<QuadrupleSharingPage />} />
        <Route path="/guadalupe" element={<GuadalupePage />} />
        <Route path="/guadalupe/rooms" element={<GuadalupeRoomsPage />} />
        
        {/* Admin Page */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        <Route path="/admin/inquiries" element={<InquiriesPage />} />
        <Route path="/admin/reservations" element={<ReservationsPage />} />
        <Route path="/admin/room-availability" element={<RoomAvailabilityPage />} />
        <Route path="/admin/tenants" element={<TenantsPage />} />

        {/* Tenant Page */}
        <Route path="/tenant/signin" element={<SignIn />} />
        <Route path="/tenant/signup" element={<SignUp />} />


      </Routes>
    </Router>
  );
}

export default App;
