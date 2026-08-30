const HttpError = require('../../../common/exceptions/http-error');
const redis = require('../../../config/redis');
const { overdue } = require('../../seats/services/seat.service');
const studentRepository = require('../../students/repositories/student.repository');
const feeRepository = require('../repositories/fee.repository');

const record = async (libraryId, studentId, amount, paidAt, recordedBy) => {
  const student = await studentRepository.findOne({ _id: studentId, library: libraryId });
  if (!student) throw new HttpError('Student not found', 404);

  const payment = await feeRepository.create({ library: libraryId, student: student._id, amount, paidAt: paidAt || new Date(), recordedBy });
  await redis.del(`library:seats:${libraryId}`);
  return payment;
};

const pending = async (libraryId) => {
  const [students, payments] = await Promise.all([studentRepository.findByLibrary(libraryId), feeRepository.findByLibrary(libraryId)]);
  const latestPaymentByStudent = new Map();
  payments.forEach((payment) => { if (!latestPaymentByStudent.has(String(payment.student))) latestPaymentByStudent.set(String(payment.student), payment); });
  return students.filter((student) => overdue(student, latestPaymentByStudent.get(String(student._id))).status === 'OVERDUE').map((student) => ({ student, fee: overdue(student, latestPaymentByStudent.get(String(student._id))) }));
};

module.exports = { record, pending, history: feeRepository.findByStudent };
