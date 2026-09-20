import HttpError from '../../../common/exceptions/http-error.js';
import { hashPassword } from '../../../common/utils/security.js';
import redis from '../../../config/redis.js';
import * as concernRepository from '../../concerns/repositories/concern.repository.js';
import feeRepository from '../../fees/repositories/fee.repository.js';
import * as libraryService from '../../libraries/services/library.service.js';
import librarianRepository from '../../librarians/repositories/librarian.repository.js';
import * as notificationService from '../../notifications/services/notification.service.js';
import seatRepository from '../../seats/repositories/seat.repository.js';
import studentRepository from '../repositories/student.repository.js';
import * as studentHistoryRepository from '../repositories/student-history.repository.js';

const register = async ({ libraryCode, name, email, password, confirmPassword, mobile }) => {
  if (password !== confirmPassword) {
    throw new HttpError('Passwords do not match. Please enter the same password in both fields.', 400);
  }
  const library = await libraryService.findApprovedByCode(libraryCode);
  const student = await studentRepository.create({ library: library._id, name, email, passwordHash: hashPassword(password), mobile });
  await redis.del(`library:students:${library._id}`);
  const librarians = await librarianRepository.findByLibrary(library._id);
  await notificationService.notifyMany(librarians.map(({ _id: recipient }) => recipient), {
    recipientRole: 'LIBRARIAN',
    library: library._id,
    type: 'STUDENT_REGISTERED',
    title: 'New student registration',
    message: `${student.name} registered for your library.`,
    eventKey: `student-registered:${student._id}:librarian`,
  });
  return student;
};

const findByLibrary = async (library) => {
  const key = `library:students:${library}`;
  const cached = await redis.get(key);
  if (cached) return cached;
  const students = await studentRepository.findByLibrary(library);
  const payments = await feeRepository.findByStudents(students.map((student) => student._id));
  const latestPaymentByStudent = new Map();
  payments.forEach((payment) => {
    if (!latestPaymentByStudent.has(String(payment.student))) {
      latestPaymentByStudent.set(String(payment.student), payment);
    }
  });
  const result = students.map((student) => {
    const { passwordHash, ...safeStudent } = student.toObject();
    return {
      ...safeStudent,
      lastPaymentDate: latestPaymentByStudent.get(String(student._id))?.paidAt || null,
    };
  });
  await redis.set(key, result, 300);
  return result;
};

const profile = async (studentId) => {
  const student = await studentRepository.findProfile(studentId);
  const history = await studentHistoryRepository.findByStudent(studentId);
  if (!student || history) {
    throw new HttpError('You are no longer part of this library', 403);
  }

  const [seat, payments, concerns] = await Promise.all([
    seatRepository.findOne({ 'assignments.student': student._id }),
    feeRepository.findByStudent(student._id),
    concernRepository.findByStudent(student._id),
  ]);
  const latestPayment = payments[0];
  const feeDueFrom = latestPayment?.paidAt || student.createdAt;
  if (new Date(feeDueFrom) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
    await notificationService.notify({
      recipient: student._id,
      recipientRole: 'STUDENT',
      library: student.library._id,
      type: 'FEE_OVERDUE',
      title: 'Fee timeline passed',
      message: 'Your fee has passed the 30-day timeline.',
      eventKey: `fee-overdue:${student._id}:${new Date(feeDueFrom).getTime()}:student`,
    });
  }
  return { student, seat, payments, concerns };
};

const hasSeatAssignment = async (studentId, libraryId) => Boolean(
  await seatRepository.findOne({
    library: libraryId,
    'assignments.student': studentId,
  }),
);

const findHistoryByLibrary = (libraryId) => studentHistoryRepository.findByLibrary(libraryId);

const removeUnassigned = async (libraryId, studentId) => {
  const student = await studentRepository.findOne({ _id: studentId, library: libraryId });
  if (!student) throw new HttpError('Student not found', 404);

  const assignedSeat = await seatRepository.findOne({
    library: libraryId,
    'assignments.student': studentId,
  });
  if (assignedSeat) throw new HttpError('Release the student seat assignment before removing the student', 409);

  await studentHistoryRepository.create({
    library: libraryId,
    student: student._id,
    name: student.name,
    email: student.email,
    mobile: student.mobile,
    joinedAt: student.createdAt,
    leftAt: new Date(),
  });
  await studentRepository.deleteOne({ _id: studentId, library: libraryId });
  await redis.del(`library:students:${libraryId}`);
  return { removed: true };
};

export { register, profile, findByLibrary, hasSeatAssignment, findHistoryByLibrary, removeUnassigned };
export const findByEmail = studentRepository.findByEmail;
export const findOne = studentRepository.findOne;
