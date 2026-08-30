const HttpError = require('../../../common/exceptions/http-error');
const concernRepository = require('../../concerns/repositories/concern.repository');
const feeRepository = require('../../fees/repositories/fee.repository');
const studentRepository = require('../../students/repositories/student.repository');
const seatRepository = require('../repositories/seat.repository');

const overdue = (student, payment) => ({
  status: (payment ? payment.paidAt : student.createdAt) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    ? 'OVERDUE'
    : 'PAID',
  lastPaymentDate: payment?.paidAt || null,
});

const list = async (libraryId) => {
  const seats = await seatRepository.findByLibrary(libraryId);
  const studentIds = seats.flatMap((seat) => seat.assignments.map((assignment) => assignment.student._id));

  const [payments, openConcerns] = await Promise.all([
    feeRepository.findByStudents(studentIds),
    concernRepository.findOpenByStudents(studentIds),
  ]);

  const latestPaymentByStudent = new Map();
  const studentsWithOpenConcerns = new Set(openConcerns.map((concern) => String(concern.student)));

  payments.forEach((payment) => {
    if (!latestPaymentByStudent.has(String(payment.student))) {
      latestPaymentByStudent.set(String(payment.student), payment);
    }
  });

  return seats.map((seat) => ({
    ...seat.toObject(),
    assignments: seat.assignments.map((assignment) => {
      const hasOpenConcern = studentsWithOpenConcerns.has(String(assignment.student._id));
      const student = assignment.student.toObject();

      return {
        ...assignment.toObject(),
        student: {
          ...student,
          // Unicode escape prevents Windows source encoding from corrupting the emoji.
          name: hasOpenConcern ? `${student.name} \u{1F64B}` : student.name,
        },
        fee: overdue(assignment.student, latestPaymentByStudent.get(String(assignment.student._id))),
        hasOpenConcern,
      };
    }),
  }));
};

const create = (libraryId, seatNumber) => seatRepository.create({
  library: libraryId,
  seatNumber,
});

const assign = async (libraryId, seatId, studentId, shift) => {
  const seat = await seatRepository.findOne({ _id: seatId, library: libraryId });
  const student = await studentRepository.findOne({ _id: studentId, library: libraryId });

  if (!seat || !student) throw new HttpError('Seat or student not found', 404);
  if (!['SHIFT_1', 'SHIFT_2'].includes(shift)) throw new HttpError('shift must be SHIFT_1 or SHIFT_2');
  if (seat.assignments.some((assignment) => assignment.shift === shift)) {
    throw new HttpError('This shift is already occupied', 409);
  }

  await seatRepository.removeStudentAssignments(libraryId, student._id);
  seat.assignments.push({ student: student._id, shift });
  return seat.save();
};

const release = (libraryId, seatId, shift) => seatRepository.findOneAndUpdate(
  { _id: seatId, library: libraryId },
  { $pull: { assignments: { shift } } },
);

module.exports = { list, create, assign, release, overdue };
