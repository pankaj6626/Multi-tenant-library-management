import express from 'express';

import { allow, protect } from '../../../common/guards/auth.guard.js';
import asyncHandler from '../../../common/utils/async-handler.js';
import * as notificationService from '../services/notification.service.js';

const router = express.Router();

router.use(protect, allow('ADMIN', 'STUDENT', 'LIBRARIAN'));

router.get('/', asyncHandler(async (req, res) => {
  res.json(await notificationService.list(req.user.id));
}));

router.patch('/:id/read', asyncHandler(async (req, res) => {
  res.json(await notificationService.markRead(req.params.id, req.user.id));
}));

router.patch('/read-all', asyncHandler(async (req, res) => {
  await notificationService.markAllRead(req.user.id);
  res.status(204).end();
}));

export default router;
