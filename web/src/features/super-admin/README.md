# Super Admin Feature Module

## Overview

This module provides system-level governance and administrative control. Super admins have access to all branches, can manage users and roles, configure system settings, and monitor system-wide activities.

## Structure

```
super-admin/
├── pages/                          # Super admin pages
│   ├── SuperAdminDashboard.jsx    # System-wide dashboard
│   ├── UserManagementPage.jsx     # Manage all users
│   ├── RolePermissionsPage.jsx    # Configure roles
│   ├── BranchManagementPage.jsx   # Manage branches
│   ├── AllTenantsPage.jsx         # View all tenants
│   ├── ActivityLogsPage.jsx       # System audit logs
│   └── SystemSettingsPage.jsx     # Global settings
│
├── components/                     # Reusable components
│   ├── Sidebar.jsx                # Super admin navigation
│   ├── UserRow.jsx                # User table row
│   ├── RoleBadge.jsx              # Role indicator badge
│   └── LogItem.jsx                # Activity log item
│
├── hooks/                          # Custom hooks
│   ├── useUsers.js                # User state management
│   ├── useRoles.js                # Role state management
│   └── useAuditLogs.js            # Audit log management
│
├── services/                       # API services
│   ├── superAdminApi.js           # Super admin API calls
│   └── systemService.js           # System utilities
│
├── styles/                         # Component styles
│   ├── superadmin-dashboard.css
│   ├── superadmin-users.css
│   ├── superadmin-settings.css
│   └── (add more styles here)
│
└── index.js                        # Feature exports
```

## Key Features

### System Dashboard

- **Global Overview**: All branches, total users, system health
- **Real-time Metrics**: Occupancy across branches, revenue trends
- **System Alerts**: Critical issues and notifications
- **Quick Stats**: Active tenants, total rooms, pending approvals

### User Management

- **View All Users**: Complete list of admins, tenants, and staff
- **Create Users**: Add new admins and assign branches
- **Edit Users**: Update user details and roles
- **Deactivate Users**: Suspend or delete user accounts
- **Role Assignment**: Assign and modify user roles

### Role & Permissions

- **Role Configuration**: Define custom roles
- **Permission Matrix**: Set granular permissions per role
- **Access Control**: Configure feature access by role
- **Default Roles**: super-admin, admin, tenant

### Branch Management

- **Branch List**: View all branches (Gpuyat, Guadalupe)
- **Add Branch**: Register new branches
- **Branch Settings**: Configure branch-specific settings
- **Admin Assignment**: Assign admins to branches
- **Branch Analytics**: Performance metrics per branch

### All Tenants View

- **Cross-Branch Tenants**: View tenants from all branches
- **Search & Filter**: Find tenants by name, branch, status
- **Tenant Overview**: Quick access to tenant details
- **Bulk Operations**: Export tenant data

### Activity Logs

- **Audit Trail**: Complete system activity log
- **User Actions**: Track who did what and when
- **Filter Logs**: By user, action type, date range
- **Export Logs**: Download for compliance/reporting

### System Settings

- **Global Configuration**: System-wide settings
- **Email Templates**: Customize notification emails
- **Payment Gateway**: Configure payment settings
- **Backup & Restore**: Database management
- **API Configuration**: Third-party integrations

## User Roles & Access

### Role: `super-admin`

**Permissions**:

- **Full System Access**: All features and data
- **User Management**: Create, edit, delete any user
- **Branch Management**: Add, edit, delete branches
- **Role Management**: Create and modify roles
- **System Settings**: Configure global settings
- **Audit Access**: View all system logs
- **Financial Access**: View all financial data
- **Emergency Actions**: Override and emergency controls

**Restrictions**:

- None - highest level of access

## Routes

Protected routes (require super-admin authentication):

- `/super-admin/dashboard` - System dashboard
- `/super-admin/users` - User management
- `/super-admin/roles` - Role & permissions
- `/super-admin/branches` - Branch management
- `/super-admin/tenants` - All tenants view
- `/super-admin/logs` - Activity logs
- `/super-admin/settings` - System settings

## Custom Hooks

### useUsers()

Manages system-wide user state:

```javascript
const { users, loading, error, setUsers } = useUsers();
```

### useRoles()

Manages role and permission state:

```javascript
const { roles, loading, error, setRoles } = useRoles();
```

### useAuditLogs()

Manages activity log state:

```javascript
const { logs, loading, error, setLogs } = useAuditLogs();
```

## API Services

### superAdminApi.js

System-level API operations:

- **User Operations**:
  - `getUsers()` - Fetch all users
  - `createUser(userData)` - Create new user
  - `updateUser(userId, userData)` - Update user
  - `deleteUser(userId)` - Delete user
- **Role Operations**:
  - `getRoles()` - Fetch all roles
  - `updateRolePermissions(roleId, permissions)` - Update permissions
- **Audit Operations**:
  - `getAuditLogs(filters)` - Fetch activity logs

### systemService.js

System utilities:

- `getSystemInfo()` - Get system status
- `updateSystemSettings(settings)` - Update global config
- `backupDatabase()` - Create database backup
- `restoreDatabase(backupFile)` - Restore from backup

## Authentication & Security

- Protected by `RequireSuperAdmin` guard component
- Highest level JWT authentication
- All actions logged in audit trail
- Two-factor authentication recommended
- IP whitelist support for extra security

## Security Best Practices

1. **Limit Super Admin Accounts**: Only create when absolutely necessary
2. **Enable 2FA**: Require two-factor authentication
3. **Regular Audits**: Review activity logs regularly
4. **Strong Passwords**: Enforce password complexity
5. **Session Timeout**: Set shorter session timeouts
6. **IP Restrictions**: Whitelist trusted IPs only

## Audit Logging

All super admin actions are logged:

- User creation/modification/deletion
- Role and permission changes
- System setting modifications
- Branch management actions
- Data exports and reports
- Login/logout activities

## Future Enhancements

- Real-time system monitoring dashboard
- Automated backup scheduling
- Multi-factor authentication
- Advanced analytics and reporting
- System performance optimization tools
- Integration with third-party services
- Mobile app for critical alerts
- Disaster recovery automation
