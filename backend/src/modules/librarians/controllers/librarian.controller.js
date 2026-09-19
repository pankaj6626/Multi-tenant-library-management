import express from 'express';

import asyncHandler from '../../../common/utils/async-handler.js';
import * as librarianService from '../services/librarian.service.js';

const router = express.Router();

router.post('/register', asyncHandler(async (req, res) => {
  const librarian = await librarianService.register(req.body);

  res.status(201).json({
    message: 'Librarian registration submitted for approval',
    librarian: { id: librarian._id, status: librarian.status },
  });
}));

export default router;
