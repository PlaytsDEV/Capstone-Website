# Lilycrest Web - Complete Restructuring Guide

## 📋 Overview

The Lilycrest Web application has been completely restructured into a clean, role-based architecture that separates concerns and makes the codebase easier to navigate and maintain.

## 🏗️ New Folder Structure

```
web/
├── src/
│   ├── features/                    # Feature-based organization
│   │   ├── public/                  # Public pages (no authentication)
│   │   │   ├── pages/              # 8 public pages
│   │   │   ├── components/         # RoomDetailsPage
│   │   │   ├── modals/             # InquiryModal
│   │   │   ├── styles/             # 7 CSS files
│   │   │   ├── PUBLIC_STRUCTURE.md # Documentation
│   │   │   └── index.js            # Exports
│   │   │
│   │   ├── tenant/                  # Tenant (resident) features
│   │   │   ├── pages/              # 4 tenant pages
│   │   │   ├── styles/             # 4 CSS files
│   │   │   ├── TENANT_STRUCTURE.md # Documentation
│   │   │   └── index.js            # Exports
│   │   │
│   │   ├── admin/                   # Branch admin features
│   │   │   ├── pages/              # 8 admin pages
│   │   │   ├── components/         # 5 reusable components
│   │   │   ├── hooks/              # 3 custom hooks
│   │   │   ├── services/           # 2 API services
│   │   │   ├── styles/             # 8 CSS files
│   │   │   ├── ADMIN_STRUCTURE.md  # Documentation
│   │   │   └── index.js            # Exports
│   │   │
│   │   └── super-admin/             # System-wide admin features
│   │       ├── pages/              # 7 super-admin pages
│   │       ├── components/         # 4 reusable components
│   │       ├── hooks/              # 3 custom hooks
│   │       ├── services/           # 2 API services
│   │       ├── styles/             # 4 CSS files
│   │       ├── SUPERADMIN_STRUCTURE.md # Documentation
│   │       └── index.js            # Exports
│   │
│   ├── shared/                      # Shared utilities across all features
│   │   ├── guards/                 # Route protection
│   │   │   ├── RequireAuth.jsx
│   │   │   ├── RequireAdmin.jsx
│   │   │   └── RequireSuperAdmin.jsx
│   │   ├── api/                    # API clients
│   │   │   ├── authApi.js
│   │   │   ├── tenantApi.js
│   │   │   └── commonApi.js
│   │   ├── layouts/                # Layout wrappers
│   │   │   ├── PublicLayout.jsx
│   │   │   ├── TenantLayout.jsx
│   │   │   ├── AdminLayout.jsx
│   │   │   └── SuperAdminLayout.jsx
│   │   ├── hooks/                  # Shared hooks
│   │   │   └── useAuth.js
│   │   └── components/             # Shared components
│   │       ├── LoadingSpinner.jsx
│   │       ├── ProtectedRoute.jsx
│   │       ├── Navbar.js
│   │       ├── Footer.jsx
│   │       └── LilycrestLogo.js
│   │
│   ├── assets/                      # Static assets
│   │   └── images/
│   │       ├── gpuyat/             # Gil Puyat branch images
│   │       ├── guadalupe/          # Guadalupe branch images
│   │       └── landingpage/        # Landing page images
│   │
│   ├── App.js                       # Main app with all routes
│   └── index.js                     # Entry point
```

## 🎯 Role-Based Structure

### 1. Public (`features/public/`)
**Purpose:** Pages accessible to everyone without authentication

**Pages:**
- Landing Page
- Gil Puyat Branch Page
- Gil Puyat Rooms
- Guadalupe Branch Page  
- Guadalupe Rooms
- Private Room Details
- Double Sharing Room Details
- Quadruple Sharing Room Details

**Routes:**
- `/` - Landing page
- `/gil-puyat` - Gil Puyat branch
- `/gil-puyat/rooms` - Room listings
- `/gil-puyat/rooms/private` - Private room details
- `/gil-puyat/rooms/double` - Double sharing details
- `/:branch/rooms/quadruple` - Quadruple sharing details
- `/guadalupe` - Guadalupe branch
- `/guadalupe/rooms` - Room listings

---

