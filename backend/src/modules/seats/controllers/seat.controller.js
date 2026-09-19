import express from 'express';

import { allow, protect } from '../../../common/guards/auth.guard.js';
import asyncHandler from '../../../common/utils/async-handler.js';
import * as seatService from '../services/seat.service.js';

const router = express.Router();

router.use(protect, allow('LIBRARIAN'));

router.get('/', asyncHandler(async (req, res) => {
  res.json(await seatService.list(req.user.libraryId));
}));

router.post('/', asyncHandler(async (req, res) => {
  const seat = await seatService.create(req.user.libraryId, req.body.seatNumber);
  res.status(201).json(seat);
}));

router.post('/:id/assign', asyncHandler(async (req, res) => {
  const seat = await seatService.assign(req.user.libraryId, req.params.id, req.body.studentId, req.body.shift);
  res.json(seat);
}));

router.patch('/:id/release', asyncHandler(async (req, res) => {
  const seat = await seatService.release(req.user.libraryId, req.params.id, req.body.shift);
  if (!seat) return res.status(404).json({ message: 'Seat not found' });
  res.json(seat);
}));

export default router;
