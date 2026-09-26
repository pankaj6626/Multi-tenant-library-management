import mongoose from 'mongoose';

const categoryAmounts = {
  electricity: { type: Number, required: true, min: 0, default: 0 },
  rent: { type: Number, required: true, min: 0, default: 0 },
  internet: { type: Number, required: true, min: 0, default: 0 },
  cleaning: { type: Number, required: true, min: 0, default: 0 },
  staffSalary: { type: Number, required: true, min: 0, default: 0 },
  water: { type: Number, required: true, min: 0, default: 0 },
  maintenance: { type: Number, required: true, min: 0, default: 0 },
  furniture: { type: Number, required: true, min: 0, default: 0 },
  others: { type: Number, required: true, min: 0, default: 0 },
};

const monthlyExpenseSchema = new mongoose.Schema({
  library: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Library',
    required: true,
  },
  month: {
    type: String,
    required: true,
    match: /^\d{4}-(0[1-9]|1[0-2])$/,
  },
  ...categoryAmounts,
  total: { type: Number, required: true, min: 0 },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Librarian',
    required: true,
  },
}, { timestamps: true });

monthlyExpenseSchema.index({ library: 1, month: 1 }, { unique: true });

export default mongoose.model('MonthlyExpense', monthlyExpenseSchema);
