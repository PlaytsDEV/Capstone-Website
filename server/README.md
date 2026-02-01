# Lilycrest Backend API

Backend server for Lilycrest Dormitory Management System built with Express.js and Firebase Admin SDK.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` file from `.env.example`:

```bash
cp .env.example .env
```

3. Add your Firebase Admin SDK credentials to `.env`

4. Start the server:

```bash
# Development
npm run dev

# Production
npm start
```

## Admin Account Setup

A default admin account is automatically created when you run the server for the first time. The credentials are configured in the `.env` file:

```env
ADMIN_EMAIL=admin@lilycrest.com
ADMIN_PASSWORD=Admin123!
ADMIN_ROLE=superAdmin
```

**⚠️ Security Notice:**

- Change the default password immediately after first login
- Remove or update these environment variables in production
- The admin account has full system access (superAdmin role)

To manually create/update the admin account:

```bash
node create-admin.js
```

## API Endpoints

### Authentication (`/api/auth`)

- `POST /register` - Register new user
- `GET /profile` - Get current user profile (requires auth)
- `PUT /profile` - Update user profile (requires auth)
- `POST /set-role` - Set user role (admin only)

### Users (`/api/users`)

- `GET /` - Get all users (admin only)
- `GET /:userId` - Get user by ID (admin only)

### Rooms (`/api/rooms`)

- `GET /` - Get all rooms (public)
- `POST /` - Create room (admin only)
- `PUT /:roomId` - Update room (admin only)
- `DELETE /:roomId` - Delete room (admin only)

### Reservations (`/api/reservations`)

- `GET /` - Get reservations (filtered by user role)
- `POST /` - Create reservation (requires auth)
- `PUT /:reservationId` - Update reservation (admin only)

### Inquiries (`/api/inquiries`)

- `GET /` - Get all inquiries (admin only)
- `POST /` - Submit inquiry (public)
- `PUT /:inquiryId` - Update inquiry (admin only)

## Authentication

All protected routes require a Firebase ID token in the Authorization header:

```
Authorization: Bearer <firebase-id-token>
```

## Project Structure

```
server/
├── config/
│   └── firebase.js          # Firebase Admin SDK config
├── middleware/
│   └── auth.js              # Authentication middleware
├── routes/
│   ├── auth.js              # Auth routes
│   ├── users.js             # User management routes
│   ├── rooms.js             # Room management routes
│   ├── reservations.js      # Reservation routes
│   └── inquiries.js         # Inquiry routes
├── .env.example             # Environment variables template
├── .gitignore
├── package.json
├── server.js                # Main server file
└── README.md
```

## Environment Variables

- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment (development/production)
- `FIREBASE_PROJECT_ID` - Firebase project ID
- `FIREBASE_CLIENT_EMAIL` - Firebase service account email
- `FIREBASE_PRIVATE_KEY` - Firebase private key
- `FRONTEND_URL` - Frontend URL for CORS (default: http://localhost:3000)
