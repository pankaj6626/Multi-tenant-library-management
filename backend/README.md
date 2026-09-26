# Library Management API

Run MongoDB locally, update `MONGODB_URI` and `JWT_SECRET` in `.env`, then run:

```bash
npm start
```

Redis caching uses Upstash REST. Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to `.env`. The API continues to use MongoDB if Redis is unavailable.

The server starts at `http://localhost:5000`; `GET /health` confirms it is running.

For deployment, set `FRONTEND_URL` to the deployed Vercel origin, for example
`https://your-library.vercel.app`. Multiple origins can be separated with commas.
The backend also allows requests without an `Origin` header for health checks, curl,
and server-to-server calls.

For a frontend and backend deployed on different domains, set these backend variables:

```env
NODE_ENV=production
FRONTEND_URL=https://your-library.vercel.app
COOKIE_SECURE=true
COOKIE_SAMESITE=none
```

Also set the frontend deployment variable `VITE_API_URL` to the deployed API base,
for example `https://your-api.example.com/api/v1`. The refresh token is an HttpOnly,
Secure cookie, so the frontend must send requests with credentials; the application
already does this for login, refresh, logout, and API calls.

## Authentication

Use `POST /api/v1/auth/login` with `email`, `password`, and `libraryCode` for librarians and students. The admin uses `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env` and does not need a library code. The response contains a short-lived `accessToken`; send it as `Authorization: Bearer <accessToken>`. The refresh token is set as an HttpOnly cookie and is never returned to the browser JavaScript runtime.

Access tokens expire after 30 minutes. `POST /api/v1/auth/refresh` rotates the refresh cookie and returns a new access token; clients must send credentials/cookies with this request. `POST /api/v1/auth/logout` revokes the refresh session and clears the cookie, so it does not require an access token. Configure `FRONTEND_URL` for credentialed cross-origin requests in production.

## Error responses

API errors use a consistent JSON shape with `success: false`, a user-safe `message`, a stable `code`, and a `requestId` for tracing. Validation errors may include a `details` object. Clients should display `message` and retain `requestId` for support diagnostics; server stack traces and sensitive values are never returned.

Authenticated students and librarians can use `GET /api/v1/notifications` to load their latest 50 notifications. Use `PATCH /api/v1/notifications/:id/read` for an individual notification or `PATCH /api/v1/notifications/read-all` to clear the unread state. Notifications are created for seat assignments, payments, resolved concerns, notices, student registrations, and 30-day fee reminders.

```json
{
	"success": false,
	"message": "This shift is already occupied",
	"code": "SEAT_SHIFT_OCCUPIED",
	"requestId": "request-id"
}
```

## Main endpoints

- `POST /api/v1/libraries/register`
- `POST /api/v1/librarians/register`
- `POST /api/v1/students/register`
- `GET /api/v1/admin/libraries`, `PATCH /api/v1/admin/libraries/:id/approve`, `PATCH /api/v1/admin/libraries/:id/reject`
- `GET /api/v1/admin/librarians`, `PATCH /api/v1/admin/librarians/:id/approve`, `PATCH /api/v1/admin/librarians/:id/reject`
- `GET /api/v1/students/me`, `GET /api/v1/libraries/students`, `GET /api/v1/libraries/students/history`, `DELETE /api/v1/libraries/students/:id`
- `GET|POST /api/v1/seats`, `POST /api/v1/seats/:id/assign`, `PATCH /api/v1/seats/:id/release`
- `POST /api/v1/students/:id/fees`, `GET /api/v1/students/me/fees`, `GET /api/v1/fees/pending`
- `GET /api/v1/expenses`, `PUT /api/v1/expenses/:month` (librarian-only monthly expense history and save/update; month format `YYYY-MM`)
- `POST /api/v1/concerns`, `GET /api/v1/concerns`, `PATCH /api/v1/concerns/:id/resolve`
- `GET|POST /api/v1/communication/posts`, `POST /api/v1/communication/posts/:id/comments`, `PATCH /api/v1/communication/posts/:id/like`
- `DELETE /api/v1/communication/posts/:id`, `DELETE /api/v1/communication/posts/:postId/comments/:commentId`
- `GET|POST /api/v1/communication/notices`, `DELETE /api/v1/communication/notices/:id`

Monthly expenses are scoped to the authenticated librarian's library. Each month stores Electricity, Rent, Internet, Cleaning, Staff salary, Water, Maintenance, Furniture, and Others; the API calculates the total and allows the same library/month record to be updated.

Approving the first librarian automatically creates the requested number of seats. Each seat accepts one student in `SHIFT_1` and one in `SHIFT_2`. A fee is overdue when no payment has been recorded in the previous 30 days (or the student registered more than 30 days ago without a payment).

Releasing a seat assignment records the student's name, email, mobile number, joining date, and leaving date in the `StudentHistory` collection. A librarian can also remove an unassigned registration with `DELETE /api/v1/libraries/students/:id`; it is archived before deletion, while assigned students must be released from their seat first. Students without an assignment cannot access community features or create concerns; the backend enforces this with the seat-assignment guard.
