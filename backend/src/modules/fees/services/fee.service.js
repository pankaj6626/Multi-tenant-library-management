import HttpError from '../../../common/exceptions/http-error.js';
import * as redis from '../../../config/redis.js';
import { overdue } from '../../seats/services/seat.service.js';
import * as studentRepository from '../../students/repositories/student.repository.js';
import * as feeRepository from '../repositories/fee.repository.js';

const record = async (libraryId, studentId, amount, paidAt, recordedBy) => {
  const student = await studentRepository.findOne({
    _id: studentId,
    library: libraryId,
  });
  if (!student) throw new HttpError("Student not found", 404);

  const payment = await feeRepository.create({
    library: libraryId,
    student: student._id,
    amount,
    paidAt: paidAt || new Date(),
    recordedBy,
  });
  await redis.del(`library:seats:${libraryId}`);
  return payment;
};

const pending = async (libraryId) => {
  const [students, payments] = await Promise.all([
    studentRepository.findByLibrary(libraryId),
    feeRepository.findByLibrary(libraryId),
  ]);
  const latestPaymentByStudent = new Map();
  payments.forEach((payment) => {
    if (!latestPaymentByStudent.has(String(payment.student)))
      latestPaymentByStudent.set(String(payment.student), payment);
  });
  return students
    .filter(
      (student) =>
        overdue(student, latestPaymentByStudent.get(String(student._id)))
          .status === "OVERDUE",
    )
    .map((student) => ({
      student,
      fee: overdue(student, latestPaymentByStudent.get(String(student._id))),
    }));
};

export { record, pending };
export const history = feeRepository.findByStudent;
