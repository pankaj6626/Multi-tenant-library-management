import Student from '../entities/student.entity.js';
export default {
  create: (data) => Student.create(data),
  findByEmail: (email) => Student.findOne({ email }),
  findById: (id) => Student.findById(id),
  findProfile: (id) =>
    Student.findById(id).populate("library", "name libraryCode"),
  findByLibrary: (library) => Student.find({ library }).sort("name"),
  findIdsByLibrary: (library) => Student.find({ library }).select('_id'),
  findOne: (query) => Student.findOne(query),
  deleteOne: (query) => Student.deleteOne(query),
};
