import express from 'express';

import { allow, protect } from '../../../common/guards/auth.guard.js';
import asyncHandler from '../../../common/utils/async-handler.js';
import * as studentService from '../services/student.service.js';

const router = express.Router();

router.get('/', protect, allow('LIBRARIAN'), asyncHandler(async (req, res) => {
  res.json(await studentService.findByLibrary(req.user.libraryId));
}));

export default router;
