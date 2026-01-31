# Tenant Feature Module

## Overview

This module provides authenticated tenant functionality including dashboard, profile management, billing, and contract viewing. Tenants can manage their rental information and track payments.

## Structure

```
tenant/
├── pages/                      # Tenant pages
│   ├── SignIn.jsx             # Tenant login
│   ├── SignUp.jsx             # Tenant registration
│   ├── TenantDashboard.jsx    # Main dashboard
│   ├── ProfilePage.jsx        # Profile management
│   ├── BillingPage.jsx        # Billing & payments
│   └── ContractsPage.jsx      # Rental contracts
│
├── components/                # Tenant-specific components
│   └── (add components here)
│
└── styles/                    # Component styles
    ├── tenant-signin.css
    ├── tenant-signup.css
    └── (add more styles here)
```

## Key Features

### Authentication

- **SignIn**: Secure login for existing tenants
- **SignUp**: Registration for new tenants

### Dashboard

- **TenantDashboard**: Overview of rental status, upcoming payments, and announcements
- Quick access to profile, billing, and contracts

### Profile Management

- **ProfilePage**: Update personal information and contact details
- Change password and notification preferences

### Billing & Payments

- **BillingPage**: View payment history and outstanding balances
- Make online payments and download receipts

### Contracts

- **ContractsPage**: Access rental agreements and contract details
- Download contract PDFs

## User Roles & Access

### Role: `tenant`

**Permissions**:

- View own dashboard
- Manage own profile
- View billing information
- Access rental contracts
- Submit maintenance requests

**Restrictions**:

- Cannot access other tenants' data
- Cannot modify room assignments
- Cannot access admin features

## Routes

Protected routes (require authentication):

- `/tenant/dashboard` - Tenant dashboard
- `/tenant/profile` - Profile management
- `/tenant/billing` - Billing information
- `/tenant/contracts` - Rental contracts

Public routes:

- `/tenant/signin` - Login page
- `/tenant/signup` - Registration page

## Authentication Flow

1. Tenant navigates to `/tenant/signin`
2. Enters credentials (email/password)
3. System validates credentials via `authApi.login()`
4. On success, redirect to `/tenant/dashboard`
5. Auth token stored for subsequent requests

## State Management

Uses custom hooks from `/shared/hooks`:

- `useAuth()` - Authentication state and methods
- Additional tenant-specific hooks can be added in `tenant/hooks/`

## API Integration

Consumes endpoints from:

- `/shared/api/authApi.js` - Authentication
- `/shared/api/tenantApi.js` - Tenant-specific operations

## Security

- All routes protected by `RequireAuth` guard
- JWT tokens for API authentication
- Password encryption
- Role-based access control

## Future Enhancements

- Maintenance request submission
- Document upload for verification
- In-app messaging with admin
- Payment reminders and notifications
- Contract renewal workflow
