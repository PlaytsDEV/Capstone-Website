# Lilycrest Dormitory Management System

Full-stack web application for managing dormitory operations across multiple branches with role-based access control.

**Last Updated**: February 7, 2026

---

## 🚀 Quick Start

### Prerequisites

- Node.js 16+
- MongoDB Atlas account
- Firebase project with Authentication enabled
- npm or yarn

### 1. Clone & Install

```bash
# Clone repository
git clone <repository-url>
cd Lilycrest-Web

# Install backend dependencies
cd server && npm install

# Install frontend dependencies
cd ../web && npm install
```

### 2. Configure Environment

**Backend** (`server/.env`):

```env
PORT=5000
MONGODB_URI=mongodb+srv://...
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="..."
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASSWORD=your-app-password
FRONTEND_URL=http://localhost:3000
```

**Frontend** (`web/.env`):

```env
VITE_API_URL=http://localhost:5000/api
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### 3. Run Development Servers

```bash
# Terminal 1: Backend
cd server && npm run dev

# Terminal 2: Frontend
cd web && npm run dev
```

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:5000

---

## 📁 Project Structure

```
Lilycrest-Web/
├── docs/                    # 📚 Documentation
│   ├── API.md              # API endpoints reference
│   ├── API_MIGRATION.md    # API migration history
│   ├── AUTHENTICATION.md   # Authentication flows
│   ├── REFACTORING.md      # Refactoring history
│   ├── SECURITY.md         # Security implementation
│   └── STRUCTURE.md        # Detailed project structure
│
├── server/                  # 🖥️ Express Backend
│   ├── config/             # DB, Firebase, Email setup
│   ├── controllers/        # Business logic
│   ├── middleware/         # Auth, validation, CSRF
│   ├── models/             # MongoDB schemas
│   ├── routes/             # API routes
│   ├── scripts/            # Utility scripts
│   ├── utils/              # Helper functions
│   └── server.js           # Entry point
│
└── web/                     # 🌐 React Frontend
    ├── public/             # Static files
    ├── src/
    │   ├── assets/         # Images
    │   ├── features/       # Role-based modules
    │   │   ├── public/     # Public pages
    │   │   ├── tenant/     # Tenant portal
    │   │   ├── admin/      # Branch admin
    │   │   └── super-admin/# System admin
    │   ├── firebase/       # Firebase config
    │   ├── shared/         # Shared components/utils
    │   ├── App.js          # Main routing
    │   └── index.js        # Entry point
    └── build/              # Production build
```

---

## 📖 Documentation

| Document                                        | Description                                      |
| ----------------------------------------------- | ------------------------------------------------ |
| **[API.md](docs/API.md)**                       | Complete API endpoint reference                  |
| **[API_MIGRATION.md](docs/API_MIGRATION.md)**   | Migration from static to API-driven architecture |
| **[AUTHENTICATION.md](docs/AUTHENTICATION.md)** | Firebase authentication flows & implementation   |
| **[REFACTORING.md](docs/REFACTORING.md)**       | Complete refactoring history & improvements      |
| **[SECURITY.md](docs/SECURITY.md)**             | Security features (XSS, CSRF, input validation)  |
| **[STRUCTURE.md](docs/STRUCTURE.md)**           | Detailed project structure breakdown             |
| **[server/README.md](server/README.md)**        | Backend-specific documentation                   |
| **[web/README.md](web/README.md)**              | Frontend-specific documentation                  |

---

## ✨ Key Features

### 🏠 Public Features

- Landing page with branch information
- Room listings with advanced filters (price, type, capacity)
- Room details with image galleries
- Online inquiry submission
- FAQs page

### 🔐 Authentication

- Email/password registration & login
- Google OAuth integration
- Email verification
- Password reset
- Branch selection on first login
- Role-based access control

### 👤 Tenant Portal

- Personal dashboard with overview
- Billing & payment history
- Maintenance request submission
- Announcements & notifications
- Contract management
- Profile settings

### 🛠️ Admin Dashboard (Branch-Level)

- **Dashboard**: Quick stats & metrics
- **Reservations**: Unified inquiries + reservations management
- **Tenants**: Tenant profiles & contracts
- **Rooms**: 3-tab interface (Availability, Setup, Occupancy)
- **User Management**: Staff management
- **Audit Logs**: Activity tracking

### ⚙️ Super Admin Panel (System-Level)

- System-wide user management
- Branch management & configuration
- Role & permission management
- Activity logs & audit trail
- System settings & configuration

---

## 🏗️ Architecture

### Technology Stack

**Frontend**:

- React 19 + Vite
- React Router for routing
- Firebase Auth (Client SDK)
- Fetch API for HTTP requests

**Backend**:

- Express.js
- MongoDB + Mongoose
- Firebase Admin SDK
- Nodemailer for emails

**Security**:

- Input sanitization & validation
- CSRF protection
- JWT token verification
- Role-based access control
- Branch isolation

### Communication Flow

```
User Sign In (Firebase Auth)
    ↓
