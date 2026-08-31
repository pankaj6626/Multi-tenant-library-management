const mongoose = require("mongoose");
const assignment = new mongoose.Schema(
  {
    shift: { type: String, enum: ["SHIFT_1", "SHIFT_2"], required: true },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
  },
  { _id: false },
);
module.exports = mongoose.model(
  "Seat",
  new mongoose.Schema(
    {
      library: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Library",
        required: true,
      },
      seatNumber: { type: String, required: true },
      assignments: [assignment],
    },
    { timestamps: true },
  ),
);
