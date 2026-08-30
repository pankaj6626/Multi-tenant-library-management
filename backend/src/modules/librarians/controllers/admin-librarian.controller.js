const express = require('express');

const { allow, protect } = require('../../../common/guards/auth.guard');
const asyncHandler = require('../../../common/utils/async-handler');
const librarianService = require('../services/librarian.service');

const router = express.Router();

router.use(protect, allow('ADMIN'));

router.get('/', asyncHandler(async (_req, res) => {
  res.json(await librarianService.findAll());
}));

router.patch('/:id/approve', asyncHandler(async (req, res) => {
  const librarian = await librarianService.approve(req.params.id);
  res.json({ message: 'Librarian approved and seats created', librarian });
}));

module.exports = router;
