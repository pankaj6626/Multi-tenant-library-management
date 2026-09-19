import express from 'express';

import { allow, protect } from '../../../common/guards/auth.guard.js';
import asyncHandler from '../../../common/utils/async-handler.js';
import * as libraryService from '../services/library.service.js';

const router = express.Router();

router.use(protect, allow('ADMIN'));

router.get('/', asyncHandler(async (_req, res) => {
  res.json(await libraryService.findAll());
}));

router.patch('/:id/approve', asyncHandler(async (req, res) => {
  const library = await libraryService.approve(req.params.id);
  res.json({ message: 'Library approved', library });
}));

router.patch('/:id/reject', asyncHandler(async (req, res) => {
  const library = await libraryService.reject(req.params.id);
  res.json({ message: 'Library rejected', library });
}));

export default router;
