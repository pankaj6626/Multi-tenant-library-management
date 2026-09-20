import Seat from '../entities/seat.entity.js';
export default {
  countByLibrary: (library) => Seat.countDocuments({ library }),
  create: (data) => Seat.create(data),
  createMany: (items) => Seat.insertMany(items),
  findByLibrary: (library) =>
    Seat.find({ library }).populate(
      "assignments.student",
      "name mobile createdAt",
    ).sort({ seatNumber: 1 }),
  findOne: (query) => Seat.findOne(query),
  findOneAndUpdate: (query, update) =>
    Seat.findOneAndUpdate(query, update, { new: true, runValidators: true }),
  assign: (library, seatId, student, shift) =>
    Seat.findOneAndUpdate(
      {
        _id: seatId,
        library,
        assignments: { $not: { $elemMatch: { shift } } },
      },
      { $push: { assignments: { student, shift } } },
      { new: true, runValidators: true },
    ),
  removeStudentAssignments: (library, student, exceptSeat) =>
    Seat.updateMany(
      { library, _id: { $ne: exceptSeat }, 'assignments.student': student },
      { $pull: { assignments: { student } } },
    ),
};