Firebase ID Token
    ↓
Token sent with API requests
    ↓
Backend verifies with Firebase Admin
    ↓
Role & branch-based access control
    ↓
Protected operations executed
```

---

## 🔒 Security Features

### Input Validation & Sanitization

- ✅ XSS protection (HTML entity escaping)
- ✅ SQL injection prevention (Mongoose ODM)
- ✅ Input validation rules for all fields
- ✅ Email/phone/username format validation

### CSRF Protection

- ✅ Cryptographic token generation
- ✅ Token validation on state-changing requests
- ✅ Firebase Auth implicit protection

### Access Control

- ✅ JWT token verification
- ✅ Role-based permissions (user, tenant, admin, superAdmin)
- ✅ Branch isolation (users only access their branch data)
- ✅ Audit logging for all admin actions

See [docs/SECURITY.md](docs/SECURITY.md) for complete details.

---

## 🗄️ Database Schema

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
  name, roomNumber, branch, type, capacity, price,
  available, beds: [{ id, position, available }],
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
    createdAt,
    respondedAt);
}
```

### AuditLog Model

```javascript
{
  userId, action, resourceType, resourceId,
  changes: { before, after }, branch, timestamp
}
```

---

## 🌐 API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get profile
- `PUT /api/auth/profile` - Update profile

### Rooms (Public)

- `GET /api/rooms` - Get all rooms (with filters)
- `GET /api/rooms/:id` - Get room details

### Reservations (Protected)

- `GET /api/reservations` - Get user reservations
- `POST /api/reservations` - Create reservation
- `PUT /api/reservations/:id` - Update reservation (admin)

### Inquiries

- `POST /api/inquiries` - Submit inquiry (public)
- `GET /api/inquiries` - Get all inquiries (admin)
- `PUT /api/inquiries/:id` - Update inquiry (admin)

### Users (Admin)

- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user details
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Audit Logs (Admin)

- `GET /api/audit-logs` - Get audit trail

See [docs/API.md](docs/API.md) for complete endpoint documentation.

---

## 🛠️ Utility Scripts

### Seed Rooms Database

```bash
cd server
node scripts/seed-rooms.js
```

Creates 12 rooms (3 private @ ₱13,500, 3 double @ ₱7,200, 6 quadruple @ ₱5,400).

### Cleanup Incomplete Rooms

```bash
node scripts/cleanup-incomplete-rooms.js
```

Removes rooms with missing required fields.

### Check Users

```bash
node scripts/check-users.js
```

Lists all users with roles and branches.

---

## 🚢 Deployment

### Frontend (Vercel/Netlify)

```bash
cd web
npm run build
# Deploy build/ directory
```

### Backend (Heroku/Railway)

```bash
cd server
# Set environment variables in hosting platform
# Deploy via Git or CLI
```

### Environment Variables

- Update `FRONTEND_URL` and `VITE_API_URL` to production domains
- Use production MongoDB URI
- Use production Firebase credentials
- Change default admin password

---

## 🧪 Testing

### Backend

```bash
cd server
npm test
```

### Frontend

```bash
cd web
npm test
```

---

## 📋 Admin Accounts

**Default Admin** (auto-created on first run):

- Email: `admin@lilycrest.com`
- Password: `Admin123!`
- Role: `superAdmin`

⚠️ **SECURITY**: Change password immediately after first login!

---

## 🐛 Troubleshooting

### Frontend not connecting to backend

- Check `VITE_API_URL` in `web/.env`
- Ensure backend is running on correct port
- Check CORS settings in `server/server.js`

### Firebase authentication errors

- Verify Firebase config in both `.env` files
- Check Firebase Console for enabled auth methods
- Ensure service account key is valid

### MongoDB connection errors

- Verify `MONGODB_URI` format
- Check MongoDB Atlas network access (whitelist IP)
- Ensure database user has correct permissions

### Room data issues

- Run `node scripts/cleanup-incomplete-rooms.js`
- Re-seed with `node scripts/seed-rooms.js`

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📝 License

[Add your license information here]

---

## 📞 Support

For detailed documentation:

- Backend issues: [server/README.md](server/README.md)
- Frontend issues: [web/README.md](web/README.md)
- API reference: [docs/API.md](docs/API.md)
- Security: [docs/SECURITY.md](docs/SECURITY.md)

---

**Built with ❤️ for Lilycrest Dormitory**
