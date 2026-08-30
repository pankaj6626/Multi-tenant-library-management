const express = require('express');

const { allow, protect } = require('../../../common/guards/auth.guard');
const asyncHandler = require('../../../common/utils/async-handler');
const concernService = require('../services/concern.service');

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
  res.json(await concernService.resolve(req.params.id, req.user.libraryId));
}));

module.exports = router;
