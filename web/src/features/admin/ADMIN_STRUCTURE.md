# Admin Module Structure

This document provides a complete overview of the admin module structure, components, and functionality.

## 📁 Folder Structure

```
features/admin/
├── components/                      # Reusable admin components
│   ├── InquiryItem.jsx             # Display individual inquiry item
│   ├── ReservationItem.jsx         # Display individual reservation item
│   ├── TenantItem.jsx              # Display tenant information
│   ├── StatCard.jsx                # Statistics card component
│   └── Sidebar.jsx                 # Admin navigation sidebar
│
├── pages/                          # Admin page views
│   ├── AdminLoginPage.jsx          # Admin authentication page
│   ├── Dashboard.jsx               # Main admin dashboard
│   ├── InquiriesPage.jsx           # Inquiries management page
│   ├── ReservationsPage.jsx        # Reservations management page
│   ├── TenantsPage.jsx             # Tenants management page
│   ├── TenantDetailsPage.jsx       # Individual tenant details
│   ├── RoomAvailabilityPage.jsx    # Room availability management
│   └── ReportsPage.jsx             # Reports and analytics
│
├── hooks/                          # Custom React hooks
│   ├── useInquiries.js             # Inquiry data management
│   ├── useReservations.js          # Reservation data management
│   └── useTenants.js               # Tenant data management
│
├── services/                       # API services
│   ├── adminApi.js                 # Admin API calls
│   └── reportService.js            # Report generation
│
├── styles/                         # Admin-specific CSS files
│   ├── admin-dashboard.css         # Dashboard styles
│   ├── admin-inquiries.css         # Inquiries page styles
│   ├── admin-login.css             # Login page styles
│   ├── admin-reservations.css      # Reservations page styles
│   ├── admin-tenants.css           # Tenants page styles
│   ├── admin-reports.css           # Reports page styles
│   ├── admin-room-availability.css # Room availability styles
│   └── admin-sidebar.css           # Sidebar navigation styles
│
└── index.js                        # Export barrel for admin components
```

---

## 🔗 Admin Routes

All admin routes are prefixed with `/admin`:

| Route                      | Component            | Description                  | Access    |
| -------------------------- | -------------------- | ---------------------------- | --------- |
| `/admin/login`             | AdminLoginPage       | Authentication page          | Public    |
| `/admin/dashboard`         | Dashboard            | Main overview with stats     | Protected |
| `/admin/inquiries`         | InquiriesPage        | View and manage inquiries    | Protected |
| `/admin/reservations`      | ReservationsPage     | View and manage reservations | Protected |
| `/admin/tenants`           | TenantsPage          | View and manage tenants      | Protected |
| `/admin/tenants/:id`       | TenantDetailsPage    | View tenant details          | Protected |
| `/admin/room-availability` | RoomAvailabilityPage | Manage room availability     | Protected |
| `/admin/reports`           | ReportsPage          | Generate reports & analytics | Protected |

---

## 📄 Pages Documentation

### 1. AdminLoginPage (`/admin/login`)

**Purpose:** Authenticate admin users to access the admin panel.

**Features:**

- Username/email and password input fields
- Password visibility toggle
- Remember me option
- Login form validation
- Redirect to dashboard on successful login

**Location:** `features/admin/pages/AdminLoginPage.jsx`

**Styles:** `features/admin/styles/admin-login.css`

---

### 2. Dashboard (`/admin/dashboard`)

**Purpose:** Main admin dashboard showing overview and quick access to key metrics.

**Features:**

- **Statistics Cards:**
  - Total Inquiries
  - Total Reservations
  - Available Rooms
  - Total Revenue
- **Recent Activity:**
  - Latest reservations
  - Recent inquiries
  - Booking notifications
  - Tenant updates

- **Quick Actions:**
  - View all inquiries
  - View all reservations
  - Manage room availability
  - Generate reports

- **Data Visualization:**
  - Reservation trends
  - Occupancy rates
  - Revenue charts

**Components Used:**

- Sidebar
- ReservationItem (for recent reservations)
- InquiryItem (for recent inquiries)

**Location:** `features/admin/pages/Dashboard.jsx`

**Styles:** `features/admin/styles/admin-dashboard.css`

---

### 3. InquiriesPage (`/admin/inquiries`)

**Purpose:** Manage and respond to customer inquiries.

**Features:**

- View all inquiries in a list/table format
- Filter inquiries by:
  - Status (New, In Progress, Resolved)
  - Date range
  - Branch (Gil Puyat, Guadalupe)
- Search inquiries by name, email, or content
- Mark inquiries as read/unread
- Reply to inquiries
- Archive or delete inquiries
- Export inquiries data

