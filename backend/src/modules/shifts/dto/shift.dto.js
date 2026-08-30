const validShifts = ['SHIFT_1', 'SHIFT_2'];
const assertShift = (shift) => validShifts.includes(shift);
module.exports = { validShifts, assertShift };
