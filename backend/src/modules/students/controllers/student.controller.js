const express = require('express');

const { allow, protect } = require('../../../common/guards/auth.guard');
const asyncHandler = require('../../../common/utils/async-handler');
const studentService = require('../services/student.service');

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

module.exports = router;
