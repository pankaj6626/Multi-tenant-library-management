import HttpError from '../../../common/exceptions/http-error.js';
import redis from '../../../config/redis.js';
import * as concernRepository from '../repositories/concern.repository.js';

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

export { create, findByLibrary, resolve };