**Components Used:**

- Sidebar
- InquiryItem (for each inquiry)

**Location:** `features/admin/pages/InquiriesPage.jsx`

**Styles:** `features/admin/styles/admin-inquiries.css`

---

### 4. ReservationsPage (`/admin/reservations`)

**Purpose:** Manage room reservations and bookings.

**Features:**

- View all reservations in list/calendar format
- Filter reservations by:
  - Status (Pending, Confirmed, Checked-in, Checked-out, Cancelled)
  - Room type (Private, Double, Quadruple)
  - Branch (Gil Puyat, Guadalupe)
  - Date range

- Search reservations by guest name, room number
- Approve/reject pending reservations
- Update reservation status
- View reservation details
- Export reservation reports

**Components Used:**

- Sidebar
- ReservationItem (for each reservation)

**Location:** `features/admin/pages/ReservationsPage.jsx`

**Styles:** `features/admin/styles/admin-reservations.css`

---

### 5. RoomAvailabilityPage (`/admin/room-availability`)

**Purpose:** Manage room inventory and availability.

**Features:**

- View all rooms by branch
- Update room status:
  - Available
  - Occupied
  - Under Maintenance
  - Reserved

- Set room pricing
- Block/unblock rooms for specific dates
- View occupancy calendar

**Components Used:**

- Sidebar

**Location:** `features/admin/pages/RoomAvailabilityPage.jsx`

**Styles:** `features/admin/styles/admin-room-availability.css`

---

### 6. TenantsPage (`/admin/tenants`)

**Purpose:** Manage current tenants and their contracts.

**Features:**

- View all active tenants
- Filter tenants by:
  - Branch (Gil Puyat, Guadalupe)
  - Room type
  - Payment status
  - Contract status

- Search tenants by name, room number
- View tenant details
- Access billing information
- Track contract expiration dates
- Generate tenant reports

**Components Used:**

- Sidebar
- TenantItem (for each tenant listing)
- StatCard (for tenant statistics)

**Location:** `features/admin/pages/TenantsPage.jsx`

**Styles:** `features/admin/styles/admin-tenants.css`

---

### 7. TenantDetailsPage (`/admin/tenants/:id`)

**Purpose:** View and manage individual tenant information.

**Features:**

- View complete tenant profile
- Contract details and history
- Payment history and upcoming bills
- Maintenance requests
- Notes and communications log
- Update tenant information
- Manage contract renewals
- Process payments

**Components Used:**

- Sidebar
- StatCard (for billing and payment statistics)

**Location:** `features/admin/pages/TenantDetailsPage.jsx`

**Styles:** `features/admin/styles/admin-tenants.css`

---

### 8. ReportsPage (`/admin/reports`)

**Purpose:** Generate and view various administrative reports.

**Features:**

- Financial reports:
  - Monthly revenue
  - Outstanding payments
  - Payment collections
- Occupancy reports:
  - Room occupancy rates
  - Vacancy trends
  - Reservation statistics

- Operational reports:
  - Inquiry conversion rates
  - Maintenance logs
  - Tenant turnover

- Export reports in PDF/Excel format
- Date range filtering
- Branch-specific reporting

**Components Used:**

- Sidebar
- StatCard (for report metrics)

**Location:** `features/admin/pages/ReportsPage.jsx`

**Styles:** `features/admin/styles/admin-reports.css`

- Manage room inventory
- Track maintenance schedules

**Components Used:**

- Sidebar

**Location:** `features/admin/pages/RoomAvailabilityPage.jsx`

**Styles:** `features/admin/styles/admin-room-availability.css`

---

## 🧩 Components Documentation

### 1. Sidebar

**Purpose:** Main navigation component for admin pages.

**Features:**

- Lilycrest logo
- Navigation menu with icons:
  - Dashboard
  - Inquiries (with notification badge)
  - Reservations (with notification badge)
  - Room Availability
  - Settings (future)
  - Logout

- Active route highlighting
- Responsive design (collapsible on mobile)

**Props:** None (uses React Router for navigation)

**Location:** `features/admin/components/Sidebar.jsx`

**Styles:** `features/admin/styles/admin-sidebar.css`

**Usage:**

```jsx
import Sidebar from "../components/Sidebar";

function AdminPage() {
  return (
    <div className="admin-layout">
      <Sidebar />
      <main className="admin-content">{/* Page content */}</main>
    </div>
  );
}
```

---

### 2. InquiryItem

**Purpose:** Display individual inquiry information in a card/list format.

**Props:**

