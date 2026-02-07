# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EaseMessage is a full-stack WhatsApp Business messaging platform. It's a monorepo with a React frontend (`client/`) and a Node.js/Express backend (`server/`).

## Development Commands

### Server (from `server/`)
```bash
npm install              # Install dependencies
node index.js            # Start server (default port from PORT env or 5000)
```

### Client (from `client/`)
```bash
npm install              # Install dependencies
npm run dev              # Start Vite dev server (port from VITE_PORT env or 3300)
npm run build            # Production build
npm run lint             # ESLint
npm run preview          # Preview production build
```

### Environment Variables
- **Server** (`server/.env`): `MONGO_URI`, `JWT_SECRET`, `PORT`, `WEBHOOK_VERIFY_TOKEN`
- **Client** (`client/.env`): `VITE_API_URL` (defaults to `http://localhost:3301/api`), `VITE_PORT`

## Architecture

### Backend (`server/`)

**Entry point:** `server/index.js` — Express 5 app with CORS, JSON parsing, route registration, MongoDB connection via Mongoose, and automatic data seeding on startup.

**Route → Model pattern:** Each route file in `server/routes/` maps to REST endpoints and directly queries Mongoose models from `server/models/`. Exception: campaigns use a controller/service layer (`server/controllers/campaignController.js` → `server/services/campaignService.js`).

**API route prefixes:**
| Prefix | Route file | Purpose |
|---|---|---|
| `/api/auth` | `auth.js` | Registration, login, profile, password |
| `/api/contacts` | `contacts.js` | CRUD, CSV upload, status updates |
| `/api/lists` | `lists.js` | Contact list management |
| `/api/messages` | `messages.js` | Conversations, message history, send |
| `/api/templates` | `templates.js` | Template CRUD, Meta API sync |
| `/api/whatsapp` | `whatsapp.js` | WABA connection, phone management, webhooks |
| `/api/campaigns` | `campaigns.js` | Campaign CRUD, verified templates |
| `/api/dashboard` | `dashboard.js` | KPI stats and chart data |
| `/api/stats` | `stats.js` | User statistics |

**Authentication:** JWT tokens passed via `x-auth-token` header. Middleware at `server/middleware/auth.js` verifies token and sets `req.user` with `{ id }`. JWT expiration: 100 hours. Passwords hashed with bcryptjs (10 rounds).

**WhatsApp integration:** Meta Graph API v24.0. Messages sent via `https://graph.facebook.com/v24.0/{phoneNumberId}/messages`. Each user must set one phone number as `isDefault: true` for outgoing messages. 24-hour messaging window enforced for non-template messages.

**Soft delete pattern:** `Contact` and `List` models use `isDeleted` boolean with `findActive()` static methods that filter deleted records.

**Seed/migration scripts:** Various `seed_*.js` and `migrate_*.js` files in `server/` root for data setup and schema migrations. Run directly with `node <script>.js`.

### Frontend (`client/`)

**Stack:** React 19 + Vite 7 + TailwindCSS 4 + React Router v6.

**Entry point:** `client/src/main.jsx` → `App.jsx` which wraps everything in `AuthProvider` and sets up routing with a `PrivateRoute` guard.

**State management:** React Context API via `client/src/context/AuthContext.jsx`. Uses `useReducer` with action types: `USER_LOADED`, `LOGIN_SUCCESS`, `REGISTER_SUCCESS`, `LOGIN_FAIL`, `REGISTER_FAIL`, `AUTH_ERROR`, `LOGOUT`. Token stored in localStorage and set as axios default header.

**Layout structure:** `Layout.jsx` wraps authenticated pages with `Header.jsx` (top bar with user info, notifications, mobile hamburger) and `Sidebar.jsx` (collapsible nav, mobile drawer overlay).

**Page components** in `client/src/pages/`: Dashboard, Inbox, Contacts, Campaigns, Templates, WhatsAppAccounts, Settings, Login, Register.

**Inbox architecture** (`client/src/components/inbox/`): Three-column layout — `ConversationList` | `ChatWindow` | `ContactDetails`. Mobile uses `mobileView` state (`'list'` | `'chat'` | `'details'`) for single-column navigation. Conversations poll every 10s, active chat messages poll every 3s.

**Campaign components** (`client/src/components/campaigns/`): Multi-step campaign creation flow — `CreateCampaign` orchestrates `PhoneNumberSelector` → `TemplateSelector` → `AudienceSelector` → `CampaignSummary`.

### Key Data Relationships
- **User** owns Contacts, Lists, WhatsAppBusinessAccounts, Templates, Campaigns
- **Contact** belongs to multiple Lists (many-to-many via arrays)
- **Contact** has unique constraint on `(userId, countryCode, phoneNumber)`
- **WhatsAppPhoneNumber** belongs to a WhatsAppBusinessAccount; only one per user can be `isDefault`
- **Message** belongs to a Contact; tracks direction (inbound/outbound) and type (text/template/media)
- **Campaign** references a PhoneNumber, Template, and List
