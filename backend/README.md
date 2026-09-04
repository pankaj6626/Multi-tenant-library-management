# Library Management API

Run MongoDB locally, update `MONGODB_URI` and `JWT_SECRET` in `.env`, then run:

```bash
npm start
```

Redis caching uses Upstash REST. Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to `.env`. The API continues to use MongoDB if Redis is unavailable.

The server starts at `http://localhost:5000`; `GET /health` confirms it is running.

## Authentication

Use `POST /api/v1/auth/login` with `email`, `password`, and `libraryCode` for librarians and students. The admin uses `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env` and does not need a library code. Send the returned token as `Authorization: Bearer <token>`.

## Main endpoints

- `POST /api/v1/libraries/register`
- `POST /api/v1/librarians/register`
- `POST /api/v1/students/register`
- `GET /api/v1/admin/libraries`, `PATCH /api/v1/admin/libraries/:id/approve`, `PATCH /api/v1/admin/libraries/:id/reject`
- `GET /api/v1/admin/librarians`, `PATCH /api/v1/admin/librarians/:id/approve`, `PATCH /api/v1/admin/librarians/:id/reject`
- `GET /api/v1/students/me`, `GET /api/v1/libraries/students`
- `GET|POST /api/v1/seats`, `POST /api/v1/seats/:id/assign`, `PATCH /api/v1/seats/:id/release`
- `POST /api/v1/students/:id/fees`, `GET /api/v1/students/me/fees`, `GET /api/v1/fees/pending`
- `POST /api/v1/concerns`, `GET /api/v1/concerns`, `PATCH /api/v1/concerns/:id/resolve`
- `GET|POST /api/v1/communication/posts`, `POST /api/v1/communication/posts/:id/comments`, `PATCH /api/v1/communication/posts/:id/like`
- `DELETE /api/v1/communication/posts/:id`, `DELETE /api/v1/communication/posts/:postId/comments/:commentId`
- `GET|POST /api/v1/communication/notices`, `DELETE /api/v1/communication/notices/:id`

Approving the first librarian automatically creates the requested number of seats. Each seat accepts one student in `SHIFT_1` and one in `SHIFT_2`. A fee is overdue when no payment has been recorded in the previous 30 days (or the student registered more than 30 days ago without a payment).
