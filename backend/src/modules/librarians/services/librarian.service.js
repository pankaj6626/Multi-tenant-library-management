import HttpError from '../../../common/exceptions/http-error.js';
import { hashPassword } from '../../../common/utils/security.js';
import { publish } from '../../../events/publishers/event.publisher.js';
import events from '../../../events/event-types/domain-events.js';
import * as libraryService from '../../libraries/services/library.service.js';
import seatRepository from '../../seats/repositories/seat.repository.js';
import librarianRepository from '../repositories/librarian.repository.js';

const register = async ({ libraryCode, name, email, password, mobile, totalSeats }) => {
  const library = await libraryService.findApprovedByCode(libraryCode);
  const librarian = await librarianRepository.create({ library: library._id, name, email, passwordHash: hashPassword(password), mobile, totalSeats });
  publish(events.LIBRARIAN_REGISTERED, { librarianId: librarian._id });
  return librarian;
};

const approve = async (librarianId) => {
  const librarian = await librarianRepository.findById(librarianId);
  if (!librarian) throw new HttpError('Librarian not found', 404);

  librarian.status = 'APPROVED';
  await librarianRepository.save(librarian);

  const seatsExist = await seatRepository.countByLibrary(librarian.library);
  if (!seatsExist) {
    const seats = Array.from({ length: librarian.totalSeats }, (_, index) => ({ library: librarian.library, seatNumber: `A${String(index + 1).padStart(2, '0')}` }));
    await seatRepository.createMany(seats);
  }

  publish(events.LIBRARIAN_APPROVED, { librarianId: librarian._id });
  return librarian;
};

const reject = async (librarianId) => {
  const librarian = await librarianRepository.findById(librarianId);
  if (!librarian) throw new HttpError('Librarian not found', 404);

  librarian.status = 'REJECTED';
  await librarianRepository.save(librarian);
  publish(events.LIBRARIAN_REJECTED, { librarianId: librarian._id });
  return librarian;
};

export { register, approve, reject };
export const findAll = librarianRepository.findAll;
export const findByEmail = librarianRepository.findByEmail;