- `id` - Unique inquiry identifier
- `name` - Customer name
- `email` - Customer email
- `phone` - Customer phone number
- `message` - Inquiry message
- `date` - Inquiry submission date
- `status` - Inquiry status (new, in-progress, resolved)
- `branch` - Branch inquiry is for (Gil Puyat, Guadalupe)
- `onReply` - Callback function when reply button is clicked
- `onMarkAsRead` - Callback function to mark as read

**Location:** `features/admin/components/InquiryItem.jsx`

**Usage:**

```jsx
import InquiryItem from "../components/InquiryItem";

<InquiryItem
  id={1}
  name="John Doe"
  email="john@example.com"
  message="Inquiry about double sharing room"
  date="2026-01-31"
  status="new"
  branch="gil-puyat"
  onReply={() => handleReply(1)}
/>;
```

---

### 3. ReservationItem

**Purpose:** Display individual reservation information in a card/list format.

**Props:**

- `id` - Unique reservation identifier
- `guestName` - Name of the guest
- `roomType` - Type of room (Private, Double, Quadruple)
- `roomNumber` - Room number
- `checkIn` - Check-in date
- `checkOut` - Check-out date
- `status` - Reservation status (pending, confirmed, checked-in, etc.)
- `branch` - Branch (Gil Puyat, Guadalupe)
- `totalAmount` - Total payment amount
- `onViewDetails` - Callback to view full details
- `onUpdateStatus` - Callback to update reservation status

**Location:** `features/admin/components/ReservationItem.jsx`

**Usage:**

```jsx
import ReservationItem from "../components/ReservationItem";

<ReservationItem
  id={101}
  guestName="Jane Smith"
  roomType="Private Room"
  roomNumber="201"
  checkIn="2026-02-01"
  checkOut="2026-08-01"
  status="confirmed"
  branch="gil-puyat"
  totalAmount={48000}
  onViewDetails={() => viewDetails(101)}
/>;
```

---

### 4. TenantItem

**Purpose:** Display tenant information in list format.

**Features:**

- Tenant name and room number
- Contract status and expiration date
- Payment status indicator
- Branch location
- Quick action buttons
- Click to view full details

**Props:**

- `id` - Unique tenant identifier
- `name` - Tenant name
- `roomNumber` - Assigned room number
- `roomType` - Type of room
- `branch` - Branch (Gil Puyat, Guadalupe)
- `contractStatus` - Contract status (Active, Expiring Soon, Expired)
- `contractExpiry` - Contract expiration date
- `paymentStatus` - Payment status (Paid, Pending, Overdue)
- `monthlyRent` - Monthly rent amount
- `onViewDetails` - Callback to view full tenant details

**Location:** `features/admin/components/TenantItem.jsx`

**Usage:**

```jsx
import TenantItem from "../components/TenantItem";

<TenantItem
  id={1001}
  name="John Doe"
  roomNumber="305"
  roomType="Private Room"
  branch="gil-puyat"
  contractStatus="active"
  contractExpiry="2026-12-31"
  paymentStatus="paid"
  monthlyRent={8000}
  onViewDetails={() => viewTenantDetails(1001)}
/>;
```

---

### 5. StatCard

**Purpose:** Display key statistics and metrics in a card format.

**Features:**

- Icon representation
- Metric value (number or text)
- Metric label
- Optional trend indicator (up/down)
- Color-coded based on metric type
- Optional click action

**Props:**

- `title` - Card title/label
- `value` - Metric value to display
- `icon` - Icon component or class name
- `color` - Color theme (primary, success, warning, danger)
- `trend` - Optional trend data (percentage change)
- `onClick` - Optional callback when card is clicked

**Location:** `features/admin/components/StatCard.jsx`

**Usage:**

```jsx
import StatCard from "../components/StatCard";

<StatCard
  title="Total Tenants"
  value={42}
  icon="fas fa-users"
  color="primary"
  trend={{ value: 12, direction: "up" }}
  onClick={() => navigateToTenants()}
/>;
```

---

## 🪝 Hooks Documentation

### 1. useInquiries

**Purpose:** Manage inquiry data and operations.

**Features:**

- Fetch all inquiries
- Filter inquiries by status/branch
- Reply to inquiries
- Mark inquiries as resolved
- Archive inquiries
- Real-time updates (when backend implemented)

**Returns:**

- `inquiries` - Array of inquiry objects
- `loading` - Loading state
- `error` - Error message if any
- `fetchInquiries` - Function to refresh data
- `replyToInquiry` - Function to send reply
- `updateStatus` - Function to update inquiry status

**Location:** `features/admin/hooks/useInquiries.js`

**Usage:**

