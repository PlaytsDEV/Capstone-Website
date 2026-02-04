# Web Folder Structure

Final organized structure for the Lilycrest Web application.

```
web/
├── .env
├── .gitignore
├── README.md
├── package.json
├── package-lock.json
│
├── build/                 # production build (auto-generated)
├── node_modules/
├── public/                # static HTML config
│   ├── index.html
│   ├── manifest.json
│   └── robots.txt
│
└── src/
    ├── index.js
    ├── index.css
    ├── App.js
    ├── App.css
    ├── App.test.js
    ├── reportWebVitals.js
    ├── setupTests.js
    │
    ├── assets/                 # static assets
    │   └── images/
    │       ├── branches/       # branch-specific images
    │       │   └── gil-puyat/  # Gil Puyat branch images
    │       │       ├── deluxe-room.jpg
    │       │       ├── gallery1.jpg
    │       │       ├── gil-puyat-branch.jpg
    │       │       ├── location-map.jpg
    │       │       ├── location-view.jpg
    │       │       ├── premium-room.jpg
    │       │       └── standard-room.jpg
    │       └── branding/       # logo, landing images
    │           ├── gil-puyat-branch.png
    │           ├── guadalupe-branch.png
    │           └── logo.png
    │
    ├── firebase/
    │   └── config.js           # firebase initialization
    │
    ├── features/               # ROLE-BASED FEATURES (MAIN APP)
    │   ├── admin/              # admin management
    │   │   ├── index.js
    │   │   ├── components/
    │   │   │   ├── InquiryDetailsModal.jsx
    │   │   │   ├── InquiryItem.jsx
    │   │   │   ├── ReservationDetailsModal.jsx
    │   │   │   ├── ReservationItem.jsx
    │   │   │   ├── RoomCard.jsx
    │   │   │   ├── Sidebar.jsx
    │   │   │   ├── StatCard.jsx
    │   │   │   ├── TenantDetailModal.jsx
    │   │   │   └── TenantItem.jsx
    │   │   ├── hooks/
    │   │   │   ├── useInquiries.js
    │   │   │   ├── useReservations.js
    │   │   │   └── useTenants.js
    │   │   ├── pages/
    │   │   │   ├── AdminLoginPage.jsx
    │   │   │   ├── Dashboard.jsx
    │   │   │   ├── InquiriesPage.jsx
    │   │   │   ├── ReservationsPage.jsx
    │   │   │   ├── RoomAvailabilityPage.jsx
    │   │   │   └── TenantsPage.jsx
    │   │   ├── services/
    │   │   │   ├── adminApi.js
    │   │   │   └── reportService.js
    │   │   └── styles/
    │   │       ├── admin-dashboard.css
    │   │       ├── admin-inquiries.css
    │   │       ├── admin-login.css
    │   │       ├── admin-reservations.css
    │   │       ├── admin-room-availability.css
    │   │       ├── admin-sidebar.css
    │   │       ├── admin-tenants.css
    │   │       ├── inquiry-details-modal.css
    │   │       ├── reservation-details-modal.css
    │   │       └── tenant-detail-modal.css
    │   │
    │   ├── public/             # landing pages, room info, inquiries
    │   │   ├── index.js
    │   │   ├── components/
    │   │   │   ├── Footer.jsx
    │   │   │   ├── Navbar.js
    │   │   │   └── RoomDetailsPage.jsx
    │   │   ├── modals/
    │   │   │   └── InquiryModal.jsx
    │   │   ├── pages/
    │   │   │   ├── DoubleSharingPage.jsx
    │   │   │   ├── FAQsPage.jsx
    │   │   │   ├── GPuyatPage.jsx
    │   │   │   ├── GPuyatRoomsPage.jsx
    │   │   │   ├── GuadalupePage.jsx
    │   │   │   ├── GuadalupeRoomsPage.jsx
    │   │   │   ├── LandingPage.jsx
    │   │   │   ├── PrivateRoomPage.jsx
    │   │   │   ├── QuadrupleSharingPage.jsx
    │   │   │   └── SignIn.jsx
    │   │   └── styles/
    │   │       ├── faqs.css
    │   │       ├── gpuyat-rooms.css
    │   │       ├── gpuyat.css
    │   │       ├── guadalupe-rooms.css
    │   │       ├── guadalupe.css
    │   │       ├── inquirymodal.css
    │   │       ├── landingpage.css
    │   │       ├── room-details.css
    │   │       ├── tenant-signin.css
    │   │       └── tenant-signup.css
    │   │
    │   ├── super-admin/        # system-level management
    │   │   ├── index.js
    │   │   ├── components/
    │   │   │   ├── LogItem.jsx
    │   │   │   ├── RoleBadge.jsx
    │   │   │   ├── Sidebar.jsx
    │   │   │   └── UserRow.jsx
    │   │   ├── hooks/
    │   │   │   ├── useAuditLogs.js
    │   │   │   ├── useRoles.js
    │   │   │   └── useUsers.js
    │   │   ├── pages/
    │   │   │   ├── ActivityLogsPage.jsx
    │   │   │   ├── AllTenantsPage.jsx
    │   │   │   ├── BranchManagementPage.jsx
    │   │   │   ├── RolePermissionsPage.jsx
    │   │   │   ├── SuperAdminDashboard.jsx
    │   │   │   ├── SystemSettingsPage.jsx
    │   │   │   └── UserManagementPage.jsx
    │   │   ├── services/
    │   │   │   ├── superAdminApi.js
    │   │   │   └── systemService.js
    │   │   └── styles/
    │   │       ├── superadmin-branches.css
    │   │       ├── superadmin-dashboard.css
    │   │       ├── superadmin-settings.css
    │   │       ├── superadmin-sidebar.css
    │   │       └── superadmin-users.css
    │   │
    │   └── tenant/             # tenant dashboard, billing, profile
    │       ├── index.js
    │       ├── modals/
    │       │   ├── BranchSelectionModal.css
    │       │   ├── BranchSelectionModal.jsx
    │       │   ├── TermsModal.css
    │       │   └── TermsModal.jsx
    │       ├── pages/
    │       │   ├── BillingPage.jsx
    │       │   ├── BranchSelection.css
    │       │   ├── BranchSelection.jsx
    │       │   ├── ContractsPage.jsx
    │       │   ├── ForgotPassword.css
    │       │   ├── ForgotPassword.jsx
    │       │   ├── ProfilePage.jsx
    │       │   ├── SignIn.jsx
    │       │   ├── SignUp.jsx
    │       │   └── TenantDashboard.jsx
    │       └── styles/
    │           ├── tenant-dashboard.css
    │           ├── tenant-signin.css
    │           └── tenant-signup.css
    │
    ├── shared/                 # REUSABLE / GLOBAL
    │   ├── api/                # API calls
    │   │   ├── apiClient.js
    │   │   ├── authApi.js
    │   │   ├── commonApi.js
    │   │   └── tenantApi.js
    │   ├── components/         # Navbar, Footer, loaders
    │   │   ├── Footer.jsx
    │   │   ├── GlobalLoading.css
    │   │   ├── GlobalLoading.jsx
    │   │   ├── LilycrestLogo.js
    │   │   ├── LoadingSpinner.jsx
    │   │   ├── Navbar.js
    │   │   ├── ProtectedRoute.jsx
    │   │   └── ScrollToTop.jsx
    │   ├── guards/             # role-based route protection
    │   │   ├── RequireAdmin.jsx
    │   │   ├── RequireAuth.jsx
    │   │   ├── RequireNonAdmin.jsx
    │   │   └── RequireSuperAdmin.jsx
    │   ├── hooks/              # auth & shared hooks
    │   │   ├── FirebaseAuthContext.js
    │   │   └── useAuth.js
    │   ├── layouts/            # page layouts per role
    │   │   ├── AdminLayout.jsx
    │   │   ├── PublicLayout.jsx
    │   │   ├── SuperAdminLayout.jsx
    │   │   ├── TenantLayout.css
    │   │   └── TenantLayout.jsx
    │   ├── styles/             # shared CSS
    │   │   └── notification.css
    │   └── utils/              # helpers & formatters
    │       ├── auth.js
    │       ├── constants.js
    │       ├── currency.js
    │       ├── formatDate.js
    │       └── notification.js
    │
    ├── legacy/                 # kept to avoid breaking imports
    │   ├── README.md
    │   └── components/
    │       └── Footer.jsx
    │
    └── tests/                  # test files
        └── .gitkeep
```

## Structure Overview

### `assets/images/`

- **branches/**: Branch-specific images (room photos, location maps)
- **branding/**: Logo and promotional images

### `features/`

Role-based feature modules:

- **admin/**: Admin dashboard and management
- **public/**: Public-facing pages (landing, branches, rooms)
- **super-admin/**: System administration
- **tenant/**: Tenant portal

### `shared/`

Reusable components and utilities:

- **api/**: API client and endpoint functions
- **components/**: Common UI components
- **guards/**: Route protection components
- **hooks/**: Custom React hooks
- **layouts/**: Page layout wrappers
- **styles/**: Global CSS
- **utils/**: Helper functions

### `legacy/`

Old files kept for backwards compatibility during migration.

### `tests/`

Test files location.
