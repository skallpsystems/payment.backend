import Notification from '../models/notificationModel.js';

export const getNotifications = async (req, res) => {
  try {
    const role = req.user ? req.user.role : 'all';
    const userId = req.user ? req.user.id : null;

    const notifs = await Notification.findForUser(role, userId);
    res.json({ success: true, count: notifs.length, notifications: notifs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const notif = await Notification.markAsRead(id);
    res.json({ success: true, notification: notif });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    const role = req.user ? req.user.role : 'all';
    const userId = req.user ? req.user.id : null;

    const updated = await Notification.markAllAsRead(role, userId);
    res.json({ success: true, count: updated.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export default {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead
};
