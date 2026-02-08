# LilyCrest API Migration: From Static Data to Scalable, Branch-Aware Architecture

## Overview

This document describes the migration from hardcoded/static data to a fully functional, scalable, branch-aware API-driven architecture. The new system is designed to support multi-branch operations and provide real-time data for advanced features like AI forecasting.

---

## 🎯 Architecture Changes

### Before: Static Data Model

- Frontend pages used hardcoded state with `useState` for all data
- No API integration for billing, announcements, or maintenance
- Data was not persisted or shared across sessions
- No multi-branch isolation
- Impossible to track metrics for forecasting

### After: API-Driven, Branch-Aware Model

```
Frontend (React) → API Client (authFetch) → Express Server → MongoDB (Branch-Isolated)
```

**Key Features:**

- ✅ Real-time data from MongoDB
- ✅ Automatic branch isolation (data filtered by user's branch)
- ✅ Engagement tracking for AI features
- ✅ Predictive analytics queries built into models
- ✅ Scalable across unlimited branches
- ✅ Complete audit trail for all operations

---

## 📦 New Data Models

### 1. **Bill Model** (`server/models/Bill.js`)

Stores billing/invoice records with branch isolation and forecasting capability.

**Key Fields:**

```javascript
{
  // Branch Isolation
  branch: "gil-puyat" | "guadalupe",

  // References
  reservationId, userId,

  // Billing Data
  billingMonth, dueDate,
  charges: { rent, electricity, water, applianceFees, corkageFees, penalty, discount },
  totalAmount, paidAmount,

  // Status
  status: "pending" | "paid" | "overdue" | "partially-paid",
  paymentDate
}
```

**Forecasting Methods:**

- `getMonthlyRevenueByBranch(branch, months)` - Revenue trends by month
- `getPaymentStats(branch)` - Payment status distribution
- Optimal for predicting cash flow, payment delays, default risks

---

### 2. **Announcement Model** (`server/models/Announcement.js`)

System announcements with engagement tracking and multi-branch targeting.

**Key Fields:**

```javascript
{
  // Content
  title, content, category,

  // Targeting
  targetBranch: "both" | "gil-puyat" | "guadalupe",
  visibility: "public" | "tenants-only" | "staff-only",

  // Engagement Metrics (for AI)
  viewCount, acknowledgmentCount,

  // Publication
  publishedBy, publishedAt, isPinned
}
```

**Forecasting Methods:**

- `getEngagementStats(branch)` - Content performance metrics
- `getUnacknowledgedForUser(userId, branch)` - User engagement patterns
- Optimal for personalizing content, predicting engagement, optimizing delivery times

---

### 3. **MaintenanceRequest Model** (`server/models/MaintenanceRequest.js`)

Maintenance request tracking with predictive maintenance capability.

**Key Fields:**

```javascript
{
  // Branch Isolation
  branch, reservationId, userId,

  // Issue Details
  category: "plumbing" | "electrical" | "hardware" | "appliance" | "cleaning" | "other",
  title, description, urgency,

  // Status
  status: "pending" | "in-progress" | "on-hold" | "completed" | "cancelled",

  // Resolution Timeline
  createdAt, completedAt, resolvedAt,
  assignedTo, completionNote
}
```

**Forecasting Methods:**

- `getCompletionStats(branch, days)` - Average resolution time by category
- `getIssueFrequency(branch, limit, monthsBack)` - Issue patterns for predictive maintenance
- Optimal for maintenance scheduling, budgeting, preventive maintenance planning

---

### 4. **AcknowledgmentAccount Model** (`server/models/AcknowledgmentAccount.js`)

Tracks user engagement with announcements.

**Key Fields:**

```javascript
{
  (userId,
    announcementId,
    isRead,
    readAt,
    isAcknowledged,
    acknowledgedAt,
    createdAt);
}
```

**Forecasting Methods:**

- `getUserEngagementStats(userId, days)` - Individual engagement patterns
- `getEngagementMetrics(announcementId)` - Content-level metrics
- Optimal for behavioral analytics, personalization, notification timing optimization

---

## 🔌 New API Endpoints

### Billing Routes (`/api/billing/`)

```
GET    /api/billing/current              - Get current month's bill
GET    /api/billing/history?limit=50     - Get payment history
GET    /api/billing/stats                - Get branch statistics (admin)
POST   /api/billing/:billId/mark-paid    - Mark bill as paid (admin)
```

### Announcements Routes (`/api/announcements/`)

```
GET    /api/announcements?limit=50&category=reminder         - Get announcements
GET    /api/announcements/unacknowledged                      - Get unacknowledged
POST   /api/announcements/:announcementId/read                - Mark as read
POST   /api/announcements/:announcementId/acknowledge         - Acknowledge
GET    /api/announcements/user/engagement-stats              - User engagement
POST   /api/announcements                                       - Create (admin)
```

### Maintenance Routes (`/api/maintenance/`)

```
GET    /api/maintenance/my-requests?limit=50&status=pending  - Get tenant's requests
GET    /api/maintenance/branch?limit=50                       - Get all by branch (admin)
POST   /api/maintenance/requests                              - Create request
GET    /api/maintenance/requests/:requestId                   - Get details
PATCH  /api/maintenance/requests/:requestId                   - Update status (admin)
GET    /api/maintenance/stats/completion                      - Completion stats (admin)
GET    /api/maintenance/stats/issue-frequency                 - Issue frequency (admin)
```

---

## 🔐 Branch Isolation Strategy

### Automatic Branch Assignment

```javascript
// All API endpoints automatically filter by req.user.branch
const userId = req.user.uid;
const { branch } = req.user; // Set during authentication

// Query always includes branch
const bills = await Bill.find({ userId, branch });
```

### Multi-Tenant Queries

```javascript
// Admin queries can see stats by branch
const stats = await Bill.getPaymentStats("gil-puyat");

// Queries automatically aggregate by branch
const revenue = await Bill.getMonthlyRevenueByBranch("guadalupe", 12);
```

### Benefits

- ✅ No accidental data leakage between branches
- ✅ Scalable to unlimited branches
- ✅ Each branch has independent analytics
- ✅ Easy permission system (admin can see their branch only)

---

## 🚀 Updated Frontend Components

### 1. **BillingPage.jsx**

```javascript
// Before: useState with hardcoded data
const [billingData] = useState({ currentBalance: 8500, ... });

// After: useEffect with API call
useEffect(() => {
  loadBillingData();
}, []);

const loadBillingData = async () => {
  const current = await billingApi.getCurrentBilling();
  const history = await billingApi.getHistory(50);
  setBillingData(current);
  setPaymentHistory(history.bills);
};
```

### 2. **AnnouncementsPage.jsx**

```javascript
// Before: Static state
const [announcements, setAnnouncements] = useState([...]);

// After: API-driven with engagement tracking
useEffect(() => {
  loadAnnouncements();
}, []);

const handleAcknowledge = async (id) => {
  await announcementApi.acknowledge(id);
  setAcknowledged((prev) => new Set(prev).add(id));
};
```

### 3. **MaintenancePage.jsx**

```javascript
// Before: Static requests
const [requests] = useState([...]);

// After: Dynamic with form submission
const handleSubmitRequest = async (e) => {
  await maintenanceApi.createRequest(formData);
  await loadRequests();  // Refresh list
};
```

### 4. **DashboardPage.jsx**

```javascript
// Now loads announcements from API for preview
const loadDashboardData = async () => {
  const announcementData = await announcementApi.getAll(5);
  setAnnouncements(announcementData.announcements);
  // ... other data
};
```

---

## 📊 API Client Methods

Added to `web/src/shared/api/apiClient.js`:

```javascript
// Billing
export const billingApi = {
  getCurrentBilling: () => authFetch("/billing/current"),
  getHistory: (limit) => authFetch(`/billing/history?limit=${limit}`),
  getStats: () => authFetch("/billing/stats"),
  markAsPaid: (billId, amount, note) => {
    /* ... */
  },
};

// Announcements
export const announcementApi = {
  getAll: (limit, category) => {
    /* ... */
  },
  getUnacknowledged: () => {
    /* ... */
  },
  markAsRead: (announcementId) => {
    /* ... */
  },
  acknowledge: (announcementId) => {
    /* ... */
  },
  getUserEngagementStats: (days) => {
    /* ... */
  },
};

// Maintenance
export const maintenanceApi = {
  getMyRequests: (limit, status) => {
    /* ... */
  },
  getByBranch: (limit, status, category) => {
    /* ... */
  },
  createRequest: (requestData) => {
    /* ... */
  },
  getRequest: (requestId) => {
    /* ... */
  },
  updateRequest: (requestId, status, note) => {
    /* ... */
  },
  getCompletionStats: (days) => {
    /* ... */
  },
  getIssueFrequency: (limit, months) => {
    /* ... */
  },
};
```

---

## 🌱 Test Data Seeding

Run the seed script to populate test data:

```bash
node server/scripts/seed-tenant-data.js
```

This creates:

- Bills for all active tenants (3 months of history)
- Announcements across both branches
- Acknowledgment records for tracked announcements
- Maintenance requests with various statuses

---

## 🤖 Ready for AI Features

### Forecasting Capabilities

**1. Financial Forecasting**

```javascript
// Revenue trends
const revenue = await Bill.getMonthlyRevenueByBranch("gil-puyat", 12);
// Output: [ {_id: "2025-02", totalRevenue: 125000, billCount: 25}, ... ]

// Payment stats
const stats = await Bill.getPaymentStats("guadalupe");
// Output: Payment status distribution for budget planning
```

**2. Predictive Maintenance**

```javascript
// Issue frequency patterns
const issues = await MaintenanceRequest.getIssueFrequency("gil-puyat", 12, 6);
// Predict: plumbing issues spike after rainy season, etc.

// Completion statistics
const stats = await MaintenanceRequest.getCompletionStats("guadalupe", 30);
// Predict: electrical issues take 3x longer than hardware issues
```

**3. User Engagement Personalization**

```javascript
// User behavior patterns
const engagement = await AcknowledgmentAccount.getUserEngagementStats(
  userId,
  30,
);
// Output: { totalAnnouncements: 15, readCount: 12, acknowledgedCount: 8, avgReadLatency: 3600000 }
// Predict: Best time to send notifications, preferred content types, etc.
```

**4. Content Performance Analytics**

```javascript
// Engagement metrics by category
const metrics = await Announcement.getEngagementStats("both");
// Output: Performance stats for each announcement category
// Use for: Content optimization, A/B testing, ranking
```

---

## ✅ Implementation Checklist

- ✅ Bill model with forecasting methods
- ✅ Announcement model with engagement tracking
- ✅ MaintenanceRequest model with predictive queries
- ✅ AcknowledgmentAccount model for engagement metrics
- ✅ Controllers for all models (billingController, announcementsController, maintenanceController)
- ✅ API routes integrated with Express server
- ✅ Frontend API client methods
- ✅ Updated frontend pages to use APIs
- ✅ Branch isolation on all queries
- ✅ Test data seed script
- ✅ Documentation

---

## 🔄 Migration Path for Existing Features

The same pattern can be applied to other features:

1. **Create scalable Mongoose model** with branch field and forecasting methods
2. **Create controller** with branch-aware queries
3. **Create API routes** with auth middleware
4. **Register routes** in server.js
5. **Add API client methods** in apiClient.js
6. **Update frontend** to use new API endpoints
7. **Create seed script** for test data

---

## 🚨 Important Notes

### Security

- ✅ All endpoints require authentication (auth middleware)
- ✅ Branch isolation prevents cross-tenant data access
- ✅ Admin-only endpoints validated on role
- ✅ User-specific data filtered by userId + branch

### Performance

- ✅ Indexes created on frequently queried fields
- ✅ Compound indexes for multi-field queries
- ✅ Aggregation pipelines optimized for analytics
- ✅ Limit enforcement on large result sets (max 100)

### Scalability

- ✅ Branch-aware queries scale to unlimited branches
- ✅ Soft delete maintains historical data
- ✅ Aggregation pipelines for time-series analysis
- ✅ Ready for sharding by branch if needed

---

## 📚 Next Steps

1. **Test the APIs** - Use Postman/Insomnia to test endpoints
2. **Seed test data** - Run seed-tenant-data.js
3. **Verify frontend** - Check BillingPage, AnnouncementsPage, MaintenancePage work correctly
4. **Develop AI features**:
   - Revenue forecasting model
   - Maintenance prediction engine
   - User engagement optimization
   - Content recommendation system

---

## 📞 Support

For questions about the new architecture, check:

- Model files in `server/models/`
- Controllers in `server/controllers/`
- API routes documentation in this file
- Frontend component implementations in `web/src/features/tenant/pages/`
