# LibraryHub

LibraryHub is a multi-library management system for administrators, librarians, and students. It combines seat allocation, shift management, fees, concerns, a student knowledge-sharing community, librarian notices, authentication, and Redis-backed response caching.

## Contents

- [Architecture](#architecture)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Backend](#backend)
- [API Reference](#api-reference)
- [Redis Caching](#redis-caching)
- [Frontend](#frontend)
- [Authentication and Roles](#authentication-and-roles)
- [Important Workflows](#important-workflows)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Architecture

```text
React + TypeScript + Vite frontend
              |
              | JSON over HTTP, Bearer JWT
              v
Express API on Node.js
       |              |
       v              v
MongoDB           Upstash Redis
(source of truth) (cache-aside reads)
```

The backend follows a lightweight modular architecture:

1. Controllers define HTTP routes and role access.
2. Services contain business rules, validation, cache orchestration, and workflows.
3. Repositories isolate Mongoose queries.
4. Entities define MongoDB/Mongoose schemas.
5. Common guards, middleware, utilities, and configuration are shared by modules.
6. Events publish domain activity and the audit consumer records audit output.

MongoDB remains the source of truth. Redis is an optimization only; cache failures fall back to MongoDB.

## Repository Structure

```text
library-system/
├── backend/
│   ├── package.json
│   ├── README.md
│   ├── models/                     # Legacy or standalone model location
│   └── src/
│       ├── main.js                 # Express app, route mounting, server startup
│       ├── common/
│       │   ├── decorators/         # Role metadata helpers
│       │   ├── exceptions/         # HttpError
│       │   ├── guards/              # JWT protection and role authorization
│       │   ├── middleware/         # Central error handler
│       │   └── utils/              # Async handler and security helpers
│       ├── config/
│       │   ├── database.js         # MongoDB connection
│       │   └── redis.js            # Upstash Redis client and cache helpers
│       ├── events/                  # Domain events, publishers, consumers
│       └── modules/
│           ├── auth/                # Login, refresh, logout
│           ├── community/           # Posts, likes, comments, notices
│           ├── concerns/            # Student concerns and resolution
│           ├── fees/                # Payments and overdue fee calculations
│           ├── librarians/           # Registration and admin approval
│           ├── libraries/            # Library registration and approval
│           ├── seats/               # Seat creation, assignment, release
│           └── students/            # Registration, profile, library roster
└── frontend/library/
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── main.tsx                # React entrypoint
        ├── App.tsx                 # Views, API calls, dashboard UI, theme/toasts
        ├── App.css                 # Component and responsive styling
        ├── index.css               # Global theme tokens and reset
        └── assets/                 # Frontend assets
```

## Getting Started

### Prerequisites

- Node.js 18 or newer
- npm
- MongoDB database, local or hosted
- Upstash Redis database for caching

### Install dependencies

```bash
cd backend
npm install

cd ../frontend/library
npm install
```

### Run locally

Use two terminals:

```bash
# Terminal 1
cd backend
npm start
```

The API runs at `http://localhost:5000` after MongoDB connects.

```bash
# Terminal 2
cd frontend/library
npm run dev
```

The Vite frontend normally runs at `http://localhost:5173`.

Health check:

```text
GET http://localhost:5000/health
```

Expected response:

```json
{"status":"ok"}
```

## Environment Variables

Create `backend/.env`. Never commit this file or expose these values in the frontend.

```env
MONGODB_URI=mongodb://127.0.0.1:27017/library-system
PORT=5000
JWT_SECRET=replace-with-a-long-random-secret
ADMIN_EMAIL=admin@librarysystem.local
ADMIN_PASSWORD=replace-with-a-strong-password
FRONTEND_URL=http://localhost:5173
UPSTASH_REDIS_REST_URL=https://your-upstash-endpoint.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-rest-token
```

The frontend reads its API URL from `frontend/library/.env`:

```env
VITE_API_URL=http://localhost:5000/api/v1
```

When `VITE_API_URL` is absent, the frontend uses the same localhost API URL by default.

`FRONTEND_URL` may contain comma-separated origins when more than one frontend origin is needed. The backend allows requests without an `Origin` header for tools such as curl and server-to-server calls.

## Backend

### Startup

`backend/src/main.js` loads environment variables, configures CORS and JSON parsing, mounts module routers under `/api/v1`, connects to MongoDB, checks Upstash Redis, and starts Express on `process.env.PORT` or port `5000` locally.

Startup logs include:

```text
MongoDB connected: ...
[Redis] Connected to Upstash Redis.
API running on port 5000
```

Redis is fail-open. If it is not configured or unavailable, the server logs the condition and continues using MongoDB.

### Module request flow

```text
HTTP request
   -> controller route
   -> protect JWT middleware
   -> allow(role) middleware
   -> service business logic
   -> repository / Redis
   -> JSON response
```

`HttpError` instances are converted to HTTP responses by the central error handler. `async-handler` forwards rejected promises to that handler.

## API Reference

Base URL:

```text
http://localhost:5000/api/v1
```

Production uses the Render service URL with the same `/api/v1` suffix.

### Authentication

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/auth/login` | Public | Login as admin, librarian, or student |
| POST | `/auth/refresh` | Authenticated | Refresh a JWT |
| POST | `/auth/logout` | Authenticated | Client-side logout acknowledgement |

Admin login uses `ADMIN_EMAIL` and `ADMIN_PASSWORD` and does not require a library code. Librarian and student login require an approved `libraryCode`.

### Libraries and librarians

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/libraries/register` | Public | Submit a library for approval |
| GET | `/admin/libraries` | Admin | List library requests |
| PATCH | `/admin/libraries/:id/approve` | Admin | Approve a library |
| PATCH | `/admin/libraries/:id/reject` | Admin | Reject a library |
| POST | `/librarians/register` | Public | Register a librarian for an approved library |
| GET | `/admin/librarians` | Admin | List librarian requests |
| PATCH | `/admin/librarians/:id/approve` | Admin | Approve a librarian and create seats |

Approving the first librarian creates the requested number of seats for that library. Approval also generates the library code used during student and librarian login.

### Students

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/students/register` | Public | Register a student |
| GET | `/students/me` | Student | Get profile, seat, payments, and concerns |
| GET | `/libraries/students` | Librarian | List students in the librarian's library |

### Seats

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/seats` | Librarian | Get the library seat map |
| POST | `/seats` | Librarian | Create a seat |
| POST | `/seats/:id/assign` | Librarian | Assign a student to a shift |
| PATCH | `/seats/:id/release` | Librarian | Release a shift assignment |

Each seat supports one `SHIFT_1` assignment and one `SHIFT_2` assignment. A student is removed from previous assignments before a new assignment is saved.

### Fees

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/students/:id/fees` | Librarian | Record an offline payment |
| GET | `/students/me/fees` | Student | Get payment history |
| GET | `/fees/pending` | Librarian | Get students with overdue fees |

A fee is overdue when the latest payment, or the student's registration date if no payment exists, is more than 30 days old.

### Concerns

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/concerns` | Student | Raise a concern |
| GET | `/concerns` | Librarian | List concerns for the librarian's library |
| PATCH | `/concerns/:id/resolve` | Librarian | Resolve a concern |

Open concerns are reflected in the librarian seat map as a raised-hand indicator for the relevant assigned student.

### Community

The route prefix remains `/communication` for API compatibility, while the source module is named `community`.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/communication/posts` | Student, Librarian | List posts for the current library |
| POST | `/communication/posts` | Student | Create a knowledge-sharing post |
| POST | `/communication/posts/:id/comments` | Student | Comment on a post |
| PATCH | `/communication/posts/:id/like` | Student | Toggle the current student's like |
| DELETE | `/communication/posts/:id` | Librarian | Delete any post in the library |
| DELETE | `/communication/posts/:postId/comments/:commentId` | Librarian | Delete any comment in the library |
| GET | `/communication/notices` | Student, Librarian | List notices for the current library |
| POST | `/communication/notices` | Librarian | Publish a notice |
| DELETE | `/communication/notices/:id` | Librarian | Remove a notice |

All community queries include the authenticated user's `libraryId`, preventing cross-library content access.

## Redis Caching

Redis uses `@upstash/redis` and the REST URL/token from environment variables. `backend/src/config/redis.js` provides `get`, `set`, `del`, and `checkConnection` helpers. Cache errors are logged and ignored so the API can continue with MongoDB.

### Cached reads

| API | Key | TTL | Invalidation |
|---|---|---:|---|
| `GET /communication/posts` | `community:posts:{libraryId}` | 30 seconds | Post, comment, like, or deletion |
| `GET /communication/notices` | `community:notices:{libraryId}` | 120 seconds | Notice creation or deletion |
| `GET /libraries/students` | `library:students:{libraryId}` | 300 seconds | Student registration |
| `GET /seats` | `library:seats:{libraryId}` | 15 seconds | Seat create/assign/release, payment, concern create/resolve |

The cache-aside flow is:

1. Read the library-scoped key from Redis.
2. Return the cached value on a hit.
3. Query MongoDB on a miss.
4. Store the serialized result with its endpoint TTL.
5. Delete affected keys after mutations.

The post cache is shared by library because the base post data is the same for all students. `likedByMe` is calculated from the cached likes array for the requesting student.

Never cache login, logout, mutations, or responses that contain secrets.

## Frontend

The frontend is a single React + TypeScript + Vite application. `App.tsx` contains the current views and API calls:

- Public portal and role registration forms
- Login and logout flow
- Admin approval dashboard
- Librarian dashboard with seats, students, fees, concerns, and raised hands
- Student dashboard with seat, payment history, and concern form
- Dedicated Community page with posts, comments, likes, moderation, and notices
- Persistent light/dark theme using `localStorage`
- Toast notifications for authentication, concerns, and registration results

Commands from `frontend/library`:

```bash
npm run dev       # Start Vite development server
npm run build     # Type-check and create dist/
npm run lint      # Run ESLint
npm run preview   # Preview the production build
```

The production frontend must be built with the Render API URL in `VITE_API_URL`; Vite embeds `VITE_*` variables into browser code, so only public configuration belongs there.

## Authentication and Roles

JWT payloads contain the authenticated user's ID, role, library ID, and library code where applicable.

| Role | Capabilities |
|---|---|
| Admin | Approve/reject libraries and librarians |
| Librarian | Manage seats, students, payments, concerns, community moderation, and notices |
| Student | View personal data, raise concerns, create posts, comment, and like |

Send the token as:

```http
Authorization: Bearer <token>
```

Every library-scoped operation must use `req.user.libraryId` rather than a library ID supplied by the client.

## Important Workflows

### Library onboarding

1. Submit `POST /libraries/register`.
2. Admin approves the library.
3. Register a librarian with the generated library code.
4. Admin approves the librarian.
5. The requested seats are created automatically.
6. Students register and log in with the same library code.

### Raised-hand concern flow

1. A student submits `POST /concerns`.
2. The concern is saved with the student's ID and library ID.
3. The library seat cache is invalidated.
4. The librarian dashboard requests `GET /seats`.
5. The seat service finds open concerns for assigned students.
6. The matching assignment receives `hasOpenConcern: true` and the frontend renders the yellow raised-hand indicator.

### Community notice flow

1. A librarian submits `POST /communication/notices`.
2. The notice is stored for that librarian's library.
3. The notice cache is invalidated.
4. Students and librarians see it on the Community page after the next request.

## Deployment

### Render backend

Create a Render Web Service for the `backend` directory:

- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`
- Health endpoint: `/health`
- Do not hard-code production `PORT`; Render supplies it.

Set these Render environment variables:

```env
MONGODB_URI=your-production-mongodb-uri
JWT_SECRET=your-production-jwt-secret
ADMIN_EMAIL=your-production-admin-email
ADMIN_PASSWORD=your-production-admin-password
FRONTEND_URL=https://your-app.vercel.app
UPSTASH_REDIS_REST_URL=https://your-upstash-endpoint.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-rest-token
```

### Vercel frontend

Deploy the `frontend/library` directory as a Vite project:

- Root directory: `frontend/library`
- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`

Set this Vercel environment variable:

```env
VITE_API_URL=https://your-render-service.onrender.com/api/v1
```

After deployment, update Render's `FRONTEND_URL` with the final Vercel domain. If you use a custom domain, use that exact origin, including `https://` and without a trailing slash.

## Troubleshooting

### `Cannot GET /api/v1/...`

Restart the backend from `backend`. An older Node process may still own port `5000`. Confirm the route with an authenticated request; unauthenticated requests should return `401`, not `Cannot GET`.

### Frontend calls localhost after deployment

Set `VITE_API_URL` in Vercel and redeploy. Vite environment variables are compiled at build time.

### CORS errors in production

Set Render's `FRONTEND_URL` to the exact Vercel origin. Restart or redeploy the Render service after changing environment variables.

### Redis shows no current keys

Keys expire according to their endpoint TTL or are deleted immediately after related mutations. Check Redis command/request usage separately from current key count.

### Redis is connected but no cache data appears

Confirm the running backend process was restarted after code or environment changes. A successful startup includes `[Redis] Connected to Upstash Redis.`. Authenticated cacheable requests then populate keys.

### Sensitive credentials

If a database or Redis token is ever exposed in chat, logs, commits, or screenshots, rotate it immediately and update the deployment environment variable.
