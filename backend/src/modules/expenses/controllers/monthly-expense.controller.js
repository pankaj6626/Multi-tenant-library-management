import express from 'express';

import { allow, protect } from '../../../common/guards/auth.guard.js';
import asyncHandler from '../../../common/utils/async-handler.js';
import * as service from '../services/monthly-expense.service.js';

const router = express.Router();
router.use(protect, allow('LIBRARIAN'));

router.get('/', asyncHandler(async (req, res) => {
  res.json(await service.list(req.user.libraryId));
}));

router.put('/:month', asyncHandler(async (req, res) => {
  res.json(await service.save(
    req.user.libraryId,
    req.user.id,
    req.params.month,
    req.body.amounts,
  ));
}));

export default router;
