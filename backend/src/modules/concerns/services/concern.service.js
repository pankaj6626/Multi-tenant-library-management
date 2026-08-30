const HttpError = require('../../../common/exceptions/http-error');
const concernRepository = require('../repositories/concern.repository');

const create = (concernData) => concernRepository.create(concernData);

const findByLibrary = (libraryId) => concernRepository.findByLibrary(libraryId);

const resolve = async (concernId, libraryId) => {
  const concern = await concernRepository.resolve(concernId, libraryId);
  if (!concern) throw new HttpError('Concern not found', 404);

  return concern;
};

module.exports = { create, findByLibrary, resolve };
