const express = require('express');

const { allow, protect } = require('../../../common/guards/auth.guard');
const asyncHandler = require('../../../common/utils/async-handler');
const libraryService = require('../services/library.service');

const router = express.Router();

router.use(protect, allow('ADMIN'));

router.get('/', asyncHandler(async (_req, res) => {
  res.json(await libraryService.findAll());
}));

router.patch('/:id/approve', asyncHandler(async (req, res) => {
  const library = await libraryService.approve(req.params.id);
  res.json({ message: 'Library approved', library });
}));

router.patch('/:id/reject', asyncHandler(async (req, res) => {
  const library = await libraryService.reject(req.params.id);
  res.json({ message: 'Library rejected', library });
}));

module.exports = router;
