const HttpError = require('../../../common/exceptions/http-error');
const redis = require('../../../config/redis');
const concernRepository = require('../repositories/concern.repository');

const create = async (concernData) => {
  const concern = await concernRepository.create(concernData);
  await redis.del(`library:seats:${concernData.library}`);
  return concern;
};

const findByLibrary = (libraryId) => concernRepository.findByLibrary(libraryId);

const resolve = async (concernId, libraryId) => {
  const concern = await concernRepository.resolve(concernId, libraryId);
  if (!concern) throw new HttpError('Concern not found', 404);

  await redis.del(`library:seats:${libraryId}`);
  return concern;
};

module.exports = { create, findByLibrary, resolve };
