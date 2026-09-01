import { hashPassword } from '../../../common/utils/security.js';
import redis from '../../../config/redis.js';
import * as concernRepository from '../../concerns/repositories/concern.repository.js';
import * as feeRepository from '../../fees/repositories/fee.repository.js';
import * as libraryService from '../../libraries/services/library.service.js';
import * as seatRepository from '../../seats/repositories/seat.repository.js';
import * as studentRepository from '../repositories/student.repository.js';

const register = async ({ libraryCode, name, email, password, mobile }) => {
  const library = await libraryService.findApprovedByCode(libraryCode);
  const student = await studentRepository.create({ library: library._id, name, email, passwordHash: hashPassword(password), mobile });
  await redis.del(`library:students:${library._id}`);
  return student;
};

const findByLibrary = async (library) => {
  const key = `library:students:${library}`;
  const cached = await redis.get(key);
  if (cached) return cached;
  const students = await studentRepository.findByLibrary(library);
  const result = students.map((student) => student.toObject());
  await redis.set(key, result, 300);
  return result;
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

export { register, profile, findByLibrary };
export const findByEmail = studentRepository.findByEmail;
export const findOne = studentRepository.findOne;
