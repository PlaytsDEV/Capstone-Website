import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Public Pages
import LandingPage from './public-pages/LandingPage';
import GPuyatPage from './public-pages/GPuyatPage';
import GPuyatRoomsPage from './public-pages/GPuyatRoomsPage';
import PrivateRoomPage from './public-pages/PrivateRoomPage';
import DoubleSharingPage from './public-pages/DoubleSharingPage';
import QuadrupleSharingPage from './public-pages/QuadrupleSharingPage';
import GuadalupePage from './public-pages/GuadalupePage';
import GuadalupeRoomsPage from './public-pages/GuadalupeRoomsPage';

// Admin Pages
import AdminLoginPage from './admin-pages/AdminLoginPage';
import AdminDashboardPage from './admin-pages/Dashboard';
import InquiriesPage from './admin-pages/InquiriesPage';
import ReservationsPage from './admin-pages/ReservationsPage';
import RoomAvailabilityPage from './admin-pages/RoomAvailabilityPage';

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

      </Routes>
    </Router>
  );
}

export default App;
