import * as repository from '../repositories/notification.repository.js';
import { emitToUser } from '../../../config/socket.js';

const notify = async ({ recipient, recipientRole, library, type, title, message, eventKey }) => {
  try {
    const notification = await repository.create({
      recipient,
      recipientRole,
      library,
      type,
      title,
      message,
      eventKey,
    });
    if (notification) emitToUser(recipient, 'notification:created', notification.toObject());
    return notification;
  } catch (error) {
    if (error.code === 11000) return null;
    throw error;
  }
};

const notifyMany = async (recipients, notification) => Promise.all(
  recipients.map((recipient) => notify({
    ...notification,
    recipient,
    eventKey: `${notification.eventKey}:${recipient}`,
  })),
);

const list = (recipient) => repository.findForRecipient(recipient);
const markRead = (notificationId, recipient) => repository.markRead(notificationId, recipient);
const markAllRead = (recipient) => repository.markAllRead(recipient);

export { notify, notifyMany, list, markRead, markAllRead };
