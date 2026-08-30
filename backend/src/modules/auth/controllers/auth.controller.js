const express = require('express');

const { protect } = require('../../../common/guards/auth.guard');
const asyncHandler = require('../../../common/utils/async-handler');
const authService = require('../services/auth.service');

const router = express.Router();

router.post('/login', asyncHandler(async (req, res) => {
  const session = await authService.login(req.body);
  res.json(session);
}));

router.post('/refresh', protect, (req, res) => {
  res.json(authService.refresh(req.user));
});

router.post('/logout', protect, (_req, res) => {
  res.status(204).end();
});

module.exports = router;
