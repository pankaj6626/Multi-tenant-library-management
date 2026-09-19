import mongoose from 'mongoose';
export default mongoose.model(
  "FeePayment",
  new mongoose.Schema(
    {
      library: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Library",
        required: true,
      },
      student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student",
        required: true,
      },
      amount: { type: Number, required: true, min: 0 },
      paidAt: { type: Date, required: true },
      recordedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Librarian",
        required: true,
      },
    },
    { timestamps: true },
  ),
);