### 2. Tenant (`features/tenant/`)
**Purpose:** Pages for authenticated tenants (residents)

**Pages:**
- Dashboard - Overview of tenant account
- Profile - Personal information management
- Billing - Payment history and upcoming bills
- Contracts - Rental agreements and renewals

**Routes (Protected):**
- `/tenant/dashboard`
- `/tenant/profile`
- `/tenant/billing`
- `/tenant/contracts`

**Protection:** All routes wrapped in `<RequireAuth />` guard

---

### 3. Admin (`features/admin/`)
**Purpose:** Branch-level administrative operations

**Pages:**
- Login Page
- Dashboard - Admin overview
- Inquiries - Manage customer inquiries
- Reservations - Manage bookings
- Room Availability - Manage room inventory
- Tenants - Manage current tenants
- Tenant Details - Individual tenant management
- Reports - Generate administrative reports

**Components:**
- Sidebar - Admin navigation
- InquiryItem - Inquiry list item
- ReservationItem - Reservation list item
- TenantItem - Tenant list item
- StatCard - Metric display card

**Hooks:**
- useInquiries - Inquiry data management
- useReservations - Reservation data management
- useTenants - Tenant data management

**Services:**
- adminApi - Admin API client
- reportService - Report generation

**Routes (Protected):**
- `/admin/login` - Public login page
- `/admin/dashboard` - Protected with RequireAdmin
- `/admin/inquiries` - Protected with RequireAdmin
- `/admin/reservations` - Protected with RequireAdmin
- `/admin/room-availability` - Protected with RequireAdmin
- `/admin/tenants` - Protected with RequireAdmin
- `/admin/tenants/:id` - Protected with RequireAdmin
- `/admin/reports` - Protected with RequireAdmin

---

### 4. Super Admin (`features/super-admin/`)
**Purpose:** System-wide governance and management

**Pages:**
- Dashboard - System overview
- User Management - Manage all users
- Role & Permissions - Define access levels
- Branch Management - Manage locations
- All Tenants - View all tenants across branches
- Activity Logs - System audit trail
- System Settings - Global configurations

**Components:**
- Sidebar - Super admin navigation
- UserRow - User table row
- RoleBadge - Role display badge
- LogItem - Activity log entry

**Hooks:**
- useUsers - User data management
- useRoles - Role management
- useAuditLogs - Activity log management

**Services:**
- superAdminApi - Super admin API client
- systemService - System operations

**Routes (Protected):**
- `/super-admin/dashboard` - Protected with RequireSuperAdmin
- `/super-admin/users` - Protected with RequireSuperAdmin
- `/super-admin/roles` - Protected with RequireSuperAdmin
- `/super-admin/branches` - Protected with RequireSuperAdmin
- `/super-admin/tenants` - Protected with RequireSuperAdmin
- `/super-admin/activity-logs` - Protected with RequireSuperAdmin
- `/super-admin/settings` - Protected with RequireSuperAdmin

---

## 🔒 Authentication & Guards

### Route Protection Hierarchy

1. **RequireAuth** - Base authentication
   - Checks if user is logged in
   - Redirects to login if not authenticated
   - Used for tenant routes

2. **RequireAdmin** - Admin authentication
   - Checks if user is authenticated AND has admin role
   - Redirects to admin login if not authenticated
   - Redirects to unauthorized page if not admin
   - Used for admin routes

3. **RequireSuperAdmin** - Super admin authentication
   - Checks if user is authenticated AND has super-admin role
   - Redirects to login if not authenticated
   - Redirects to unauthorized page if not super-admin
   - Used for super-admin routes

### Implementation in App.js

```jsx
<Routes>
  {/* Public - No protection */}
  <Route path="/" element={<LandingPage />} />
  
  {/* Tenant - RequireAuth */}
  <Route element={<RequireAuth />}>
    <Route path="/tenant/dashboard" element={<TenantDashboard />} />
  </Route>
  
  {/* Admin - RequireAdmin */}
  <Route element={<RequireAdmin />}>
    <Route path="/admin/dashboard" element={<AdminDashboard />} />
  </Route>
  
  {/* Super Admin - RequireSuperAdmin */}
  <Route element={<RequireSuperAdmin />}>
    <Route path="/super-admin/dashboard" element={<SuperAdminDashboard />} />
  </Route>
</Routes>
```

