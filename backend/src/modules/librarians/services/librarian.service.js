const HttpError = require('../../../common/exceptions/http-error');
const { hashPassword } = require('../../../common/utils/security');
const { publish } = require('../../../events/publishers/event.publisher');
const events = require('../../../events/event-types/domain-events');
const libraryService = require('../../libraries/services/library.service');
const seatRepository = require('../../seats/repositories/seat.repository');
const librarianRepository = require('../repositories/librarian.repository');

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

module.exports = { register, approve, findAll: librarianRepository.findAll, findByEmail: librarianRepository.findByEmail };
