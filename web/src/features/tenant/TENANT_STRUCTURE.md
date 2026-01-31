# Tenant Feature Structure

This document provides a complete overview of the tenant-facing features for authenticated tenants (residents).

## 📁 Folder Structure

```
features/tenant/
├── pages/                     # Tenant page views
│   ├── TenantDashboard.jsx   # Main tenant dashboard
│   ├── ProfilePage.jsx        # Profile management
│   ├── BillingPage.jsx        # Billing and payments
│   └── ContractsPage.jsx      # Contract management
│
├── components/                # Tenant-specific components
│   └── (To be added)
│
├── styles/                    # Tenant-specific CSS files
│   ├── tenant-dashboard.css
│   ├── tenant-profile.css
│   ├── tenant-billing.css
│   └── tenant-contracts.css
│
└── index.js                   # Export barrel for tenant components
```

---

## 🔗 Tenant Routes

All tenant routes are prefixed with `/tenant` and require authentication:

| Route               | Component       | Description          | Access               |
| ------------------- | --------------- | -------------------- | -------------------- |
| `/tenant/dashboard` | TenantDashboard | Main overview        | Authenticated Tenant |
| `/tenant/profile`   | ProfilePage     | Profile management   | Authenticated Tenant |
| `/tenant/billing`   | BillingPage     | Billing and payments | Authenticated Tenant |
| `/tenant/contracts` | ContractsPage   | View contracts       | Authenticated Tenant |

---

## 📄 Pages Documentation

### 1. TenantDashboard (`/tenant/dashboard`)

**Purpose:** Main hub for tenants to view their rental information

**Planned Features:**

- Current room information
- Outstanding balance
- Recent payments
- Upcoming bill due date
- Quick actions (pay bill, view contract)
- Announcements from management
- Maintenance requests status
- Emergency contacts

**Location:** `features/tenant/pages/TenantDashboard.jsx`

**Styles:** `features/tenant/styles/tenant-dashboard.css`

---

### 2. ProfilePage (`/tenant/profile`)

**Purpose:** Manage personal information and account settings

**Planned Features:**

- Personal information (name, email, phone)
- Emergency contact information
- Password change
- Profile photo upload
- Communication preferences
- Account settings

**Location:** `features/tenant/pages/ProfilePage.jsx`

**Styles:** `features/tenant/styles/tenant-profile.css`

---

### 3. BillingPage (`/tenant/billing`)

**Purpose:** View billing history and make payments

**Planned Features:**

- Current balance display
- Billing history table
- Payment methods management
- Make payment functionality
- Download receipts/invoices
- Payment history
- Auto-pay setup
- Billing notifications

**Location:** `features/tenant/pages/BillingPage.jsx`

**Styles:** `features/tenant/styles/tenant-billing.css`

---

### 4. ContractsPage (`/tenant/contracts`)

**Purpose:** View and manage rental contracts

**Planned Features:**

- Current contract details
- Contract start/end dates
- Renewal options
- Contract history
- Download contract PDF
- Terms and conditions
- Addendums and amendments

**Location:** `features/tenant/pages/ContractsPage.jsx`

**Styles:** `features/tenant/styles/tenant-contracts.css`

---

## 🧩 Components (Planned)

### TenantSidebar

- Navigation menu for tenant dashboard
- Quick links to key features
- Profile summary

### BillingCard

- Display billing summary
- Payment status indicator
- Quick pay button

### ContractCard

- Contract summary display
- Status badge (Active, Expiring, Expired)
- Quick actions

### PaymentForm

- Payment method input
- Amount display
- Submit payment

---

## 🎨 Styling Conventions

**Prefix:** `tenant-` for all tenant-specific classes

**Color Scheme:**

- Primary: `#FF6900` (Orange)
- Secondary: `#1A1A1A` (Dark Gray)
- Success: `#28A745` (Green)
- Warning: `#FFC107` (Yellow)
- Info: `#17A2B8` (Blue)

---

## 🔐 Authentication & Access

### Current Status

- Routes need to be protected with authentication guards
- No backend integration yet

### Required Implementation

- Login system for tenants
- Session management
- Protected routes with `RequireAuth` guard
- Role verification (tenant role only)

---

## 📊 Data Management

### Data Points Needed

- Tenant profile information
- Current room assignment
- Billing records
- Payment history
- Contract documents
- Maintenance requests

### API Endpoints (To be implemented)

```
GET    /api/tenant/profile
PUT    /api/tenant/profile
GET    /api/tenant/billing
POST   /api/tenant/payment
GET    /api/tenant/contracts
GET    /api/tenant/maintenance-requests
POST   /api/tenant/maintenance-request
```

---

## 🚀 Future Enhancements

### Phase 1 (Essential)

1. **Maintenance Requests:**
   - Submit maintenance requests
   - Track request status
   - Upload photos of issues
   - Chat with maintenance staff

2. **Payments:**
   - Online payment integration
   - Multiple payment methods
   - Payment reminders
   - Receipt generation

3. **Notifications:**
   - Bill reminders
   - Maintenance updates
   - Announcements

### Phase 2 (Advanced)

1. **Community Features:**
   - Message board
   - Event calendar
   - Amenity booking
   - Neighbor directory

2. **Document Center:**
   - Store important documents
   - Move-in/move-out checklists
   - Policy documents

3. **Support:**
   - Live chat with management
   - FAQ section
   - Contact forms

---

## 📝 Development Guidelines

### Adding a New Tenant Page

1. **Create the page component:**

   ```jsx
   // features/tenant/pages/NewPage.jsx
   import "../styles/tenant-newpage.css";

   function NewPage() {
     return (
       <div className="tenant-newpage">
         <h1>New Page</h1>
         {/* Content */}
       </div>
     );
   }

   export default NewPage;
   ```

2. **Create corresponding CSS:**

   ```css
   /* features/tenant/styles/tenant-newpage.css */
   .tenant-newpage {
     /* Styles */
   }
   ```

3. **Add route in App.jsx:**

   ```jsx
   import NewPage from "./features/tenant/pages/NewPage";

   <Route
     path="/tenant/newpage"
     element={
       <RequireAuth>
         <NewPage />
       </RequireAuth>
     }
   />;
   ```

4. **Update navigation** in tenant sidebar/menu

---

## 🐛 Known Issues

1. **No Backend Integration:**
   - All pages are placeholders
   - No real data fetching
   - No authentication

2. **No Components:**
   - Need to create reusable tenant components
   - No forms yet
   - No data tables

3. **No Navigation:**
   - Need tenant-specific navigation/sidebar
   - Breadcrumbs needed

---

## 📞 Tenant Access Information

**Development URLs:**

- Dashboard: `http://localhost:3000/tenant/dashboard`
- Profile: `http://localhost:3000/tenant/profile`
- Billing: `http://localhost:3000/tenant/billing`
- Contracts: `http://localhost:3000/tenant/contracts`

**Note:** Routes will need authentication guards before production deployment.

---

**Last Updated:** January 31, 2026  
**Role:** Tenant (Authenticated Residents)  
**Status:** Under Development
