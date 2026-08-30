const express = require('express');

const { allow, protect } = require('../../../common/guards/auth.guard');
const asyncHandler = require('../../../common/utils/async-handler');
const studentService = require('../services/student.service');

const router = express.Router();

router.get('/', protect, allow('LIBRARIAN'), asyncHandler(async (req, res) => {
  res.json(await studentService.findByLibrary(req.user.libraryId));
}));

module.exports = router;
