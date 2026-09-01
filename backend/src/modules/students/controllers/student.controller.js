import express from 'express';

import { allow, protect } from '../../../common/guards/auth.guard.js';
import asyncHandler from '../../../common/utils/async-handler.js';
import * as studentService from '../services/student.service.js';

const router = express.Router();

router.post('/register', asyncHandler(async (req, res) => {
  const student = await studentService.register(req.body);
  res.status(201).json({
    message: 'Student registered successfully',
    student: { id: student._id, status: student.status },
  });
}));

router.get('/me', protect, allow('STUDENT'), asyncHandler(async (req, res) => {
  res.json(await studentService.profile(req.user.id));
}));

export default router;
