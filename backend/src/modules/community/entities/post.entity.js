import mongoose from 'mongoose';

const comment = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, refPath: 'comments.authorModel', required: true },
  authorModel: { type: String, enum: ['Student', 'Librarian'], default: 'Student', required: true },
  message: { type: String, required: true, trim: true },
}, { timestamps: true });

export default mongoose.model('Post', new mongoose.Schema({
  library: { type: mongoose.Schema.Types.ObjectId, ref: 'Library', required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  title: { type: String, trim: true, maxlength: 120 },
  content: { type: String, required: true, trim: true, maxlength: 2000 },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  comments: [comment],
}, { timestamps: true }));
