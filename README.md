# 🏢 Lilycrest Dormitory Management System (Lilycrest DMS)

> An enterprise-grade, full-stack dormitory operations and tenancy management platform engineered for multi-branch residential facilities. Features real-time bed-level occupancy tracking, a guided 4-step tenant lifecycle, automated pro-rata utility billing, PayMongo payment checkout reconciliation, digital lease contracts with verifiable stay proofs, maintenance ticketing with contractor attribution, and WebSocket-driven live notifications.

---

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite-5.x-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Express.js-4.x-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/MongoDB-Atlas%20%2F%20Mongoose-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Firebase-Auth%20%26%20Storage-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Firebase" />
  <img src="https://img.shields.io/badge/PayMongo-Payments-4A154B?style=for-the-badge&logoColor=white" alt="PayMongo" />
  <img src="https://img.shields.io/badge/Socket.io-Realtime-010101?style=for-the-badge&logo=socketdotio&logoColor=white" alt="Socket.io" />
  <img src="https://img.shields.io/badge/Jest-166%20Suites%20%7C%201600%2B%20Tests-C21325?style=for-the-badge&logo=jest&logoColor=white" alt="Jest Tests" />
</p>

---

## 📋 Table of Contents

- [Core Highlights & Architecture](#-core-highlights--architecture)
- [System Architecture Flow](#-system-architecture-flow)
- [Technology Stack](#-technology-stack)
- [Role-Based Feature Matrix](#-role-based-feature-matrix)
  - [1. Public Visitor & Discovery](#1-public-visitor--discovery)
  - [2. Tenant & Applicant Portal](#2-tenant--applicant-portal)
  - [3. Branch Admin Workspace](#3-branch-admin-workspace)
  - [4. Super Admin Management](#4-super-admin-management)
  - [5. Mobile API Parity](#5-mobile-api-parity)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Configuration](#environment-configuration)
  - [Running the Application](#running-the-application)
- [Project Structure](#-project-structure)
- [API Route Reference](#-api-route-reference)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [Security & Production Hardening](#-security--production-hardening)
- [Documentation Index](#-documentation-index)
- [License](#-license)

---

## 🌟 Core Highlights & Architecture

Lilycrest DMS was built to resolve operational fragmentation in student and young-professional dormitories across Metro Manila branches (e.g., *Guadalupe*, *Gil Puyat*).

- **🛏️ Real-Time Bed-Level Occupancy**: Atomic room-capacity management (`$inc` locks, orphaned bed auto-release jobs) prevents race conditions and overbooking.
- **🔄 End-to-End Tenancy Lifecycle**: Unified flow encompassing Public Inquiry $\rightarrow$ Application $\rightarrow$ Physical Visit $\rightarrow$ Document OCR Pre-check $\rightarrow$ Security Deposit Settlement $\rightarrow$ Digital Lease Agreement $\rightarrow$ Move-In Balance Checkout $\rightarrow$ Active Tenancy $\rightarrow$ Offboarding Clearance.
- **⚡ Pro-Rata Utility & Dual Billing**: Dynamic monthly rent generation combined with electricity submeter reading calculation based on tenant occupancy duration and active resident headcounts.
- **💳 Multi-Tier PayMongo Payment Engine**: Supports reservation fees, move-in balance settlements, and recurring monthly utility bills via PayMongo checkout sessions with HMAC webhook reconciliation.
- **📜 Digital Contract & Stay Proof System**: Real-time legal lease generation (Chromium/HTML2PDF/JSPDF), signature capture, audit trail timestamps, and cryptographically verified public stay tokens (`/verify-stay/:token`).
- **🔧 Maintenance Management & Contractor Attribution**: Tenant maintenance ticketing with multi-photo proof inspection, priority tracking, contractor dispatch, and cost attribution.
- **📱 Full Mobile App Parity**: Dedicated `/api/mobile/*` bridge ensuring React Native / Flutter compatibility with token authentication, document uploads, and push alerts.

---

## 🏛 System Architecture Flow

```mermaid
flowchart TB
    subgraph Clients["Frontend Clients"]
        WEB["React 19 Web App\n(Vite · Zustand · React Query)"]
        MOB["Mobile Client\n(React Native / Mobile App)"]
    end

    subgraph Gateway["Security & API Gateway (Express.js)"]
        SEC["Helmet · CORS · Rate Limiter · CSRF Guard"]
        AUTH["Firebase Token Verification · RBAC Middleware"]
        ROUTES["Modular Domain Routes\n(/api/rooms, /api/billing, /api/contracts, etc.)"]
    end

    subgraph CoreEngine["Backend Engine & Services"]
        RES_SRV["Reservation & Occupancy Manager"]
        BILL_SRV["Pro-Rata Utility & Billing Engine"]
        CONT_SRV["Auto Contract Orchestrator & PDF Service"]
        CRON_SRV["node-cron Schedulers\n(Grace Periods · Bed Locks · Overdue Checks)"]
        SOCK_SRV["Socket.io WebSocket Broker"]
    end

    subgraph DataIntegrations["Data & External Services"]
        MDB[("MongoDB Atlas\n(18 Schemas · Multi-Branch Isolation)")]
        FB["Firebase Admin SDK\n(Auth · Cloud Storage Bucket)"]
        PM["PayMongo API\n(Checkout · Webhook Callbacks)"]
        MAIL["Nodemailer SMTP\n(Branded Transactional Alerts)"]
    end

    WEB --> SEC
    MOB --> SEC
    SEC --> AUTH --> ROUTES
    ROUTES --> CoreEngine
    CoreEngine --> MDB
    CoreEngine --> FB
    CoreEngine --> PM
    CoreEngine --> MAIL
    SOCK_SRV -.-> WEB
    SOCK_SRV -.-> MOB
```

---

## 💻 Technology Stack

| Layer | Technologies / Libraries |
|---|---|
| **Frontend Framework** | **React 19**, **Vite 5**, React Router 6, Zustand, TanStack React Query |
| **Styling & UI System** | Solid HSL Custom Design System (Strictly Zero-Gradient, High-Contrast, Minimalist Borders) |
| **Backend Runtime** | **Node.js 18+**, **Express.js 4.x** |
| **Database & ODM** | **MongoDB Atlas**, **Mongoose 8+** (18 Models, Schema Indexing, Optimistic Locking) |
| **Authentication & IAM** | **Firebase Authentication** (Google OAuth & Email/Password), Granular RBAC Middleware |
| **Payment Gateway** | **PayMongo** (Credit Card, GCash, Maya, Webhook Signature Verification) |
| **Realtime & Messaging** | **Socket.io** (Room-scoped events, admin live feeds, status push notifications) |
| **Document Processing** | **PDFKit**, **JSPDF**, **html2canvas**, **tesseract.js** (Document OCR pre-check) |
| **Scheduled Jobs** | **node-cron** (Bed lock expiry, reservation grace periods, billing cycles) |
| **Testing & CI** | **Jest**, **Supertest**, **mongodb-memory-server**, ESM Virtual Modules |

---

## 👥 Role-Based Feature Matrix

### 1. Public Visitor & Discovery
- **Live Branch & Room Explorer**: Filter dormitory rooms across branches by gender, room type (Single, Double, Quadruple), amenities, pricing, and live availability.
- **Vacancy Date Forecasting**: Intelligent availability preview informing applicants when rooms become available.
- **Public Inquiry Submission**: Inquiry form with automatic email dispatch to branch supervisors.
- **Physical Visit Booking**: Schedule an on-site branch visit before reserving.
- **Stay Verification Portal**: Public verification (`/verify-stay/:token`) to authenticate verified tenant stay credentials.

### 2. Tenant & Applicant Portal
- **Guided 4-Step Reservation Flow**: Seamless room selection $\rightarrow$ demographic and emergency info $\rightarrow$ ID/Proof of Enrollment upload $\rightarrow$ reservation fee checkout.
- **Move-In Settlement Dashboard**: Clear financial breakdown of Advance Rent and Security Deposit minus the paid reservation fee, payable directly via PayMongo checkout.
- **Digital Lease Contract Signing**: View prepared lease agreement, sign via in-browser canvas, and download signed PDF copies.
- **Utility & Billing Monitor**: View real-time electricity and room billing ledgers with downloadable branded payment receipts.
- **Maintenance Workspace**: File maintenance requests with photos, track resolution timelines, and chat directly with administrators.
- **Announcements & Acknowledgments**: Branch-specific bulletins with interactive acknowledgment tracking.

### 3. Branch Admin Workspace
- **Occupancy & Room Grid**: Bed-by-bed visual room layout with live occupancy indicators and rapid status switching.
- **Reservation Lifecycle Management**: Confirm inquiries, approve visits, review OCR document checks, record move-ins with initial electricity meter readings, and conduct offboarding clearances.
- **Room-Based Utility Billing Engine**: Record room submeter readings, calculate consumption deltas, and automatically distribute pro-rata utility charges across active tenants.
- **Maintenance Workspace & Dispatch**: Review incoming tickets, inspect before/after proof photos, assign contractors, and log cost attributions.
- **Analytics & Operations Reports**: Export financial logs, occupancy rates, and transaction histories in PDF and CSV formats.

### 4. Super Admin Management
- **Multi-Branch Overview**: Cross-branch metrics, occupancy comparisons, and consolidated revenue tracking.
- **Branch Configuration**: Register branches, room configurations, pricing matrices, and branch contact parameters.
- **User & Role Permissions**: Granular permission switches (`manage_billing`, `manage_maintenance`, `manage_users`, etc.).
- **Live Audit Trail**: Immutable logging capturing actor IDs, timestamps, modified fields, and prior/new state snapshots.
- **System Backup & Recovery**: Trigger automated or on-demand JSON database backups.

### 5. Mobile API Parity
- **Full Mobile REST Surface (`/api/mobile/*`)**: Native-optimized endpoints for authentication, profile management, monthly utility payment bridges, maintenance submission with 5MB ceiling enforcement, and announcement feeds.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) `>= 18.0.0`
- [MongoDB](https://www.mongodb.com/atlas) account or local MongoDB instance
- [Firebase Console](https://console.firebase.google.com/) Project with Authentication & Storage enabled
- [PayMongo](https://www.paymongo.com/) API Keys (Test / Live)

---

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/kuurz-z/Capstone-Website.git
cd Capstone-Website

# 2. Install backend dependencies
cd server
npm install

# 3. Install frontend dependencies
cd ../web
npm install
```

---

### Environment Configuration

#### Backend Configuration (`server/.env`)
Create `server/.env` with the following variables:

```env
# Server Runtime
PORT=5000
NODE_ENV=development

# MongoDB Database Connection
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/lilycrest?retryWrites=true&w=majority

# Firebase Admin Service Account Credentials
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app

# Email Service (Nodemailer SMTP)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-gmail-app-password

# Application URLs & CORS Whitelist
FRONTEND_URL=http://localhost:3000
PUBLIC_FRONTEND_URL=http://localhost:3000
PUBLIC_API_URL=http://localhost:5000
ALLOWED_FRONTEND_ORIGINS=http://localhost:3000
EMAIL_ACTION_URL=http://localhost:3000/auth-action
RESERVATION_CONTINUATION_URL=http://localhost:3000/applicant/check-availability
EMAIL_VERIFICATION_SECRET=your-secure-random-secret-key-32-chars

# PayMongo Payment Gateway
PAYMONGO_SECRET_KEY=sk_test_...
PAYMONGO_WEBHOOK_SECRET=whsec_...

# Maintenance Attachments & Storage
ATTACHMENT_STORAGE_DRIVER=firebase
RESERVATION_DOCUMENT_PRECHECK_TIMEOUT_MS=15000
```

#### Frontend Configuration (`web/.env`)
Create `web/.env` with the following variables:

```env
VITE_API_URL=http://localhost:5000/api
VITE_APP_URL=http://localhost:3000

# Firebase Client SDK Configuration
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef
```

---

### Running the Application

```bash
# Terminal 1: Run Backend Development Server
cd server
npm run dev

# Terminal 2: Run Frontend Vite Dev Server
cd web
npm run dev
```

| Service | Address |
|---|---|
| **Frontend Application** | `http://localhost:3000` |
| **Backend REST API** | `http://localhost:5000/api` |
| **API Deep Health Check** | `http://localhost:5000/api/health` |

---

## 📁 Project Structure

```text
Capstone-Website/
├── docs/                        # Architectural documentation & test specifications
│   ├── SYSTEM_ARCHITECTURE.md   # Detailed layer-by-layer architectural guide
│   ├── API_DOCUMENTATION.md     # API contract specifications and payload schemas
│   ├── BILLING_SYSTEM_MASTER_GUIDE.md # Pro-rata math & utility calculation logic
│   └── AUTHENTICATION_AND_SECURITY.md # Firebase/JWT integration & RBAC hierarchy
│
├── server/                      # Express.js REST API & WebSocket Server
│   ├── config/                  # Database, Firebase Admin, PayMongo, and CORS policy
│   ├── controllers/             # Request handlers (16+ domain controllers)
│   ├── middleware/              # Auth, permissions, rate limiting, validation, CSRF
│   ├── mobile/                  # Mobile API controllers, routing & security adapters
│   ├── models/                  # Mongoose data schemas (18 persistent models)
│   ├── routes/                  # Express route definitions
│   ├── services/                # Business services (Billing, Contracts, PDF, Notifications)
│   ├── utils/                   # Socket broker, audit logger, occupancy math, scheduler
│   └── server.js                # App entry point with deep health guards
│
├── web/                         # React 19 Frontend Application (Vite SPA)
│   ├── src/
│   │   ├── features/            # Modular role-based feature workspaces
│   │   │   ├── admin/           # Admin dashboard, rooms, billing, maintenance, reservations
│   │   │   ├── public/          # Landing page, availability browse, signup, legal views
│   │   │   ├── super-admin/     # Branch management, roles/permissions, system logs
│   │   │   └── tenant/          # Tenant portal, reservation flow, contract signing, bills
│   │   ├── shared/              # Reusable API clients, UI components, hooks, stores, utils
│   │   ├── App.jsx              # Main router configuration with per-route error boundaries
│   │   └── index.css            # Solid HSL theme variables & global styles
│   └── vite.config.js           # Vite bundle configuration & proxy settings
```

---

## 🔌 API Route Reference

| Domain | Route Prefix | Primary Authorization | Purpose |
|---|---|---|---|
| **Authentication** | `/api/auth` | Public / Firebase Token | Registration, login, profile retrieval, password reset |
| **Rooms & Beds** | `/api/rooms` | Public / Admin Role | Room listings, occupancy configuration, bed assignments |
| **Reservations** | `/api/reservations` | JWT / Admin Role | Multi-step booking, visit scheduling, status transitions |
| **Inquiries** | `/api/inquiries` | Public / Admin Role | Public contact requests and administrative replies |
| **Billing & Rent** | `/api/billing` | JWT / Admin Role | Rent bills, room utility generation, payment marking |
| **Payments** | `/api/payments` | JWT / Admin Role | PayMongo checkout sessions, payment history, vacancy dates |
| **Contracts** | `/api/contracts` | JWT / Admin Role | Lease generation, digital signature capture, PDF exports |
| **Maintenance** | `/api/maintenance` | JWT / Admin Role | Tenant ticket filing, contractor attribution, proof upload |
| **Announcements** | `/api/announcements`| JWT / Admin Role | Branch bulletins and tenant read acknowledgments |
| **Notifications** | `/api/notifications`| JWT Token | User in-app notifications and unread badges |
| **Attachments** | `/api/attachments`  | JWT Token | Branch-scoped document and photo uploads |
| **Users & Roles** | `/api/users`        | Admin Role | User profile management, role elevation |
| **Audit Trail** | `/api/audit-logs`   | Super Admin | Immutable administrative operation audit records |
| **System Backup** | `/api/backup`       | Super Admin | On-demand database export and system backup |
| **Webhooks** | `/api/webhooks`     | HMAC Signature | PayMongo asynchronous transaction settlement callbacks |
| **Mobile API** | `/api/mobile/*`     | Mobile JWT | Native mobile client authentication, bills, maintenance |
| **Health** | `/api/health`       | Public | Server uptime, database latency, memory consumption |

---

## 🧪 Testing & Quality Assurance

Lilycrest DMS enforces a strict zero-intervention quality gate with comprehensive integration and unit tests covering controllers, concurrency limits, and financial billing engines.

```bash
# Run full backend test suite (166 Suites | 1,600+ Tests)
cd server
npm test

# Run frontend build check & compilation validation
cd web
npm run build
```

---

## 🛡️ Security & Production Hardening

- **Cryptographic Webhook Verification**: All PayMongo webhook callbacks require valid HMAC signatures matching `PAYMONGO_WEBHOOK_SECRET`.
- **Branch-Scoped Data Isolation**: Multi-branch tenancy ensures branch administrators can only view and modify records belonging to their assigned facility.
- **Per-Route Error Boundaries**: Frontend single-page routes are wrapped in isolated error boundaries to prevent application-wide whiteouts.
- **Tiered Rate Limiting**: Independent rate limiters for authentication endpoints, public forms, and general API queries to prevent brute-force attacks.
- **Input Sanitization**: Request payloads undergo sanitization to prevent NoSQL injection, XSS vectors, and malformed object identifiers.
- **Audit Trails**: Every administrative change is logged to MongoDB `AuditLog` records containing prior/new snapshots, actor IP, and timestamp.

---

## 📚 Documentation Index

For in-depth technical documentation, refer to the guides in the [`docs/`](docs/) directory:

- 📐 [**System Architecture**](docs/SYSTEM_ARCHITECTURE.md) — Comprehensive technical architecture & model definitions.
- 📖 [**API Documentation**](docs/API_DOCUMENTATION.md) — REST contracts, payload schemas, and response envelopes.
- 💳 [**Billing System Master Guide**](docs/BILLING_SYSTEM_MASTER_GUIDE.md) — Pro-rata math algorithms and utility distribution rules.
- 🔐 [**Authentication & Security Guide**](docs/AUTHENTICATION_AND_SECURITY.md) — Firebase Auth integration, JWT verification, and RBAC hierarchy.
- 🛌 [**Occupancy & Reservation Guide**](docs/OCCUPANCY_AND_RESERVATION_GUIDE.md) — Bed-level management and lifecycle status state machine.
- 🛠️ [**Maintenance & Chat Specifications**](docs/MAINTENANCE_AND_SUPPORT_CHAT.md) — Maintenance workflow and contractor attribution.

---

## 📄 License

This repository and its codebase were developed for the **Lilycrest Dormitory Management System** Capstone Project. All rights reserved.

<p align="center">
  <strong>Lilycrest Dormitory Management System</strong><br>
  Engineered with React 19 · Node.js · Express · MongoDB · Firebase · PayMongo · Socket.io
</p>
