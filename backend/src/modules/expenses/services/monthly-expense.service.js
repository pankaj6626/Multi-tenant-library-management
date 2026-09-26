import HttpError from '../../../common/exceptions/http-error.js';
import * as repository from '../repositories/monthly-expense.repository.js';

const categories = [
  'electricity',
  'rent',
  'internet',
  'cleaning',
  'staffSalary',
  'water',
  'maintenance',
  'furniture',
  'others',
];

const list = (libraryId) => repository.listByLibrary(libraryId);

const save = async (libraryId, recordedBy, month, amounts) => {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new HttpError('Month must use YYYY-MM format', 400, 'INVALID_EXPENSE_MONTH');
  }
  if (!amounts || typeof amounts !== 'object' || Array.isArray(amounts)) {
    throw new HttpError('Expense amounts are required', 400, 'INVALID_EXPENSE_AMOUNTS');
  }

  const normalizedAmounts = {};
  for (const category of categories) {
    const amount = Number(amounts[category] ?? 0);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new HttpError(`${category} must be a non-negative amount`, 400, 'INVALID_EXPENSE_AMOUNT');
    }
    normalizedAmounts[category] = amount;
  }

  const total = categories.reduce((sum, category) => sum + normalizedAmounts[category], 0);
  return repository.saveForMonth(libraryId, month, {
    ...normalizedAmounts,
    total,
    recordedBy,
  });
};

export { list, save, categories };
