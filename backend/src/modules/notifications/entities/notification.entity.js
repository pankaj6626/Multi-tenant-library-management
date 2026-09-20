import mongoose from 'mongoose';

export default mongoose.model(
  'Notification',
  new mongoose.Schema(
    {
      recipient: { type: String, required: true },
      recipientRole: { type: String, enum: ['ADMIN', 'STUDENT', 'LIBRARIAN'], required: true },
      library: { type: mongoose.Schema.Types.ObjectId, required: true },
      type: { type: String, required: true },
      title: { type: String, required: true },
      message: { type: String, required: true },
      eventKey: { type: String, required: true, unique: true },
      readAt: { type: Date, default: null },
    },
    { timestamps: true },
  ),
);
