# Admin Feature Module

## Overview

This module provides branch-level administrative functionality. Admins can manage inquiries, reservations, tenants, room availability, and generate reports for their assigned branch.

## Structure

```
admin/
├── pages/                        # Admin pages
│   ├── AdminLoginPage.jsx       # Admin authentication
│   ├── Dashboard.jsx            # Admin dashboard
│   ├── InquiriesPage.jsx        # Manage inquiries
│   ├── ReservationsPage.jsx     # Manage reservations
│   ├── TenantsPage.jsx          # Tenant management
│   ├── TenantDetailsPage.jsx    # Individual tenant details
│   ├── RoomAvailabilityPage.jsx # Room status management
│   └── ReportsPage.jsx          # Generate reports
│
├── components/                  # Reusable admin components
│   ├── Sidebar.jsx             # Admin navigation sidebar
│   ├── InquiryItem.jsx         # Inquiry list item
│   ├── ReservationItem.jsx     # Reservation list item
│   ├── TenantItem.jsx          # Tenant list item
│   ├── RoomCard.jsx            # Room status card
│   └── StatCard.jsx            # Dashboard statistics card
│
├── hooks/                       # Custom hooks
│   ├── useInquiries.js         # Inquiry state management
│   ├── useReservations.js      # Reservation state management
│   └── useTenants.js           # Tenant state management
│
├── services/                    # API services
│   ├── adminApi.js             # Admin API calls
│   └── reportService.js        # Report generation
│
├── styles/                      # Component styles
│   ├── admin-dashboard.css
│   ├── admin-inquiries.css
│   ├── admin-reservations.css
│   ├── admin-room-availability.css
│   ├── admin-sidebar.css
│   └── (add more styles here)
│
└── index.js                     # Feature exports
```

## Key Features

### Dashboard

- **Overview Statistics**: Total tenants, occupancy rate, pending inquiries
- **Quick Actions**: Recent activities and alerts
- **Financial Summary**: Monthly revenue and outstanding payments

### Inquiry Management

- **View Inquiries**: List all inquiries for the branch
- **Respond**: Reply to inquiries via email
- **Update Status**: Mark as new, in-progress, resolved, or closed
- **Filter & Search**: Find specific inquiries

### Reservation Management

- **Pending Reservations**: Review and approve/reject reservations
- **Active Reservations**: Monitor confirmed reservations
- **History**: View past reservations
- **Room Assignment**: Assign rooms to approved reservations

### Tenant Management

- **Tenant List**: View all tenants in the branch
- **Tenant Details**: Access detailed tenant information
- **Contract Management**: View and manage rental contracts
- **Payment Tracking**: Monitor payment status
- **Move-in/Move-out**: Process tenant transitions

### Room Availability

- **Room Status**: View real-time room availability
- **Maintenance Mode**: Mark rooms under maintenance
- **Pricing**: Update room rates
- **Capacity**: Manage room occupancy

### Reports

- **Monthly Reports**: Revenue, occupancy, and expenses
- **Tenant Reports**: Move-ins, move-outs, and retention
- **Financial Reports**: Payment collection and arrears
- **Export**: PDF and Excel export options

## User Roles & Access

### Role: `admin`

**Permissions**:

- Full access to assigned branch data
- Manage inquiries and reservations
- Manage tenants and contracts
- Update room availability
- Generate branch reports
- View financial data for the branch

**Restrictions**:

- Cannot access other branches' data
- Cannot manage system users
- Cannot modify global settings
- Cannot access super admin features

## Routes

Protected routes (require admin authentication):

- `/admin/dashboard` - Admin dashboard
- `/admin/inquiries` - Inquiry management
- `/admin/reservations` - Reservation management
- `/admin/tenants` - Tenant list
- `/admin/tenants/:id` - Tenant details
- `/admin/rooms` - Room availability
- `/admin/reports` - Report generation

Public routes:

- `/admin/login` - Admin login page

## Custom Hooks

### useInquiries()

Manages inquiry state and operations:

```javascript
const { inquiries, loading, error, setInquiries } = useInquiries();
```

### useReservations()

Manages reservation state and operations:

```javascript
const { reservations, loading, error, setReservations } = useReservations();
```

### useTenants()

Manages tenant state and operations:

```javascript
const { tenants, loading, error, setTenants } = useTenants();
```

## API Services

### adminApi.js

Centralized admin API calls:

- `getInquiries()` - Fetch inquiries
- `getReservations()` - Fetch reservations
- `getTenants()` - Fetch tenants
- Additional CRUD operations

### reportService.js

Report generation utilities:

- `generateMonthlyReport(branchId, month, year)`
- `exportToPDF(reportData)`
- `exportToExcel(reportData)`

## Authentication & Security

- Protected by `RequireAdmin` guard component
- JWT-based authentication
- Branch-scoped data access
- Audit logging for admin actions

## Future Enhancements

- Automated rent collection
- SMS/Email notifications
- Tenant communication portal
- Maintenance request tracking
- Advanced analytics dashboard
- Multi-branch comparison reports
- Automated late payment reminders
