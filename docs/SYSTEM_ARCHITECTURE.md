# Lilycrest DMS — System Architecture & Topology

## 1. High-Level Architecture Overview

Lilycrest DMS is engineered as a decoupled, full-stack monorepo application comprised of:
- **Frontend SPA**: React (Vite) with Vanilla CSS / custom design tokens, modular feature grouping, per-route code-splitting, and resilience fallbacks.
- **Backend API**: Node.js with Express.js, MongoDB (Mongoose ORM), role-based middleware access control, and modular controller services.
- **OCR Engine**: Local Tesseract.js integration leveraging `eng.traineddata` for document and bill receipt parsing.

```
                         +-----------------------------------+
                         |       React Frontend (Vite)       |
                         |  Public / Tenant / Admin Portals  |
                         +-----------------+-----------------+
                                           |
                                     HTTP / REST API
                                           |
                         +-----------------v-----------------+
                         |     Express.js Backend Server     |
                         |   JWT Auth + Middleware Guard     |
                         +--------+-----------------+--------+
                                  |                 |
                   +--------------v---+       +-----v--------------+
                   |  MongoDB Database |       | Tesseract OCR Engine|
                   |  (Mongoose Models)|       | (eng.traineddata)  |
                   +------------------+       +--------------------+
```

---

## 2. Directory Structure & Workspace Topology

```
CapstoneSystem/
├── .agent/                             # Agent workflows & automation scripts
├── .agents/                            # Workspace rules & coding conventions (AGENTS.md)
└── Capstone-Website/
    ├── docs/                           # Master system documentation (10 Consolidated Guides)
    ├── scripts/                        # Repository helper scripts (gm.ps1, gp.ps1)
    ├── start-local.ps1                 # Single-command dev server startup script
    ├── server/                         # Backend Express Application
    │   ├── config/                     # Database connection & Firebase Admin setup
    │   ├── controllers/                # Request handlers & domain logic (16 modules)
    │   ├── middleware/                 # Auth, RBAC (`requirePermission`), rate-limiter, upload handling
    │   ├── mobile/                     # Mobile API endpoint compatibility adapters
    │   ├── models/                     # Mongoose schemas & atomic update methods (18 models)
    │   ├── routes/                     # API route declarations (16 modules)
    │   ├── services/                   # Utility sync, invoice calculation & PDF generation
    │   ├── utils/                      # Helper functions, logger, error formatters
    │   ├── uploads/                    # Local storage for user/tenant attachments
    │   ├── eng.traineddata             # OCR language dataset (5.1MB)
    │   └── server.js                   # Express application entry point
    └── web/                            # Frontend Vite React SPA
        ├── public/                     # Static assets, favicon, branding images
        ├── scripts/                    # Build server runner
        └── src/                        # React source code
            ├── assets/                 # SVGs and static visual elements
            ├── features/               # Domain-driven feature modules
            │   ├── admin/              # Branch Admin & Owner pages & components
            │   ├── public/             # Guest room browsing & landing pages
            │   └── tenant/             # Tenant portal & self-service pages
            ├── index.css               # Core Design System, HSL color tokens & utility classes
            └── main.jsx                # Application initialization & router setup
```

---

## 3. Technology Stack & Key Libraries

| Layer | Technology | Primary Package / Usage |
| :--- | :--- | :--- |
| **Frontend Core** | React 18, Vite | SPA routing, dynamic code splitting, fast refresh. |
| **Styling System** | Vanilla CSS, PostCSS | Custom HSL design tokens, micro-animations, high-contrast UX. |
| **Backend Core** | Node.js, Express.js | RESTful APIs, JSON middleware, structured routing. |
| **Database** | MongoDB, Mongoose | Document database, schema validation, atomic updates (`$inc`, `$set`). |
| **Auth & Security** | JWT, Firebase Admin | Token validation, Google OAuth, role-based authorization. |
| **Payment Gateway** | PayMongo API | Webhook & checkout session creation for bills and security deposits. |
| **OCR Verification**| Tesseract.js | In-memory receipt text extraction. |

---

## 4. Local Development Onboarding

### Environment Prerequisites
- Node.js `v18.x` or higher
- MongoDB local instance or MongoDB Atlas URI
- PowerShell (Windows)

### Quick Start Commands
From the project root `CapstoneSystem/`:

```powershell
# Option A: Start full environment (Backend + Frontend) using PowerShell runner
.\Capstone-Website\start-local.ps1

# Option B: Run components manually
# 1. Start Express Server (Port 5000)
cd Capstone-Website/server
npm run dev

# 2. Start Vite Frontend (Port 5173)
cd Capstone-Website/web
npm run dev
```
