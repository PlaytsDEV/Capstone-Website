# Project Structure Guide

## Overview

The Lilycrest Dormitory Management System follows a **feature-based architecture** that separates concerns by user roles.

---

## Root Structure

```
Lilycrest-Web/
├── docs/                    # 📚 All documentation
│   ├── AUTHENTICATION.md   # Auth system documentation
│   ├── API.md              # API endpoint reference
│   └── STRUCTURE.md        # This file
│
├── server/                  # 🖥️ Backend (Express.js)
│   ├── config/             # Configuration files


│   ├── models/             # MongoDB schemas

│   ├── routes/             # API route handlers
│   └── server.js           # Entry point
│
│   ├── public/             # Static public files
│   └── build/              # Production build (generated)
│
```

## Frontend Structure (`web/src/`)

src/
├── features/ # 🎯 Role-based feature modules
│ ├── public/ # Public pages (no auth required)

│ ├── tenant/ # Tenant/resident features
│ ├── admin/ # Branch admin features
│ └── super-admin/ # System admin features
│
├── shared/ # ♻️ Shared across all features
│ ├── api/ # API client functions

│ ├── components/ # Reusable UI components

│ ├── layouts/ # Page layouts
│
├── assets/ # 🖼️ Static assets
│ └── images/ # Images by category
│ ├── gpuyat/ # Gil Puyat branch
│ ├── guadalupe/ # Guadalupe branch
│ └── landingpage/ # Landing page
│
├── firebase/ # 🔥 Firebase configuration
│ └── config.js
│
├── App.js # Main app with routing
├── App.css # Global app styles
├── index.js # Entry point
└── index.css # Global CSS

```

---

## Feature Module Structure

Each feature module follows a consistent pattern:

```

features/{role}/
├── pages/ # Page components
├── components/ # Feature-specific components
├── modals/ # Modal dialogs
├── hooks/ # Feature-specific hooks
├── services/ # API services
├── styles/ # CSS files
└── index.js # Barrel exports

```

### Public Feature (`features/public/`)

- Landing page
- Branch information pages
- Room listings and details
- Inquiry modal

### Tenant Feature (`features/tenant/`)

- Sign up / Sign in
- Branch selection
- Forgot password
- Dashboard, Profile, Billing, Contracts

### Admin Feature (`features/admin/`)

- Admin login
- Dashboard with statistics
- Inquiries management
- Reservations management
- Tenants management
- Room availability

### Super Admin Feature (`features/super-admin/`)

- System dashboard
- User management
- Role/permissions management
- Branch management
- Activity logs
- System settings

---

## Backend Structure (`server/`)

```

server/
├── config/
│ ├── database.js # MongoDB connection
│ ├── firebase.js # Firebase Admin SDK
│ └── email.js # Nodemailer configuration
│
├── middleware/
│ ├── auth.js # JWT/Firebase verification
│ └── branchAccess.js # Branch-based access control
│
├── models/
│ ├── User.js # User schema
│ ├── Room.js # Room schema
│ ├── Reservation.js # Reservation schema
│ ├── Inquiry.js # Inquiry schema
│ ├── archive/ # Archive utility schemas
│ └── index.js # Model exports
│
├── routes/
│ ├── auth.js # Authentication routes
│ ├── users.js # User management routes
│ ├── rooms.js # Room routes
│ ├── reservations.js # Reservation routes
│ └── inquiries.js # Inquiry routes
│
├── scripts/ # Utility scripts
│ ├── check-inquiry-data.js
│ ├── cleanup-test-data.js
│ └── fix-inquiry-data.js
│
└── server.js # Express app entry point

