# Project Structure

This project follows a **role-based feature structure** for better organization and scalability.

## 📁 Folder Organization

```
src/
├── features/                    # Role-based features
│   ├── public/                  # Public-facing features (no authentication)
│   │   ├── components/          # Public-specific components
│   │   ├── pages/               # Public pages (Landing, Gil Puyat, Guadalupe, Rooms)
│   │   ├── modals/              # Public modals (Inquiry)
│   │   └── styles/              # Public page styles
│   │
│   ├── user/                    # User role features (authenticated users)
│   │   ├── components/          # User-specific components
│   │   ├── pages/               # User dashboard, profile, bookings, etc.
│   │   └── styles/              # User page styles
│   │
│   ├── admin/                   # Admin role features
│   │   ├── components/          # Admin components (Sidebar, InquiryItem, ReservationItem)
│   │   ├── pages/               # Admin pages (Dashboard, Inquiries, Reservations, Room Availability)
│   │   └── styles/              # Admin page styles
│   │
│   └── super-admin/             # Super Admin role features
│       ├── components/          # Super admin components
│       ├── pages/               # Super admin pages (User Management, System Settings)
│       └── styles/              # Super admin page styles
│
├── shared/                      # Shared across all roles
│   ├── components/              # Reusable components (Navbar, Footer, Logo)
│   ├── layouts/                 # Layout components (MainLayout, AdminLayout)
│   ├── hooks/                   # Custom React hooks
│   └── utils/                   # Utility functions, helpers, constants
│
├── assets/                      # Static assets
│   ├── images/                  # Images organized by branch/purpose
│   │   ├── gpuyat/              # Gil Puyat branch images
│   │   ├── guadalupe/           # Guadalupe branch images
│   │   └── landingpage/         # Landing page images
│   └── icons/                   # Icon files
│
├── App.js                       # Main app component with routes
├── App.css                      # Global app styles
├── index.js                     # Entry point
└── index.css                    # Global styles
```

## 🎯 Role-based Access

### Public (No Authentication)

- Landing page
- Branch information pages (Gil Puyat, Guadalupe)
- Room browsing (Private, Double, Quadruple)
- Inquiry submission

### User (Authenticated Users)

- User dashboard
- Booking management
- Profile settings
- Reservation history

### Admin (Branch Managers)

- Admin dashboard
- View/manage inquiries
- View/manage reservations
- Room availability management

### Super Admin (System Administrators)

- All admin features
- User management
- System-wide settings
- Analytics and reports
- Branch management

## 📝 Naming Conventions

- **Components**: PascalCase (e.g., `Navbar.jsx`, `InquiryItem.jsx`)
- **Pages**: PascalCase with `Page` suffix (e.g., `LandingPage.jsx`, `DashboardPage.jsx`)
- **Styles**: kebab-case matching component name (e.g., `admin-dashboard.css`)
- **Utilities**: camelCase (e.g., `formatDate.js`, `apiService.js`)

## 🔄 Import Examples

```javascript
// Public pages
import LandingPage from "./features/public/pages/LandingPage";

// Admin components
import Sidebar from "./features/admin/components/Sidebar";

// Shared components
import Navbar from "./shared/components/Navbar";

// Assets
import logo from "./assets/images/landingpage/logo.png";

// Utils
import { formatDate } from "./shared/utils/dateUtils";
```

## 🚀 Benefits

1. **Clear Separation**: Easy to identify which features belong to which role
2. **Scalability**: Add new roles/features without restructuring
3. **Maintainability**: Find and update files quickly
4. **Security**: Clear boundaries for role-based access control
5. **Team Collaboration**: Multiple developers can work on different roles without conflicts
