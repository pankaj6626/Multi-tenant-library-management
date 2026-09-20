import HttpError from '../../../common/exceptions/http-error.js';
import { hashPassword } from '../../../common/utils/security.js';
import { publish } from '../../../events/publishers/event.publisher.js';
import events from '../../../events/event-types/domain-events.js';
import * as libraryService from '../../libraries/services/library.service.js';
import seatRepository from '../../seats/repositories/seat.repository.js';
import librarianRepository from '../repositories/librarian.repository.js';
import * as notificationService from '../../notifications/services/notification.service.js';

const register = async ({ libraryCode, name, email, password, confirmPassword, mobile, totalSeats }) => {
  if (password !== confirmPassword) {
    throw new HttpError('Passwords do not match. Please enter the same password in both fields.', 400);
  }
  const library = await libraryService.findApprovedByCode(libraryCode);
  const librarian = await librarianRepository.create({ library: library._id, name, email, passwordHash: hashPassword(password), mobile, totalSeats });
  await notificationService.notify({
    recipient: 'admin',
    recipientRole: 'ADMIN',
    library: library._id,
    type: 'LIBRARIAN_REGISTERED',
    title: 'New librarian registration',
    message: `${librarian.name} submitted a librarian registration for review.`,
    eventKey: `librarian-registered:${librarian._id}:admin`,
  });
  publish(events.LIBRARIAN_REGISTERED, { librarianId: librarian._id });
  return librarian;
};

const approve = async (librarianId) => {
  const librarian = await librarianRepository.findById(librarianId);
  if (!librarian) throw new HttpError('Librarian not found', 404);

  librarian.status = 'APPROVED';
  await librarianRepository.save(librarian);

  await notificationService.notify({
    recipient: String(librarian._id),
    recipientRole: 'LIBRARIAN',
    library: librarian.library,
    type: 'LIBRARIAN_APPROVED',
    title: 'Registration approved',
    message: 'Your librarian registration has been approved. You can now access your dashboard.',
    eventKey: `librarian-approved:${librarian._id}`,
  });

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
