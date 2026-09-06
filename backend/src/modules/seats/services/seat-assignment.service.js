import HttpError from '../../../common/exceptions/http-error.js';

const createSeatAssignmentService = ({ seatRepository, studentRepository, seatCache }) => {
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
    const result = await seat.save();
    await seatCache.invalidate(libraryId);
    return result;
  };

  const release = async (libraryId, seatId, shift) => {
    const result = await seatRepository.findOneAndUpdate(
      { _id: seatId, library: libraryId },
      { $pull: { assignments: { shift } } },
    );
    if (result) await seatCache.invalidate(libraryId);
    return result;
  };

  return { assign, release };
};

export default createSeatAssignmentService;
