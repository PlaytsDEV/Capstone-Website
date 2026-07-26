# Lilycrest DMS — API Documentation

Comprehensive reference for the Lilycrest Dormitory Management System RESTful API endpoints.

**Base URL**: `http://localhost:5000/api`  
**API Envelope**: All responses return standardized payloads:
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional descriptive status text"
}
```

---

## 1. Authentication & User Management (`/api/auth`, `/api/users`)

| Method | Endpoint | Auth Guard | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public / Firebase | Register new applicant account. |
| `POST` | `/api/auth/login` | Public / Firebase | Authenticate user and issue JWT token. |
| `GET` | `/api/auth/profile` | JWT (`Bearer`) | Fetch authenticated user's profile details. |
| `PUT` | `/api/auth/profile` | JWT (`Bearer`) | Update profile metadata (name, phone, username). |
| `GET` | `/api/users` | Admin (`requirePermission('manage_users')`) | List users with branch and role filters. |
| `PATCH` | `/api/users/:userId/suspend` | Admin | Suspend a user account. |
| `PATCH` | `/api/users/:userId/reactivate` | Admin | Reactivate a suspended user account. |
| `PATCH` | `/api/users/:userId/permissions` | Super Admin | Update granular admin permission keys. |

---

## 2. Rooms & Occupancy Management (`/api/rooms`)

| Method | Endpoint | Auth Guard | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/rooms` | Public | List rooms with optional branch and type filters. |
| `GET` | `/api/rooms/:roomId` | Public | Retrieve single room details and bed layout. |
| `POST` | `/api/rooms` | Admin (`requirePermission('manage_rooms')`) | Create a new room with capacity and bed configurations. |
| `PUT` | `/api/rooms/:roomId` | Admin (`requirePermission('manage_rooms')`) | Update room pricing, amenities, and policies. |
| `DELETE`| `/api/rooms/:roomId` | Admin (`requirePermission('manage_rooms')`) | Archive room (blocked if occupied). |

---

## 3. Reservations & Tenant Lifecycle (`/api/reservations`)

| Method | Endpoint | Auth Guard | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/reservations` | JWT | Get user reservations (or branch reservations for Admin). |
| `POST` | `/api/reservations` | Applicant | Submit new bed reservation request. |
| `PUT` | `/api/reservations/:id` | Admin | Approve or reject reservation request. |
| `PUT` | `/api/reservations/:id/extend` | Admin | Extend tenant move-in deadline. |
| `PUT` | `/api/reservations/:id/release` | Admin | Release reserved bed slot. |
| `PUT` | `/api/reservations/:id/checkout` | Admin | Process tenant move-out and release room bed. |

---

## 4. Billing, Utilities & Payments (`/api/billing`, `/api/utilities`, `/api/payments`)

| Group | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Billing** | `GET` | `/api/billing/current` | Fetch current month bill for active tenant. |
| **Billing** | `GET` | `/api/billing/history` | Retrieve billing history for current tenant. |
| **Billing** | `POST` | `/api/billing/:billId/submit-proof` | Upload proof of payment photo. |
| **Billing** | `POST` | `/api/billing/:billId/verify` | Admin verification of payment proof (Approve/Reject). |
| **Utilities**| `GET` | `/api/utilities/:type/rooms` | List rooms with current meter reading status. |
| **Utilities**| `POST` | `/api/utilities/:type/readings` | Input cutoff meter readings for electricity/water. |
| **Utilities**| `POST` | `/api/utilities/:type/batch-close` | Close 15th-cycle billing period and calculate pro-rata results. |
| **Payments** | `POST` | `/api/payments/bill/:billId/checkout` | Initialize PayMongo online payment session. |

---

## 5. Maintenance, Announcements & Audit Trail (`/api/maintenance`, `/api/announcements`, `/api/audit-logs`)

| Group | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Maintenance** | `POST` | `/api/maintenance/requests` | Submit maintenance ticket with photo attachment. |
| **Maintenance** | `PATCH`| `/api/maintenance/requests/:id` | Admin update request status (In-Progress, Completed). |
| **Announcements**|`GET` | `/api/announcements` | Fetch active branch announcements feed. |
| **Announcements**|`POST` | `/api/announcements/:id/acknowledge` | Single-click acknowledgment of mandatory announcement. |
| **Audit Logs** | `GET` | `/api/audit-logs` | Fetch system audit logs with date and severity filters. |