---

## 📦 Shared Infrastructure

### Guards (`shared/guards/`)
Route protection components that check authentication and authorization

### API (`shared/api/`)
Centralized API clients for making HTTP requests

### Layouts (`shared/layouts/`)
Wrapper components for consistent page structure

### Hooks (`shared/hooks/`)
Reusable React hooks (e.g., useAuth)

### Components (`shared/components/`)
UI components used across multiple features

---

## 📸 Assets Organization

Images are now organized by branch:

```
assets/images/
├── gpuyat/          # Gil Puyat branch images
│   ├── IMG1.jpg
│   ├── IMG2.jpg
│   └── ...
├── guadalupe/       # Guadalupe branch images
└── landingpage/     # Landing page images
    ├── img1.jpg
    ├── img2.jpg
    └── img3.jpg
```

---

## 📝 Documentation Files

Each role has its own comprehensive documentation:

- `PUBLIC_STRUCTURE.md` - Public features documentation
- `TENANT_STRUCTURE.md` - Tenant features documentation
- `ADMIN_STRUCTURE.md` - Admin features documentation (updated)
- `SUPERADMIN_STRUCTURE.md` - Super admin features documentation

---

## 🚀 Running the Application

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

---

## 🔄 Migration Summary

### What Changed:

1. **Folder Structure**
   - Old: Flat structure with admin-pages, admin-components, public-pages mixed
   - New: Feature-based with public, tenant, admin, super-admin separation

2. **Image Imports**
   - Old: `require()` statements with old paths
   - New: ES6 imports with organized asset paths

3. **Route Organization**
   - Old: All routes in App.js without protection
   - New: Routes grouped by role with guard wrappers

4. **Code Organization**
   - Old: Components, pages, styles mixed
   - New: Each feature has pages, components, hooks, services, styles

5. **Documentation**
   - Old: No documentation
   - New: Comprehensive .md files for each role

### What Was Added:

- ✅ Tenant feature (4 pages, 4 styles)
- ✅ Admin enhancements (3 pages, 2 components, 3 hooks, 2 services, 2 styles)
- ✅ Super-admin feature (7 pages, 4 components, 3 hooks, 2 services, 4 styles)
- ✅ Shared infrastructure (guards, api, layouts, hooks, components)
- ✅ Export barrel files (index.js) for each feature
- ✅ Comprehensive documentation (4 .md files)

---

## 🎨 Styling Conventions

All styles follow a consistent naming pattern:

- **Public:** `landingpage-`, `gpuyat-`, `guadalupe-`, `room-details-`
- **Tenant:** `tenant-dashboard-`, `tenant-profile-`, etc.
- **Admin:** `admin-dashboard-`, `admin-inquiries-`, etc.
- **Super Admin:** `superadmin-dashboard-`, `superadmin-users-`, etc.

BEM methodology is used throughout:
```css
.feature-page { }                    /* Block */
.feature-page__element { }           /* Element */
.feature-page__element--modifier { } /* Modifier */
```

---

## 🔮 Future Enhancements

### Authentication Backend
- Implement JWT-based authentication
- Add session management
- Password reset functionality
- OAuth integration (Google, Facebook)

### API Integration
- Connect hooks to real backend APIs
- Implement error handling
- Add loading states
- Real-time updates with WebSockets

### Features
- Payment gateway integration
- Email notifications
- PDF report generation
- Advanced analytics dashboard
- Mobile responsive design improvements

---

## 📞 Access Points

- **Public:** Visit `/` (homepage)
- **Tenant Login:** `/tenant/login` (to be implemented)
- **Admin Login:** `/admin/login`
- **Super Admin:** Direct URL access after authentication

---

## ✅ Current Status

- ✅ Folder structure completely reorganized
- ✅ All files created and organized
- ✅ Routes updated in App.js
- ✅ Image imports fixed
- ✅ Documentation complete
- ✅ No compilation errors
- ⚠️ Backend API integration pending
- ⚠️ Authentication implementation pending
- ⚠️ Actual functionality implementation pending (currently placeholders)

---

*Last Updated: [Current Date]*
*Version: 2.0.0*