```jsx
import { useInquiries } from "../hooks/useInquiries";

function InquiriesPage() {
  const { inquiries, loading, replyToInquiry } = useInquiries();

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {inquiries.map((inquiry) => (
        <InquiryItem
          key={inquiry.id}
          {...inquiry}
          onReply={(msg) => replyToInquiry(inquiry.id, msg)}
        />
      ))}
    </div>
  );
}
```

---

### 2. useReservations

**Purpose:** Manage reservation data and operations.

**Features:**

- Fetch all reservations
- Filter by status, date range, branch
- Approve/reject reservations
- Update reservation status
- Cancel reservations
- Generate reservation reports

**Returns:**

- `reservations` - Array of reservation objects
- `loading` - Loading state
- `error` - Error message if any
- `fetchReservations` - Function to refresh data
- `approveReservation` - Function to approve reservation
- `rejectReservation` - Function to reject reservation
- `updateStatus` - Function to update reservation status

**Location:** `features/admin/hooks/useReservations.js`

**Usage:**

```jsx
import { useReservations } from "../hooks/useReservations";

function ReservationsPage() {
  const { reservations, loading, approveReservation } = useReservations();

  return (
    <div>
      {reservations.map((reservation) => (
        <ReservationItem
          key={reservation.id}
          {...reservation}
          onApprove={() => approveReservation(reservation.id)}
        />
      ))}
    </div>
  );
}
```

---

### 3. useTenants

**Purpose:** Manage tenant data and operations.

**Features:**

- Fetch all tenants
- Filter by branch, payment status, contract status
- View tenant details
- Update tenant information
- Track payments and contracts
- Generate tenant reports

**Returns:**

- `tenants` - Array of tenant objects
- `loading` - Loading state
- `error` - Error message if any
- `fetchTenants` - Function to refresh data
- `getTenantById` - Function to get specific tenant
- `updateTenant` - Function to update tenant info
- `filterTenants` - Function to filter tenant list

**Location:** `features/admin/hooks/useTenants.js`

**Usage:**

```jsx
import { useTenants } from "../hooks/useTenants";

function TenantsPage() {
  const { tenants, loading, getTenantById } = useTenants();

  return (
    <div>
      {tenants.map((tenant) => (
        <TenantItem
          key={tenant.id}
          {...tenant}
          onViewDetails={() => getTenantById(tenant.id)}
        />
      ))}
    </div>
  );
}
```

---

## 🔧 Services Documentation

### 1. adminApi

**Purpose:** Centralized API service for admin operations.

**Features:**

- HTTP client configuration
- Authentication token management
- Request/response interceptors
- Error handling
- API endpoints for:
  - Inquiries CRUD
  - Reservations CRUD
  - Tenants CRUD
  - Room management
  - Dashboard statistics

**Methods:**

- `getInquiries()` - Fetch all inquiries
- `replyToInquiry(id, message)` - Send inquiry reply
- `getReservations()` - Fetch all reservations
- `updateReservationStatus(id, status)` - Update reservation
- `getTenants()` - Fetch all tenants
- `getTenantById(id)` - Get specific tenant
- `updateTenant(id, data)` - Update tenant information
- `getDashboardStats()` - Get dashboard statistics

**Location:** `features/admin/services/adminApi.js`

**Usage:**

```jsx
import adminApi from "../services/adminApi";

async function fetchData() {
  try {
    const inquiries = await adminApi.getInquiries();
    console.log(inquiries);
  } catch (error) {
    console.error("Failed to fetch inquiries:", error);
  }
}
```

---

### 2. reportService

**Purpose:** Generate and export admin reports.

**Features:**

- Financial report generation
- Occupancy report generation
- Operational metrics reports
- Export to PDF/Excel
- Date range filtering
- Branch-specific reporting

**Methods:**

- `generateFinancialReport(startDate, endDate, branch)` - Generate financial report
- `generateOccupancyReport(startDate, endDate, branch)` - Generate occupancy report
- `generateTenantReport(filters)` - Generate tenant report
- `exportToPDF(reportData)` - Export report as PDF
- `exportToExcel(reportData)` - Export report as Excel

**Location:** `features/admin/services/reportService.js`

**Usage:**

```jsx
import reportService from "../services/reportService";

async function downloadReport() {
  try {
    const report = await reportService.generateFinancialReport(
      "2026-01-01",
      "2026-01-31",
      "gil-puyat",
    );
    await reportService.exportToPDF(report);
  } catch (error) {
    console.error("Failed to generate report:", error);
  }
}
```

---

## 🎨 Styling Conventions

All admin styles follow a consistent naming pattern:

