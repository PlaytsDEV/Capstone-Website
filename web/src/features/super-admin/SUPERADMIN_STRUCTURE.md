# Super Admin Feature Structure

This document provides a complete overview of the super admin module for system-level governance and management.

## 📁 Folder Structure

```
features/super-admin/
├── pages/                          # Super admin page views
│   ├── SuperAdminDashboard.jsx    # System-wide dashboard
│   ├── UserManagementPage.jsx     # User CRUD operations
│   ├── RolePermissionsPage.jsx    # Role and permission management
│   ├── BranchManagementPage.jsx   # Branch configuration
│   ├── AllTenantsPage.jsx         # Cross-branch tenant view
│   ├── ActivityLogsPage.jsx       # System audit logs
│   └── SystemSettingsPage.jsx     # Global system settings
│
├── components/                     # Super admin components
│   ├── Sidebar.jsx                # Super admin navigation
│   ├── UserRow.jsx                # User table row component
│   ├── RoleBadge.jsx              # Role display badge
│   └── LogItem.jsx                # Activity log item
│
├── hooks/                          # Custom React hooks
│   ├── useUsers.js                # User data management
│   ├── useRoles.js                # Role data management
│   └── useAuditLogs.js            # Audit log fetching
│
├── services/                       # API services
│   ├── superAdminApi.js           # Super admin API calls
│   └── systemService.js           # System operations
│
├── styles/                         # Super admin CSS files
│   ├── superadmin-dashboard.css
│   ├── superadmin-users.css
│   ├── superadmin-settings.css
│   └── superadmin-sidebar.css
│
└── index.js                        # Export barrel
```

---

## 🔗 Super Admin Routes

All super admin routes are prefixed with `/super-admin` and require super admin authentication:

| Route                    | Component            | Description        |
| ------------------------ | -------------------- | ------------------ |
| `/super-admin/dashboard` | SuperAdminDashboard  | System overview    |
| `/super-admin/users`     | UserManagementPage   | Manage all users   |
| `/super-admin/roles`     | RolePermissionsPage  | Role configuration |
| `/super-admin/branches`  | BranchManagementPage | Branch settings    |
| `/super-admin/tenants`   | AllTenantsPage       | All tenant records |
| `/super-admin/logs`      | ActivityLogsPage     | System audit trail |
| `/super-admin/settings`  | SystemSettingsPage   | Global settings    |

---

## 📄 Pages Documentation

### 1. SuperAdminDashboard (`/super-admin/dashboard`)

**Purpose:** High-level system overview across all branches

**Planned Features:**

- **System Health Metrics:**
  - Server status
  - Database connections
  - API response times
  - Error rates

- **Cross-Branch Analytics:**
  - Total tenants across all branches
  - Total revenue
  - Occupancy rates by branch
  - Pending issues/escalations

- **Quick Actions:**
  - Create new user
  - View recent activities
  - Access critical alerts

- **Charts & Reports:**
  - Revenue trends
  - Occupancy trends
  - User growth

**Location:** `features/super-admin/pages/SuperAdminDashboard.jsx`

---

### 2. UserManagementPage (`/super-admin/users`)

**Purpose:** Comprehensive user account management

**Planned Features:**

- **User Table:**
  - List all system users (admins, tenants, super admins)
  - Search and filter capabilities
  - Sort by name, role, status, branch

- **User Operations:**
  - Create new users
  - Edit user details
  - Assign/change roles
  - Activate/deactivate accounts
  - Delete users
  - Reset passwords

- **Bulk Operations:**
  - Import users from CSV
  - Export user list
  - Bulk role assignment

**Location:** `features/super-admin/pages/UserManagementPage.jsx`

---

### 3. RolePermissionsPage (`/super-admin/roles`)

**Purpose:** Configure system roles and their permissions

**Planned Features:**

- **Role Management:**
  - Create custom roles
  - Edit role permissions
  - Delete roles (if not in use)

- **Permission Matrix:**
  - View all permissions by role
  - Granular permission control
  - Module-level access control

- **Default Roles:**
  - Super Admin (full access)
  - Admin (branch-level access)
  - Tenant (limited self-service)

**Permissions Examples:**

```javascript
{
  users: {
    create: true,
    read: true,
    update: true,
    delete: true
  },
  tenants: {
    create: true,
    read: true,
    update: true,
    delete: false
  },
  // ... more modules
}
```

**Location:** `features/super-admin/pages/RolePermissionsPage.jsx`

---

### 4. BranchManagementPage (`/super-admin/branches`)

**Purpose:** Configure and manage all branches

**Planned Features:**

- **Branch Configuration:**
  - Branch details (name, address, contact)
  - Operating hours
  - Capacity limits
  - Pricing configurations

- **Branch Operations:**
  - Add new branches
  - Edit branch information
  - Activate/deactivate branches
  - Assign branch managers

- **Branch Analytics:**
  - Performance metrics per branch
  - Comparison dashboard
  - Revenue by branch

**Current Branches:**

- Gil Puyat
- Guadalupe

**Location:** `features/super-admin/pages/BranchManagementPage.jsx`

---

### 5. AllTenantsPage (`/super-admin/tenants`)

**Purpose:** View all tenants across all branches

**Planned Features:**

- **Tenant Directory:**
  - Comprehensive tenant list
  - Filter by branch, status, payment status
  - Search by name, email, room number

- **Tenant Details:**
  - View full tenant profiles
  - Contract information
  - Payment history
  - Maintenance requests

- **Tenant Operations:**
  - Transfer tenants between rooms/branches
  - Update tenant information
  - View tenant communications

**Location:** `features/super-admin/pages/AllTenantsPage.jsx`

