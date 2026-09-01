import express from 'express';

import { allow, protect } from '../../../common/guards/auth.guard.js';
import asyncHandler from '../../../common/utils/async-handler.js';
import * as feeService from '../services/fee.service.js';

const router = express.Router();

router.post('/students/:id/fees', protect, allow('LIBRARIAN'), asyncHandler(async (req, res) => {
  const payment = await feeService.record(req.user.libraryId, req.params.id, req.body.amount, req.body.paidAt, req.user.id);
  res.status(201).json(payment);
}));

router.get('/students/me/fees', protect, allow('STUDENT'), asyncHandler(async (req, res) => {
  res.json(await feeService.history(req.user.id));
}));

router.get('/fees/pending', protect, allow('LIBRARIAN'), asyncHandler(async (req, res) => {
  res.json(await feeService.pending(req.user.libraryId));
}));

export default router;
