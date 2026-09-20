import Notification from '../entities/notification.entity.js';

const create = (data) => Notification.create(data);
const findForRecipient = (recipient) => Notification.find({ recipient }).sort('-createdAt').limit(50).lean();
const markRead = (notificationId, recipient) => Notification.findOneAndUpdate(
  { _id: notificationId, recipient },
  { readAt: new Date() },
  { new: true },
).lean();
const markAllRead = (recipient) => Notification.updateMany(
  { recipient, readAt: null },
  { readAt: new Date() },
);

export { create, findForRecipient, markRead, markAllRead };
