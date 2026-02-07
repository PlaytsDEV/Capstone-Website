# Lilycrest Backend API

Express.js backend with MongoDB and Firebase Admin SDK for the Lilycrest Dormitory Management System.

---

## Technology Stack

- **Express.js** - Web framework
- **MongoDB + Mongoose** - Database & ODM
- **Firebase Admin SDK** - Token verification
- **Nodemailer** - Email service
- **JWT** - Token-based authentication

---

## Project Structure

```
server/
├── config/
│   ├── database.js       # MongoDB connection
│   ├── firebase.js       # Firebase Admin SDK
│   └── email.js          # Nodemailer configuration
│
├── controllers/          # Business logic
│   ├── authController.js
│   ├── usersController.js
│   ├── roomsController.js
│   ├── reservationsController.js
│   ├── inquiriesController.js
│   └── auditController.js
│
├── middleware/           # Express middleware
│   ├── auth.js          # JWT/Firebase verification
│   ├── branchAccess.js  # Branch-based access control
│   ├── csrf.js          # CSRF protection
│   └── validation.js    # Input sanitization & validation
│
├── models/              # Mongoose schemas
│   ├── User.js
│   ├── Room.js
│   ├── Reservation.js
│   ├── Inquiry.js
│   ├── AuditLog.js
│   └── archive/         # Archive schemas
│
├── routes/              # Express routes
│   ├── authRoutes.js
│   ├── usersRoutes.js
│   ├── roomsRoutes.js
│   ├── reservationsRoutes.js
│   ├── inquiriesRoutes.js
│   └── auditRoutes.js
│
├── scripts/             # Utility scripts
│   ├── seed-rooms.js
│   ├── cleanup-incomplete-rooms.js
│   └── check-users.js
│
├── utils/
│   └── auditLogger.js   # Audit logging utility
│
└── server.js            # Entry point
```

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env` file:

```env
# Server
PORT=5000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/lilycrest

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Email (Gmail)
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASSWORD=your-app-specific-password

# CORS
FRONTEND_URL=http://localhost:3000

# Default Admin Account
ADMIN_EMAIL=admin@lilycrest.com
ADMIN_PASSWORD=Admin123!
ADMIN_ROLE=superAdmin
```

### 3. Run Server

```bash
# Development (with nodemon)
npm run dev