```

---

## Shared Components (`shared/`)

### API (`shared/api/`)

| File           | Purpose                          |
| -------------- | -------------------------------- |
| `apiClient.js` | Axios instance with interceptors |
| `authApi.js`   | Auth-related API calls           |
| `commonApi.js` | Common API utilities             |
| `tenantApi.js` | Tenant-specific API calls        |

### Components (`shared/components/`)

| Component            | Purpose                  |
| -------------------- | ------------------------ |
| `Navbar.js`          | Main navigation bar      |
| `Footer.jsx`         | Page footer              |
| `LoadingSpinner.jsx` | Loading indicator        |
| `ProtectedRoute.jsx` | Route protection wrapper |
| `ScrollToTop.jsx`    | Scroll restoration       |
| `LilycrestLogo.js`   | Brand logo component     |

### Guards (`shared/guards/`)

| Guard                   | Purpose                    |
| ----------------------- | -------------------------- |
| `RequireAuth.jsx`       | Require authenticated user |
| `RequireAdmin.jsx`      | Require admin role         |
| `RequireSuperAdmin.jsx` | Require super admin role   |

### Layouts (`shared/layouts/`)

| Layout                 | Purpose                    |
| ---------------------- | -------------------------- |
| `PublicLayout.jsx`     | Layout for public pages    |
| `TenantLayout.jsx`     | Layout for tenant pages    |
| `AdminLayout.jsx`      | Layout for admin dashboard |
| `SuperAdminLayout.jsx` | Layout for super admin     |

### Hooks (`shared/hooks/`)

| Hook                     | Purpose                |
| ------------------------ | ---------------------- |
| `useAuth.js`             | Auth state and methods |
| `FirebaseAuthContext.js` | Firebase auth context  |

### Utils (`shared/utils/`)

| Utility           | Purpose               |
| ----------------- | --------------------- |
| `auth.js`         | Auth helper functions |
| `constants.js`    | App-wide constants    |
| `currency.js`     | Currency formatting   |
| `formatDate.js`   | Date formatting       |
| `notification.js` | Toast notifications   |

---

## Naming Conventions

| Type       | Convention        | Example               |
| ---------- | ----------------- | --------------------- |
| Components | PascalCase        | `InquiryItem.jsx`     |
| Pages      | PascalCase + Page | `DashboardPage.jsx`   |
| Hooks      | camelCase + use   | `useInquiries.js`     |
| Styles     | kebab-case        | `admin-dashboard.css` |
| Utils      | camelCase         | `formatDate.js`       |
| Constants  | UPPER_SNAKE_CASE  | `API_BASE_URL`        |

---

## Route Structure

### Public Routes

| Path               | Component          |
| ------------------ | ------------------ |
| `/`                | LandingPage        |
| `/gil-puyat`       | GPuyatPage         |
| `/gil-puyat/rooms` | GPuyatRoomsPage    |
| `/guadalupe`       | GuadalupePage      |
| `/guadalupe/rooms` | GuadalupeRoomsPage |

### Tenant Routes (Protected)

| Path                       | Component       |
| -------------------------- | --------------- |
| `/tenant/signin`           | SignIn          |
| `/tenant/signup`           | SignUp          |
| `/tenant/forgot-password`  | ForgotPassword  |
| `/tenant/branch-selection` | BranchSelection |
| `/tenant/dashboard`        | TenantDashboard |
| `/tenant/profile`          | ProfilePage     |

### Admin Routes (Protected)

| Path                       | Component            |
| -------------------------- | -------------------- |
| `/admin/login`             | AdminLoginPage       |
| `/admin/dashboard`         | Dashboard            |
| `/admin/inquiries`         | InquiriesPage        |
| `/admin/reservations`      | ReservationsPage     |
| `/admin/tenants`           | TenantsPage          |
| `/admin/room-availability` | RoomAvailabilityPage |

### Super Admin Routes (Protected)

| Path                     | Component            |
| ------------------------ | -------------------- |
| `/super-admin/dashboard` | SuperAdminDashboard  |
| `/super-admin/users`     | UserManagementPage   |
| `/super-admin/branches`  | BranchManagementPage |
| `/super-admin/logs`      | ActivityLogsPage     |
| `/super-admin/settings`  | SystemSettingsPage   |
```
