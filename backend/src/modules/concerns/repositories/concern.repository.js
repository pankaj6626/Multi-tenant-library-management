import Concern from '../entities/concern.entity.js';

const create = (data) => Concern.create(data);

const findByStudent = (studentId) => Concern.find({ student: studentId }).sort('-createdAt');

const findByLibrary = (libraryId) => Concern.find({ library: libraryId })
  .populate('student', 'name mobile')
  .sort('-createdAt');

const findOpenByStudents = (studentIds) => Concern.find({
  student: { $in: studentIds },
  status: 'OPEN',
}).select('student');

const resolve = (concernId, libraryId) => Concern.findOneAndUpdate(
  { _id: concernId, library: libraryId },
  { status: 'RESOLVED' },
  { new: true },
);

export { create, findByStudent, findByLibrary, findOpenByStudents, resolve };