# Production
npm start
```

Server runs on: **http://localhost:5000**

---

## API Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint         | Auth Required | Description        |
| ------ | ---------------- | ------------- | ------------------ |
| POST   | `/register`      | Firebase      | Register new user  |
| POST   | `/login`         | Firebase      | User login         |
| GET    | `/profile`       | JWT           | Get user profile   |
| PUT    | `/profile`       | JWT           | Update profile     |
| PATCH  | `/update-branch` | JWT           | Update user branch |
| POST   | `/set-role`      | Admin         | Set user role      |

### Rooms (`/api/rooms`)

| Method | Endpoint   | Auth Required | Description             |
| ------ | ---------- | ------------- | ----------------------- |
| GET    | `/`        | Public        | Get all rooms (filters) |
| GET    | `/:roomId` | Public        | Get room by ID          |
| POST   | `/`        | Admin         | Create room             |
| PUT    | `/:roomId` | Admin         | Update room             |
| DELETE | `/:roomId` | Admin         | Delete room             |

### Reservations (`/api/reservations`)

| Method | Endpoint          | Auth Required | Description           |
| ------ | ----------------- | ------------- | --------------------- |
| GET    | `/`               | JWT           | Get reservations      |
| GET    | `/:reservationId` | JWT           | Get reservation by ID |
| POST   | `/`               | JWT           | Create reservation    |
| PUT    | `/:reservationId` | Admin         | Update reservation    |
| DELETE | `/:reservationId` | Admin         | Cancel reservation    |

### Inquiries (`/api/inquiries`)

| Method | Endpoint      | Auth Required | Description       |
| ------ | ------------- | ------------- | ----------------- |
| GET    | `/`           | Admin         | Get all inquiries |
| GET    | `/:inquiryId` | Public        | Get inquiry by ID |
| POST   | `/`           | Public        | Submit inquiry    |
| PUT    | `/:inquiryId` | Admin         | Update inquiry    |
| DELETE | `/:inquiryId` | Admin         | Delete inquiry    |

### Users (`/api/users`)

| Method | Endpoint           | Auth Required | Description           |
| ------ | ------------------ | ------------- | --------------------- |
| GET    | `/`                | Admin         | Get all users         |
| GET    | `/:userId`         | Admin         | Get user by ID        |
| GET    | `/email/:username` | Admin         | Get email by username |
| GET    | `/stats`           | Admin         | Get user statistics   |
| PUT    | `/:userId`         | Admin         | Update user           |
| DELETE | `/:userId`         | Admin         | Delete user           |

### Audit Logs (`/api/audit-logs`)

| Method | Endpoint | Auth Required | Description    |
| ------ | -------- | ------------- | -------------- |
| GET    | `/`      | Admin         | Get audit logs |

---

## Authentication Flow

### 1. Firebase Authentication (Frontend)

```
User signs in → Firebase Auth → Returns ID token
```

### 2. Backend Verification

```
Request with token → Firebase Admin verifies → Returns user data
```

### 3. Protected Routes

```javascript
// Middleware chain
router.post(
  "/protected-route",
  verifyToken, // Verify Firebase token
  verifyAdmin, // Check admin role
  filterByBranch, // Apply branch filter
  handler, // Execute controller
);
```

---

## Security Features

### Input Validation & Sanitization

- XSS protection (HTML entity escaping)
- SQL injection prevention (Mongoose ODM)
- Validation rules for all inputs
- **Location**: `middleware/validation.js`

### CSRF Protection

- Cryptographic token validation
- State-changing requests protected
- **Location**: `middleware/csrf.js`

### Branch Isolation

- Automatic branch filtering
- Users only access their branch data
- Admins restricted to their branch

### Role-Based Access Control

- `user` - Basic account
- `tenant` - Active resident
- `admin` - Branch administrator
- `superAdmin` - System administrator

---

## Database Models

### User Model

```javascript
{
  (firebaseUid,
    email,
    username,
    firstName,
    lastName,
    phone,
    role,
    branch,
    emailVerified,
    createdAt,
    updatedAt);
}
```

### Room Model

```javascript
{
  name, roomNumber, branch, type,
  capacity, price, available,
  beds: [{ id, position, available }],
  amenities, description, images
}
```

### Reservation Model

```javascript
{
  (userId,
    roomId,
    branch,
    startDate,
    endDate,
    status,
    totalAmount,
    createdAt,
    updatedAt);
}
```

### Inquiry Model

```javascript
{
  (name,
    email,
    phone,
    branch,
    message,
    status,
    priority,
    response,
    respondedBy,
    respondedAt,
    createdAt);
}
```

### AuditLog Model

```javascript
{
  userId, action, resourceType, resourceId,
  changes: { before, after },
  branch, timestamp
}
```

---

## Utility Scripts

### Seed Rooms Database

```bash
node scripts/seed-rooms.js
```

Creates 12 rooms (3 private, 3 double, 6 quadruple) across both branches.

### Cleanup Incomplete Rooms

```bash
node scripts/cleanup-incomplete-rooms.js
```

Removes rooms with missing required fields.

### Check Users

```bash
node scripts/check-users.js
```

Lists all users with their roles and branches.

---

## Admin Account Setup

Default admin account is auto-created on first run:

**Email**: `admin@lilycrest.com`  
**Password**: `Admin123!`  
**Role**: `superAdmin`

⚠️ **Security**: Change password immediately after first login!

---

## Error Handling

Standard error responses:

```json
{
  "error": "Error message",
  "details": ["Validation error 1", "Validation error 2"],
  "code": "ERROR_CODE"
}
```

Common error codes:

- `VALIDATION_ERROR` - Input validation failed
- `AUTH_FAILED` - Authentication failed
- `UNAUTHORIZED` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `BRANCH_ACCESS_DENIED` - Branch access violation

---

## Development

### Enable Debug Logging

```javascript
// In controllers
console.log("✅ Success message");
console.error("❌ Error message");
console.warn("⚠️ Warning message");
```

### Test API Endpoints

Use Postman/Insomnia or curl:

```bash
# Get all rooms
curl http://localhost:5000/api/rooms

# Register user (with Firebase token)
curl -X POST http://localhost:5000/api/auth/register \
  -H "Authorization: Bearer <firebase-token>" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","firstName":"John","lastName":"Doe"}'
```

---

## Deployment

### Environment Variables

Ensure all production environment variables are set:

- Update `MONGODB_URI` to production database
- Update `FRONTEND_URL` to production domain
- Use production Firebase credentials
- Change admin password

### Production Mode

```bash
NODE_ENV=production npm start
```

### Hosting Options

- **Heroku**: `git push heroku main`
- **Railway**: Deploy via GitHub integration
- **Google Cloud Run**: Use Docker container
- **AWS EC2**: Deploy with PM2

---

## Documentation

- [Main README](../README.md) - Project overview
- [API Documentation](../docs/API.md) - Complete API reference
- [Authentication Guide](../docs/AUTHENTICATION.md) - Auth implementation
- [Security Guide](../docs/SECURITY.md) - Security features
- [Project Structure](../docs/STRUCTURE.md) - Full structure

---

## Support

For frontend issues, see [web/README.md](../web/README.md)
