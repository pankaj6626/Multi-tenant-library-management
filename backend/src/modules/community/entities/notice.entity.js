import mongoose from 'mongoose';

export default mongoose.model('Notice', new mongoose.Schema({
  library: { type: mongoose.Schema.Types.ObjectId, ref: 'Library', required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'Librarian', required: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  content: { type: String, required: true, trim: true, maxlength: 2000 },
}, { timestamps: true }));
