import { NavLink } from 'react-router-dom';
import '../admin-styles/admin-sidebar.css';
import logoImage from '../landingpage-images/logo.png';

function Sidebar() {
  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-header">
        <img src={logoImage} alt="Lilycrest Logo" className="admin-sidebar-logo" />
        <h2 className="admin-sidebar-title">Admin Portal</h2>
      </div>

      <nav className="admin-sidebar-nav">
        <ul className="admin-sidebar-menu">
          {/* Dashboard */}
          <li className="admin-sidebar-menu-item">
            <NavLink to="/admin/dashboard" className={({ isActive }) => `admin-sidebar-menu-link ${isActive ? 'admin-sidebar-menu-link-active' : ''}`}>
              <span className="admin-sidebar-menu-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M7.5 2.5H3.33333C2.8731 2.5 2.5 2.8731 2.5 3.33333V9.16667C2.5 9.6269 2.8731 10 3.33333 10H7.5C7.96024 10 8.33333 9.6269 8.33333 9.16667V3.33333C8.33333 2.8731 7.96024 2.5 7.5 2.5Z" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16.667 2.5H12.5003C12.0401 2.5 11.667 2.8731 11.667 3.33333V5.83333C11.667 6.29357 12.0401 6.66667 12.5003 6.66667H16.667C17.1272 6.66667 17.5003 6.29357 17.5003 5.83333V3.33333C17.5003 2.8731 17.1272 2.5 16.667 2.5Z" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16.667 10H12.5003C12.0401 10 11.667 10.3731 11.667 10.8333V16.6667C11.667 17.1269 12.0401 17.5 12.5003 17.5H16.667C17.1272 17.5 17.5003 17.1269 17.5003 16.6667V10.8333C17.5003 10.3731 17.1272 10 16.667 10Z" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M7.5 13.3334H3.33333C2.8731 13.3334 2.5 13.7065 2.5 14.1667V16.6667C2.5 17.1269 2.8731 17.5 3.33333 17.5H7.5C7.96024 17.5 8.33333 17.1269 8.33333 16.6667V14.1667C8.33333 13.7065 7.96024 13.3334 7.5 13.3334Z" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <span className="admin-sidebar-menu-text">Dashboard</span>
            </NavLink>
          </li>

          {/* Inquiries */}
          <li className="admin-sidebar-menu-item">
            <NavLink to="/admin/inquiries" className={({ isActive }) => `admin-sidebar-menu-link ${isActive ? 'admin-sidebar-menu-link-active' : ''}`}>
              <span className="admin-sidebar-menu-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M18.3332 14.1667C18.3332 14.6087 18.1576 15.0326 17.845 15.3452C17.5325 15.6577 17.1085 15.8333 16.6665 15.8333H5.68984C5.24785 15.8334 4.82399 16.0091 4.5115 16.3217L2.6765 18.1567C2.59376 18.2394 2.48834 18.2957 2.37358 18.3186C2.25882 18.3414 2.13986 18.3297 2.03176 18.2849C1.92366 18.2401 1.83126 18.1643 1.76624 18.067C1.70123 17.9697 1.66652 17.8553 1.6665 17.7383V4.16667C1.6665 3.72464 1.8421 3.30072 2.15466 2.98816C2.46722 2.67559 2.89114 2.5 3.33317 2.5H16.6665C17.1085 2.5 17.5325 2.67559 17.845 2.98816C18.1576 3.30072 18.3332 3.72464 18.3332 4.16667V14.1667Z" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <span className="admin-sidebar-menu-text">Inquiries</span>
            </NavLink>
          </li>

          {/* Reservations */}
          <li className="admin-sidebar-menu-item">
            <NavLink to="/admin/reservations" className={({ isActive }) => `admin-sidebar-menu-link ${isActive ? 'admin-sidebar-menu-link-active' : ''}`}>
              <span className="admin-sidebar-menu-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M12.4998 1.66663H7.49984C7.0396 1.66663 6.6665 2.03972 6.6665 2.49996V4.16663C6.6665 4.62686 7.0396 4.99996 7.49984 4.99996H12.4998C12.9601 4.99996 13.3332 4.62686 13.3332 4.16663V2.49996C13.3332 2.03972 12.9601 1.66663 12.4998 1.66663Z" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M13.3335 3.33337H15.0002C15.4422 3.33337 15.8661 3.50897 16.1787 3.82153C16.4912 4.13409 16.6668 4.55801 16.6668 5.00004V16.6667C16.6668 17.1087 16.4912 17.5327 16.1787 17.8452C15.8661 18.1578 15.4422 18.3334 15.0002 18.3334H5.00016C4.55814 18.3334 4.13421 18.1578 3.82165 17.8452C3.50909 17.5327 3.3335 17.1087 3.3335 16.6667V5.00004C3.3335 4.55801 3.50909 4.13409 3.82165 3.82153C4.13421 3.50897 4.55814 3.33337 5.00016 3.33337H6.66683" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10 9.16663H13.3333" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10 13.3334H13.3333" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M6.6665 9.16663H6.67484" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M6.6665 13.3334H6.67484" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <span className="admin-sidebar-menu-text">Reservations</span>
            </NavLink>
          </li>

          {/* Room Availability */}
          <li className="admin-sidebar-menu-item">
            <NavLink to="/admin/room-availability" className={({ isActive }) => `admin-sidebar-menu-link ${isActive ? 'admin-sidebar-menu-link-active' : ''}`}>
              <span className="admin-sidebar-menu-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M15.8333 2.5H4.16667C3.24619 2.5 2.5 3.24619 2.5 4.16667V15.8333C2.5 16.7538 3.24619 17.5 4.16667 17.5H15.8333C16.7538 17.5 17.5 16.7538 17.5 15.8333V4.16667C17.5 3.24619 16.7538 2.5 15.8333 2.5Z" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2.5 7.5H17.5" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2.5 12.5H17.5" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7.5 2.5V17.5" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12.5 2.5V17.5" stroke="currentColor" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              </span>
              <span className="admin-sidebar-menu-text">Room Availability</span>
            </NavLink>
          </li>
        </ul>
      </nav>

      {/* Logout */}
      <div className="admin-sidebar-footer">
        <button className="admin-sidebar-logout">
          <span className="admin-sidebar-logout-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13.3335 14.1667L17.5002 10L13.3335 5.83334" stroke="#E7000B" stroke-width="1.66667" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M17.5 10H7.5" stroke="#E7000B" stroke-width="1.66667" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M7.5 17.5H4.16667C3.72464 17.5 3.30072 17.3244 2.98816 17.0118C2.67559 16.6993 2.5 16.2754 2.5 15.8333V4.16667C2.5 3.72464 2.67559 3.30072 2.98816 2.98816C3.30072 2.67559 3.72464 2.5 4.16667 2.5H7.5" stroke="#E7000B" stroke-width="1.66667" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <span className="admin-sidebar-logout-text">Logout</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