---

### 6. ActivityLogsPage (`/super-admin/logs`)

**Purpose:** System-wide audit trail and activity monitoring

**Planned Features:**

- **Activity Log Table:**
  - All system activities
  - User actions with timestamps
  - IP addresses and device info
  - Success/failure indicators

- **Log Filtering:**
  - Filter by date range
  - Filter by user
  - Filter by action type
  - Filter by module

- **Log Export:**
  - Export logs to CSV
  - Generate compliance reports

**Log Types:**

- User login/logout
- Data modifications
- Permission changes
- Failed login attempts
- Critical system events

**Location:** `features/super-admin/pages/ActivityLogsPage.jsx`

---

### 7. SystemSettingsPage (`/super-admin/settings`)

**Purpose:** Global system configuration

**Planned Features:**

- **General Settings:**
  - Company information
  - Contact details
  - Business hours

- **Email Configuration:**
  - SMTP settings
  - Email templates
  - Notification preferences

- **Security Settings:**
  - Password policies
  - Session timeout
  - Two-factor authentication
  - IP whitelisting

- **System Maintenance:**
  - Backup/restore
  - Database optimization
  - Cache clearing

- **Integration Settings:**
  - Payment gateway configuration
  - SMS provider settings
  - Third-party API keys

**Location:** `features/super-admin/pages/SystemSettingsPage.jsx`

---

## 🧩 Components Documentation

### Sidebar

**Purpose:** Navigation menu for super admin pages

**Features:**

- Logo/branding
- Navigation links with icons
- Active state highlighting
- Logout option

**Location:** `features/super-admin/components/Sidebar.jsx`

---

### UserRow

**Purpose:** Table row component for user listings

**Props:**

- `user` - User object with name, email, role, status

**Location:** `features/super-admin/components/UserRow.jsx`

---

### RoleBadge

**Purpose:** Visual indicator for user roles

**Props:**

- `role` - Role name (admin, super-admin, tenant)

**Styling:** Color-coded based on role

**Location:** `features/super-admin/components/RoleBadge.jsx`

---

### LogItem

**Purpose:** Display activity log entry

**Props:**

- `log` - Log object with timestamp, user, action

**Location:** `features/super-admin/components/LogItem.jsx`

---

## 🔧 Hooks Documentation

### useUsers()

**Purpose:** Fetch and manage user data

**Returns:**

- `users` - Array of user objects
- `loading` - Loading state

**Location:** `features/super-admin/hooks/useUsers.js`

---

### useRoles()

**Purpose:** Fetch and manage role data

**Returns:**

- `roles` - Array of role objects
- `loading` - Loading state

**Location:** `features/super-admin/hooks/useRoles.js`

---

### useAuditLogs()

**Purpose:** Fetch audit log data

**Returns:**

- `logs` - Array of log entries
- `loading` - Loading state

**Location:** `features/super-admin/hooks/useAuditLogs.js`

---

## 🌐 Services Documentation

### superAdminApi.js

**Purpose:** API calls for super admin operations

**Methods:**

- `getUsers()` - Fetch all users
- `createUser(data)` - Create new user
- `updateUser(id, data)` - Update user
- `deleteUser(id)` - Delete user
- `getRoles()` - Fetch all roles
- `updateRole(id, permissions)` - Update role permissions
- `getBranches()` - Fetch all branches
- `updateBranch(id, data)` - Update branch
- `getAuditLogs(filters)` - Fetch audit logs

**Location:** `features/super-admin/services/superAdminApi.js`

---

### systemService.js

**Purpose:** System-level operations

**Methods:**

- `getSystemStatus()` - Get system health status
- `updateSystemSettings(settings)` - Update global settings
- `performBackup()` - Trigger system backup
- `restoreBackup(backupId)` - Restore from backup

**Location:** `features/super-admin/services/systemService.js`

---

## 🎨 Styling Conventions

**Prefix:** `superadmin-` for all super admin classes

**Color Scheme:**

- Primary: `#6C35C4` (Purple - denotes highest authority)
- Secondary: `#1A1A1A` (Dark Gray)
- Success: `#28A745` (Green)
- Warning: `#FFC107` (Yellow)
- Danger: `#DC3545` (Red)

---

## 🔐 Security & Access Control

### Access Requirements

- Must be authenticated
- Must have `super-admin` role
- Protected with `RequireSuperAdmin` guard

### Security Measures

- All actions logged in audit trail
- Sensitive operations require confirmation
- Rate limiting on critical endpoints
- IP tracking for all activities

---

## 🚀 Future Enhancements

### Phase 1

1. **Advanced Analytics:**
   - Custom report builder
   - Data visualization dashboard
   - Predictive analytics

2. **Automated Workflows:**
   - Scheduled tasks
   - Automated backups
   - Alert triggers

### Phase 2

1. **Multi-tenancy Support:**
   - Support for multiple companies
   - Isolated data per organization

2. **Advanced Security:**
   - Two-factor authentication
   - Biometric authentication
   - Advanced threat detection

---

## 📞 Super Admin Access

**Development URLs:**

- Dashboard: `http://localhost:3000/super-admin/dashboard`
- Users: `http://localhost:3000/super-admin/users`
- Roles: `http://localhost:3000/super-admin/roles`
- Branches: `http://localhost:3000/super-admin/branches`
- Tenants: `http://localhost:3000/super-admin/tenants`
- Logs: `http://localhost:3000/super-admin/logs`
- Settings: `http://localhost:3000/super-admin/settings`

---

**Last Updated:** January 31, 2026  
**Role:** Super Admin (System-Level Governance)  
**Status:** Under Development
