import Library from '../entities/library.entity.js';
export default {
  create: (data) => Library.create(data),
  findAll: () => Library.find().sort("-createdAt"),
  findById: (id) => Library.findById(id),
  findApprovedByCode: (libraryCode) =>
    Library.findOne({ libraryCode, status: "APPROVED" }),
  save: (library) => library.save(),
};
