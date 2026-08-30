const express = require('express');

const asyncHandler = require('../../../common/utils/async-handler');
const libraryService = require('../services/library.service');

const router = express.Router();

router.post('/register', asyncHandler(async (req, res) => {
  const library = await libraryService.create(req.body);

  res.status(201).json({
    message: 'Library registration submitted for approval',
    library,
  });
}));

module.exports = router;
