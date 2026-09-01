import express from 'express';

import { protect } from '../../../common/guards/auth.guard.js';
import asyncHandler from '../../../common/utils/async-handler.js';
import * as authService from '../services/auth.service.js';

const router = express.Router();

router.post('/login', asyncHandler(async (req, res) => {
  const session = await authService.login(req.body);
  res.json(session);
}));

router.post('/refresh', protect, (req, res) => {
  res.json(authService.refresh(req.user));
});

router.post('/logout', protect, (_req, res) => {
  res.status(204).end();
});

export default router;
