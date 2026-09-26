import MonthlyExpense from '../entities/monthly-expense.entity.js';

const listByLibrary = (library) => MonthlyExpense.find({ library }).sort({ month: -1 });
const saveForMonth = (library, month, data) => MonthlyExpense.findOneAndUpdate(
  { library, month },
  { $set: data, $setOnInsert: { library, month } },
  { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
);

export { listByLibrary, saveForMonth };
