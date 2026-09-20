import HttpError from '../../../common/exceptions/http-error.js';
import redis from '../../../config/redis.js';
import { overdue } from '../../seats/services/seat.service.js';
import studentRepository from '../../students/repositories/student.repository.js';
import librarianRepository from '../../librarians/repositories/librarian.repository.js';
import * as notificationService from '../../notifications/services/notification.service.js';
import feeRepository from '../repositories/fee.repository.js';

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
  await redis.del(`library:students:${libraryId}`);
  await notificationService.notify({
    recipient: student._id,
    recipientRole: 'STUDENT',
    library: libraryId,
    type: 'PAYMENT_RECORDED',
    title: 'Payment recorded',
    message: `Your payment of ${amount} has been recorded.`,
    eventKey: `payment-recorded:${payment._id}`,
  });
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
  const librarians = await librarianRepository.findByLibrary(libraryId);
  const overdueStudents = students
    .filter(
      (student) =>
        overdue(student, latestPaymentByStudent.get(String(student._id)))
          .status === "OVERDUE",
    );
  return Promise.all(overdueStudents.map(async (student) => {
      const payment = latestPaymentByStudent.get(String(student._id));
      const dueFrom = payment?.paidAt || student.createdAt;
      const eventKey = `fee-overdue:${student._id}:${new Date(dueFrom).getTime()}`;
      const notification = {
        library: libraryId,
        type: 'FEE_OVERDUE',
        title: 'Fee timeline passed',
        message: `${student.name}'s fee has passed the 30-day timeline.`,
      };
      await notificationService.notify({
        ...notification,
        recipient: student._id,
        recipientRole: 'STUDENT',
        eventKey: `${eventKey}:student`,
      });
      await notificationService.notifyMany(librarians.map(({ _id: recipient }) => recipient), {
        ...notification,
        recipientRole: 'LIBRARIAN',
        eventKey: `${eventKey}:librarian`,
      });
      return { student, fee: overdue(student, payment) };
    }));
};

export { record, pending };
export const history = feeRepository.findByStudent;
