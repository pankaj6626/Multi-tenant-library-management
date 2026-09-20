import HttpError from '../../../common/exceptions/http-error.js';
import redis from '../../../config/redis.js';
import * as concernRepository from '../repositories/concern.repository.js';
import librarianRepository from '../../librarians/repositories/librarian.repository.js';
import * as notificationService from '../../notifications/services/notification.service.js';

const create = async (concernData) => {
  const concern = await concernRepository.create(concernData);
  await redis.del(`library:seats:${concernData.library}`);
  const librarians = await librarianRepository.findByLibrary(concernData.library);
  await notificationService.notifyMany(librarians.map(({ _id: recipient }) => recipient), {
    recipientRole: 'LIBRARIAN',
    library: concernData.library,
    type: 'CONCERN_CREATED',
    title: 'New student concern',
    message: 'A student has raised a new concern.',
    eventKey: `concern-created:${concern._id}:librarian`,
  });
  return concern;
};

const findByLibrary = (libraryId) => concernRepository.findByLibrary(libraryId);

const resolve = async (concernId, libraryId) => {
  const concern = await concernRepository.resolve(concernId, libraryId);
  if (!concern) throw new HttpError('Concern not found', 404);

  await redis.del(`library:seats:${libraryId}`);
  await notificationService.notify({
    recipient: concern.student,
    recipientRole: 'STUDENT',
    library: libraryId,
    type: 'CONCERN_RESOLVED',
    title: 'Concern resolved',
    message: 'Your librarian resolved your concern.',
    eventKey: `concern-resolved:${concern._id}`,
  });
  return concern;
};

export { create, findByLibrary, resolve };