- **Prefix:** `admin-` for all admin-specific classes
- **BEM Methodology:** Block-Element-Modifier pattern
- **Color Scheme:**
  - Primary: `#FF6900` (Orange)
  - Secondary: `#1A1A1A` (Dark Gray)
  - Background: `#F5F5F5` (Light Gray)
  - Success: `#28A745` (Green)
  - Warning: `#FFC107` (Yellow)
  - Danger: `#DC3545` (Red)

**Example class names:**

```css
.admin-dashboard {
}
.admin-dashboard__header {
}
.admin-dashboard__stats {
}
.admin-dashboard__stat-card {
}
.admin-dashboard__stat-card--active {
}
```

---

## 🔐 Authentication & Access Control

### Current Implementation

- Basic login form (frontend only)
- No actual authentication backend yet

### Future Implementation Needed

- **Authentication:**
  - JWT-based authentication
  - Session management
  - Password hashing and security
  - Password reset functionality

- **Authorization:**
  - Role-based access control (Admin, Super Admin)
  - Protected routes with auth guards
  - Permission-based feature access

- **Security:**
  - HTTPS enforcement
  - CSRF protection
  - Rate limiting
  - Audit logging

---

## 📊 Data Management

### Current State

- **Static Mock Data:**
  - All data is currently hardcoded in components
  - No backend integration

### Future Backend Integration

- **API Endpoints Needed:**

  ```
  POST   /api/admin/login
  GET    /api/admin/dashboard/stats
  GET    /api/admin/inquiries
  PUT    /api/admin/inquiries/:id
  GET    /api/admin/reservations
  PUT    /api/admin/reservations/:id
  GET    /api/admin/rooms
  PUT    /api/admin/rooms/:id
  ```

- **State Management:**
  - Consider using Context API or Redux
  - Implement loading and error states
  - Add data caching for better performance

---

## 🚀 Future Enhancements

### Planned Features

1. **User Management:**
   - Add/edit/delete admin users
   - Role and permission management
   - Activity logs

2. **Reports & Analytics:**
   - Revenue reports
   - Occupancy analytics
   - Booking trends
   - Export to PDF/Excel

3. **Notifications:**
   - Real-time notifications for new inquiries
   - Reservation alerts
   - Email notifications
   - Push notifications

4. **Settings:**
   - Branch configuration
   - Pricing management
   - Email templates
   - System settings

5. **Calendar View:**
   - Visual calendar for reservations
   - Drag-and-drop booking management
   - Availability overview

6. **Communication:**
   - In-app messaging with guests
   - Email integration
   - SMS notifications

---

## 📝 Development Guidelines

### Adding a New Admin Page

1. **Create the page component:**

   ```jsx
   // features/admin/pages/NewPage.jsx
   import Sidebar from "../components/Sidebar";
   import "../styles/admin-newpage.css";

   function NewPage() {
     return (
       <div className="admin-layout">
         <Sidebar />
         <main className="admin-content">
           <h1>New Page</h1>
           {/* Content */}
         </main>
       </div>
     );
   }

   export default NewPage;
   ```

2. **Create corresponding CSS:**

   ```css
   /* features/admin/styles/admin-newpage.css */
   .admin-newpage {
     /* Styles */
   }
   ```

3. **Add route in App.js:**

   ```jsx
   import NewPage from "./features/admin/pages/NewPage";

   <Route path="/admin/newpage" element={<NewPage />} />;
   ```

4. **Update Sidebar navigation:**
   Add new menu item in `Sidebar.jsx`

5. **Export in index.js:**
   ```jsx
   export { default as NewPage } from "./pages/NewPage";
   ```

---

## 🐛 Known Issues & Warnings

1. **ESLint Warning:**
   - `renderActivityIcon` function in Dashboard.jsx is defined but not used
   - Solution: Either implement it or remove it

2. **No Backend Integration:**
   - All data is currently static
   - No real authentication
   - No data persistence

3. **Responsive Design:**
   - Some components may need mobile optimization
   - Sidebar collapse functionality needed for mobile

---

## 📞 Admin Access Information

**Development URLs:**

- Login: `http://localhost:3000/admin/login`
- Dashboard: `http://localhost:3000/admin/dashboard`
- Inquiries: `http://localhost:3000/admin/inquiries`
- Reservations: `http://localhost:3000/admin/reservations`
- Room Availability: `http://localhost:3000/admin/room-availability`

**Test Credentials (Frontend Only):**

- Username: admin@lilycrest.com
- Password: admin123

_Note: These are placeholder credentials for frontend development. Implement proper authentication before production._

---

**Last Updated:** January 31, 2026  
**Maintained By:** Development Team
