const { hashPassword } = require('../../../common/utils/security');
const concernRepository = require('../../concerns/repositories/concern.repository');
const feeRepository = require('../../fees/repositories/fee.repository');
const libraryService = require('../../libraries/services/library.service');
const seatRepository = require('../../seats/repositories/seat.repository');
const studentRepository = require('../repositories/student.repository');

const register = async ({ libraryCode, name, email, password, mobile }) => {
  const library = await libraryService.findApprovedByCode(libraryCode);
  return studentRepository.create({ library: library._id, name, email, passwordHash: hashPassword(password), mobile });
};

const profile = async (studentId) => {
  const student = await studentRepository.findProfile(studentId);
  const [seat, payments, concerns] = await Promise.all([
    seatRepository.findOne({ 'assignments.student': student._id }),
    feeRepository.findByStudent(student._id),
    concernRepository.findByStudent(student._id),
  ]);
  return { student, seat, payments, concerns };
};

module.exports = { register, profile, findByLibrary: studentRepository.findByLibrary, findByEmail: studentRepository.findByEmail, findOne: studentRepository.findOne };
