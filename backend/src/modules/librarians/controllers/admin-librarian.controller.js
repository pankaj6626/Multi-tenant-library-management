import express from 'express';

import { allow, protect } from '../../../common/guards/auth.guard.js';
import asyncHandler from '../../../common/utils/async-handler.js';
import * as librarianService from '../services/librarian.service.js';

const router = express.Router();

router.use(protect, allow('ADMIN'));

router.get('/', asyncHandler(async (_req, res) => {
  res.json(await librarianService.findAll());
}));

router.patch('/:id/approve', asyncHandler(async (req, res) => {
  const librarian = await librarianService.approve(req.params.id);
  res.json({ message: 'Librarian approved and seats created', librarian });
}));

router.patch('/:id/reject', asyncHandler(async (req, res) => {
  const librarian = await librarianService.reject(req.params.id);
  res.json({ message: 'Librarian rejected', librarian });
}));

export default router;
