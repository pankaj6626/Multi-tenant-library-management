import 'dotenv/config';

import crypto from 'crypto';
import cors from 'cors';
import express from 'express';

import connectDatabase from './config/database.js';
import redis from './config/redis.js';
import errorHandler from './common/middleware/error-handler.js';
import authController from './modules/auth/controllers/auth.controller.js';
import libraryController from './modules/libraries/controllers/library.controller.js';
import adminLibraryController from './modules/libraries/controllers/admin-library.controller.js';
import librarianController from './modules/librarians/controllers/librarian.controller.js';
import adminLibrarianController from './modules/librarians/controllers/admin-librarian.controller.js';
import studentController from './modules/students/controllers/student.controller.js';
import libraryStudentController from './modules/students/controllers/library-student.controller.js';
import seatController from './modules/seats/controllers/seat.controller.js';
import feeController from './modules/fees/controllers/fee.controller.js';
import concernController from './modules/concerns/controllers/concern.controller.js';
import communityController from './modules/community/controllers/community.controller.js';
import notificationController from './modules/notifications/controllers/notification.controller.js';

import './events/consumers/audit.consumer.js';

const app = express();
const apiPrefix = '/api/v1';

app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
});

const configuredOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);
const allowedOrigins = [
  ...configuredOrigins,
  ...(process.env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:5173', 'http://127.0.0.1:5173']),
];

if (process.env.NODE_ENV === 'production' && !configuredOrigins.length) {
  console.warn('[CORS] FRONTEND_URL is not configured; browser requests will be rejected.');
}

app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origin is not allowed by CORS'));
  },
}));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(`${apiPrefix}/auth`, authController);
app.use(`${apiPrefix}/libraries/students`, libraryStudentController);
app.use(`${apiPrefix}/libraries`, libraryController);
app.use(`${apiPrefix}/admin/libraries`, adminLibraryController);
app.use(`${apiPrefix}/librarians`, librarianController);
app.use(`${apiPrefix}/admin/librarians`, adminLibrarianController);
app.use(`${apiPrefix}/students`, studentController);
app.use(`${apiPrefix}/seats`, seatController);
app.use(apiPrefix, feeController);
app.use(`${apiPrefix}/concerns`, concernController);
app.use(`${apiPrefix}/communication`, communityController);
app.use(`${apiPrefix}/notifications`, notificationController);

app.use(errorHandler);

connectDatabase().then(async () => {
  await redis.checkConnection();
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`API running on port ${port}`));
});
