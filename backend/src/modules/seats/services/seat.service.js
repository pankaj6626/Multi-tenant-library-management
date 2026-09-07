import redis from '../../../config/redis.js';
import * as concernRepository from '../../concerns/repositories/concern.repository.js';
import feeRepository from '../../fees/repositories/fee.repository.js';
import studentRepository from '../../students/repositories/student.repository.js';
import seatRepository from '../repositories/seat.repository.js';
import createSeatAssignmentService from './seat-assignment.service.js';
import createSeatCache from './seat-cache.service.js';
import createSeatStatusService from './seat-status.service.js';

const seatCache = createSeatCache(redis);
const seatStatus = createSeatStatusService({ feeRepository, concernRepository });
const seatAssignment = createSeatAssignmentService({ seatRepository, studentRepository, seatCache });

const sortSeats = (seats) => [...seats].sort((left, right) =>
  String(left.seatNumber).localeCompare(String(right.seatNumber), undefined, { numeric: true }),
);

const list = async (libraryId) => {
  const cached = await seatCache.get(libraryId);
  if (cached) return sortSeats(cached);
  const seats = await seatRepository.findByLibrary(libraryId);
  const result = sortSeats(await seatStatus.enrich(seats));
  await seatCache.set(libraryId, result);
  return result;
};

const create = async (libraryId, seatNumber) => {
  const seat = await seatRepository.create({
    library: libraryId,
    seatNumber,
  });
  await seatCache.invalidate(libraryId);
  return seat;
};

const { assign, release } = seatAssignment;
const overdue = seatStatus.overdue;

export { list, create, assign, release, overdue };
