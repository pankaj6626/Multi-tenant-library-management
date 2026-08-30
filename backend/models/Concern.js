const mongoose = require('mongoose');
module.exports = mongoose.model('Concern', new mongoose.Schema({
  library: { type: mongoose.Schema.Types.ObjectId, ref: 'Library', required: true }, student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  message: { type: String, required: true, trim: true }, status: { type: String, enum: ['OPEN', 'RESOLVED'], default: 'OPEN' }
}, { timestamps: true }));
