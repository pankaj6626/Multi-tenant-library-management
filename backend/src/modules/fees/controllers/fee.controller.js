const express = require('express');

const { allow, protect } = require('../../../common/guards/auth.guard');
const asyncHandler = require('../../../common/utils/async-handler');
const feeService = require('../services/fee.service');

const router = express.Router();

router.post('/students/:id/fees', protect, allow('LIBRARIAN'), asyncHandler(async (req, res) => {
  const payment = await feeService.record(req.user.libraryId, req.params.id, req.body.amount, req.body.paidAt, req.user.id);
  res.status(201).json(payment);
}));

router.get('/students/me/fees', protect, allow('STUDENT'), asyncHandler(async (req, res) => {
  res.json(await feeService.history(req.user.id));
}));

router.get('/fees/pending', protect, allow('LIBRARIAN'), asyncHandler(async (req, res) => {
  res.json(await feeService.pending(req.user.libraryId));
}));

module.exports = router;
