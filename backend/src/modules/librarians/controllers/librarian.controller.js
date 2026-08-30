const express = require('express');

const asyncHandler = require('../../../common/utils/async-handler');
const librarianService = require('../services/librarian.service');

const router = express.Router();

router.post('/register', asyncHandler(async (req, res) => {
  const librarian = await librarianService.register(req.body);

  res.status(201).json({
    message: 'Librarian registration submitted for approval',
    librarian: { id: librarian._id, status: librarian.status },
  });
}));

module.exports = router;
