import mongoose from 'mongoose';

export default mongoose.model(
  'StudentHistory',
  new mongoose.Schema(
    {
      library: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Library',
        required: true,
        index: true,
      },
      student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true,
      },
      name: { type: String, required: true },
      email: { type: String, required: true },
      mobile: { type: String, required: true },
      joinedAt: { type: Date, required: true },
      leftAt: { type: Date, required: true, default: Date.now },
    },
    { timestamps: true },
  ),
);
