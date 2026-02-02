# Lilycrest Dormitory Management System

Full-stack web application for managing dormitory operations with separate frontend and backend architecture.

## 📁 Project Structure

```
Lilycrest-Web/
├── docs/                    # 📚 Documentation
│   ├── AUTHENTICATION.md   # Auth system guide
│   ├── API.md              # API reference
│   └── STRUCTURE.md        # Full project structure
│
├── web/                     # 🌐 React Frontend
│   └── src/
│       ├── features/       # Role-based modules
│       │   ├── public/     # Public pages
│       │   ├── tenant/     # Tenant features
│       │   ├── admin/      # Admin dashboard
│       │   └── super-admin/# System admin
│       ├── shared/         # Shared components
│       ├── assets/         # Images
│       └── firebase/       # Firebase config
│
└── server/                  # 🖥️ Express Backend
    ├── config/             # Database, Firebase, Email
    ├── middleware/         # Auth & access control
    ├── models/             # MongoDB schemas
    ├── routes/             # API endpoints
    └── scripts/            # Utility scripts
```

## 📖 Documentation

| Document                                         | Description                          |
| ------------------------------------------------ | ------------------------------------ |
| [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) | Authentication flows, Firebase setup |
| [docs/API.md](docs/API.md)                       | API endpoints reference              |
| [docs/STRUCTURE.md](docs/STRUCTURE.md)           | Detailed project structure           |

## 🚀 Getting Started

### Prerequisites

- Node.js 16+
- MongoDB Atlas account
- Firebase project with Authentication enabled
- npm or yarn

### Frontend Setup (React)

1. Navigate to web directory:

```bash
cd web
```

2. Install dependencies:

```bash
npm install
```

3. Create `.env` file from template:

```bash
cp .env.example .env
```

4. Add your Firebase Web SDK config to `.env`:
   - Get from Firebase Console > Project Settings > Web App
   - Fill in: API Key, Messaging Sender ID, App ID

5. Start development server:

```bash
npm start
```

Frontend runs on: http://localhost:3000

### Backend Setup (Express + Firebase Admin)

1. Navigate to server directory:

```bash
cd server
```

2. Install dependencies:

```bash
npm install
```

3. Create `.env` file from template:

```bash
cp .env.example .env
```

4. Add Firebase Admin SDK credentials to `.env`:
   - Use the service account JSON provided
   - Fill in: Project ID, Client Email, Private Key

5. Start server:

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Backend runs on: http://localhost:5000

## 🏗️ Architecture

### Frontend (React)

- **Authentication**: Firebase Auth (Client SDK)
- **UI Framework**: React 19 with React Router
- **API Communication**: Fetch API with custom client
- **State Management**: React hooks (useState, useContext)

### Backend (Express)

- **Authentication**: Firebase Admin SDK
- **Database**: MongoDB with Mongoose
- **Email**: Nodemailer with Gmail SMTP
- **API**: RESTful endpoints
- **Security**: JWT token verification, role-based access

### Communication Flow

1. User signs in via Firebase Auth (frontend)
2. Firebase returns ID token
3. Token stored in localStorage
4. Token sent with API requests in Authorization header
5. Backend verifies token with Firebase Admin
6. Protected operations executed based on user role

## 🔌 API Endpoints

See [docs/API.md](docs/API.md) for complete API documentation.

## ✨ Features

- **Public Pages**: Landing, Branch Info, Room Listings
- **Authentication**: Sign In, Sign Up, Social Login
- **Tenant Portal**: Reservations, Profile Management
- **Admin Dashboard**: Room Management, Reservations, Inquiries
- **Super Admin**: User Role Management

## 🔐 Environment Variables

### Frontend (.env in web/)

```
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=...
REACT_APP_FIREBASE_PROJECT_ID=...
REACT_APP_FIREBASE_STORAGE_BUCKET=...
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
REACT_APP_FIREBASE_APP_ID=...
```

### Backend (.env in server/)

```
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://...
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASSWORD=your-app-password
FRONTEND_URL=http://localhost:3000
```

## 💻 Development

Start both frontend and backend simultaneously:

Terminal 1 (Frontend):

```bash
cd web && npm start
```

Terminal 2 (Backend):

```bash
cd server && npm run dev
```

## 🚢 Deployment

### Frontend

- Build: `npm run build` in web/
- Deploy to: Vercel, Netlify, Firebase Hosting

### Backend

- Deploy to: Heroku, Railway, Google Cloud Run
- Set environment variables in deployment platform
- Update FRONTEND_URL to production domain

## 🔒 Security Notes

⚠️ **Never commit**:

- `.env` files
- `serviceAccountKey.json`
- Firebase private keys

✅ **Always**:

- Use environment variables
- Keep service account keys server-side only
- Use Firebase Web SDK config for frontend
