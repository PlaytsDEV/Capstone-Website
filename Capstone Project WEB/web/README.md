# Lilycrest Frontend (React)

React-based frontend for the Lilycrest Dormitory Management System.

---

## Technology Stack

- **React 19** - UI framework
- **Vite** - Build tool & dev server
- **React Router** - Client-side routing
- **Firebase Auth** - Authentication
- **CSS Modules** - Component styling

---

## Project Structure

```
src/
├── features/              # Role-based modules
│   ├── public/           # Public pages (landing, rooms, FAQs)
│   ├── tenant/           # Tenant dashboard & features
│   ├── admin/            # Branch admin interface
│   └── super-admin/      # System admin interface
│
├── shared/               # Shared across all roles
│   ├── api/             # API client functions
│   ├── components/      # Reusable UI components
│   ├── guards/          # Route protection
│   ├── hooks/           # Custom React hooks
│   ├── layouts/         # Page layouts
│   └── utils/           # Helper functions
│
├── assets/              # Images and static files
├── firebase/            # Firebase configuration
├── App.js              # Main app with routing
└── index.js            # Entry point
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
VITE_API_URL=http://localhost:5000/api
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

Get Firebase config from: [Firebase Console](https://console.firebase.google.com/) > Project Settings > Web App

### 3. Run Development Server

```bash
npm run dev
```

App runs on: **http://localhost:3000**

### 4. Build for Production

```bash
npm run build
```

Outputs to `build/` directory.

---

## Available Scripts

| Command           | Description                           |
| ----------------- | ------------------------------------- |
| `npm run dev`     | Start Vite dev server with hot reload |
| `npm run build`   | Create production build               |
| `npm run preview` | Preview production build locally      |
| `npm test`        | Run Jest tests                        |

---

## Key Features

### Authentication

- Email/password signup/login
- Google OAuth integration
- Email verification
- Password reset
- Branch selection on first login

### Public Features

- Landing page
- Branch information pages (Gil Puyat, Guadalupe)
- Room listings with filters
- Inquiry submission modal
- FAQs page

### Tenant Portal

- Dashboard with overview
- Billing & payment history
- Maintenance requests
- Announcements
- Contract management
- Profile settings

### Admin Dashboard

- Reservations management (inquiries + reservations)
- Tenant management
- Room management (availability + setup + occupancy)
- User management
- Audit logs

### Super Admin Panel

- System-wide user management
- Branch management
- Role & permissions
- Activity logs
- System settings

---

## API Integration

All API calls use `apiClient.js` with automatic:

- Firebase token injection
- Error handling
- Request/response formatting

**Example**:

```javascript
import { roomApi } from "../shared/api/apiClient";

// Fetch rooms
const rooms = await roomApi.getAll({ branch: "gil-puyat" });

// Create reservation
const reservation = await reservationApi.create(reservationData);
```

---

## Routing Structure

### Public Routes

- `/` - Landing page
- `/gil-puyat` - Gil Puyat branch info
- `/guadalupe` - Guadalupe branch info
- `/rooms/*` - Room listings
- `/faqs` - FAQs page
- `/signin` - Tenant sign in
- `/signup` - Tenant sign up

### Protected Routes (Tenant)

- `/tenant/dashboard` - Tenant dashboard
- `/tenant/profile` - Profile settings
- `/tenant/billing` - Billing & payments
- `/tenant/maintenance` - Maintenance requests
- `/tenant/announcements` - Announcements
- `/tenant/contracts` - Contract details

### Protected Routes (Admin)

- `/admin/dashboard` - Admin dashboard
- `/admin/reservations` - Inquiries + Reservations
- `/admin/tenants` - Tenant management
- `/admin/room-availability` - Room management (tabs)
- `/admin/users` - User management
- `/admin/audit-logs` - Audit trail

### Protected Routes (Super Admin)

- `/super-admin/dashboard` - System overview
- `/super-admin/users` - User management
- `/super-admin/branches` - Branch management
- `/super-admin/roles` - Role & permissions
- `/super-admin/activity-logs` - Activity logs
- `/super-admin/settings` - System settings

---

## Component Patterns

### Feature Module Pattern

Each role has its own feature module with:

- `pages/` - Page components
- `components/` - Feature-specific components
- `modals/` - Modal dialogs
- `hooks/` - Custom hooks
- `services/` - API services
- `styles/` - CSS files
- `index.js` - Barrel exports

### Embedded Component Pattern

Components that work standalone or embedded in tabs:

```jsx
function Page({ isEmbedded = false }) {
  const content = <section>...</section>;

  if (isEmbedded) return content;
  return (
    <Layout>
      <Sidebar />
      {content}
    </Layout>
  );
}
```

---

## Styling

- Global styles: `App.css`, `index.css`
- Component styles: Feature-specific CSS files
- Naming convention: BEM (Block Element Modifier)

---

## Development Tips

### Hot Reload

Vite provides instant hot module replacement. Changes appear immediately without full page reload.

### Debugging

- React DevTools for component inspection
- Browser DevTools for network/console debugging
- Firebase Auth state in console: `firebase.auth().currentUser`

### Code Organization

- Keep components small and focused
- Use custom hooks for reusable logic
- Put shared code in `shared/`
- Keep feature code isolated in `features/{role}/`

---

## Deployment

### Firebase Hosting

```bash
npm run build
firebase deploy --only hosting
```

### Vercel

```bash
vercel --prod
```

### Netlify

```bash
netlify deploy --prod --dir=build
```

---

## Documentation

- [Main README](../README.md) - Project overview
- [API Documentation](../docs/API.md) - API endpoints
- [Authentication Guide](../docs/AUTHENTICATION.md) - Auth flows
- [Project Structure](../docs/STRUCTURE.md) - Full structure
- [Security Guide](../docs/SECURITY.md) - Security implementation

---

## Support

For backend API issues, see [server/README.md](../server/README.md)
