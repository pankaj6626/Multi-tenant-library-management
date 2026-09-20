import Librarian from '../entities/librarian.entity.js';
export default {
  create: (data) => Librarian.create(data),
  findByEmail: (email) => Librarian.findOne({ email }),
  findByLibrary: (library) => Librarian.find({ library, status: 'APPROVED' }).select('_id'),
  findById: (id) => Librarian.findById(id),
  findAll: () =>
    Librarian.find().populate("library", "name libraryCode").sort("-createdAt"),
  save: (librarian) => librarian.save(),
};
