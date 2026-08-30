const HttpError = require('../../../common/exceptions/http-error');
const { publish } = require('../../../events/publishers/event.publisher');
const events = require('../../../events/event-types/domain-events');
const libraryRepository = require('../repositories/library.repository');

const create = async (libraryData) => {
  const library = await libraryRepository.create(libraryData);
  publish(events.LIBRARY_REGISTERED, { libraryId: library._id });
  return library;
};

const findApprovedByCode = async (libraryCode) => {
  const library = await libraryRepository.findApprovedByCode(libraryCode);
  if (!library) throw new HttpError('Approved library not found for this libraryCode', 404);
  return library;
};

const approve = async (libraryId) => {
  const library = await libraryRepository.findById(libraryId);
  if (!library) throw new HttpError('Library not found', 404);

  library.status = 'APPROVED';
  library.libraryCode = `${library.pincode}-${library._id.toString().slice(-5).toUpperCase()}`;
  await libraryRepository.save(library);
  publish(events.LIBRARY_APPROVED, { libraryId: library._id });
  return library;
};

const reject = async (libraryId) => {
  const library = await libraryRepository.findById(libraryId);
  if (!library) throw new HttpError('Library not found', 404);

  library.status = 'REJECTED';
  await libraryRepository.save(library);
  publish(events.LIBRARY_REJECTED, { libraryId: library._id });
  return library;
};

module.exports = { create, findApprovedByCode, approve, reject, findAll: libraryRepository.findAll };
