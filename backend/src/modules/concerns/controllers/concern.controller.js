import express from 'express';

import { allow, protect } from '../../../common/guards/auth.guard.js';
import asyncHandler from '../../../common/utils/async-handler.js';
import * as concernService from '../services/concern.service.js';

const router = express.Router();

router.post('/', protect, allow('STUDENT'), asyncHandler(async (req, res) => {
  const concern = await concernService.create({
    library: req.user.libraryId,
    student: req.user.id,
    message: req.body.message,
  });
  res.status(201).json(concern);
}));

router.get('/', protect, allow('LIBRARIAN'), asyncHandler(async (req, res) => {
  res.json(await concernService.findByLibrary(req.user.libraryId));
}));

router.patch('/:id/resolve', protect, allow('LIBRARIAN'), asyncHandler(async (req, res) => {
  const concern = await concernService.resolve(req.params.id, req.user.libraryId);
  res.json(concern);
}));

export default router;
