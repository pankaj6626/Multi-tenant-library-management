const mongoose = require("mongoose");
module.exports = mongoose.model(
  "Librarian",
  new mongoose.Schema(
    {
      library: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Library",
        required: true,
      },
      name: { type: String, required: true },
      email: { type: String, required: true, unique: true, lowercase: true },
      passwordHash: { type: String, required: true },
      mobile: { type: String, required: true },
      totalSeats: { type: Number, required: true, min: 1 },
      status: {
        type: String,
        enum: ["PENDING", "APPROVED", "REJECTED"],
        default: "PENDING",
      },
    },
    { timestamps: true },
  ),
);
