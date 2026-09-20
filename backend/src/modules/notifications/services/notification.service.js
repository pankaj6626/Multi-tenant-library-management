import * as repository from '../repositories/notification.repository.js';

const notify = async ({ recipient, recipientRole, library, type, title, message, eventKey }) => {
  try {
    return await repository.create({
      recipient,
      recipientRole,
      library,
      type,
      title,
      message,
      eventKey,
    });
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
