import Seat from '../entities/seat.entity.js';
export default {
  countByLibrary: (library) => Seat.countDocuments({ library }),
  create: (data) => Seat.create(data),
  createMany: (items) => Seat.insertMany(items),
  findByLibrary: (library) =>
    Seat.find({ library }).populate(
      "assignments.student",
      "name mobile createdAt",
    ),
  findOne: (query) => Seat.findOne(query),
  findOneAndUpdate: (query, update) =>
    Seat.findOneAndUpdate(query, update, { new: true }),
  removeStudentAssignments: (library, student) =>
    Seat.updateMany({ library }, { $pull: { assignments: { student } } }),
};
