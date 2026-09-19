import express from 'express';

import asyncHandler from '../../../common/utils/async-handler.js';
import * as libraryService from '../services/library.service.js';

const router = express.Router();

router.post('/register', asyncHandler(async (req, res) => {
  const library = await libraryService.create(req.body);

  res.status(201).json({
    message: 'Library registration submitted for approval',
    library,
  });
}));

export default router;
