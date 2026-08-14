import Audit from '../models/auditModel.js';
import Notification from '../models/notificationModel.js';

export async function logAuditEvent(req, {
  action,
  entity_type,
  entity_id = null,
  internal_bill_id = null,
  old_status = null,
  new_status = null,
  metadata = {}
}) {
  try {
    const user = req && req.user ? req.user : { id: null, name: 'System', role: 'system' };
    const ip = (req && req.headers && req.headers['x-forwarded-for']) || (req && req.socket ? req.socket.remoteAddress : '127.0.0.1');

    await Audit.log({
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      action,
      entity_type,
      entity_id,
      internal_bill_id,
      old_status,
      new_status,
      metadata,
      ip_address: ip
    });
  } catch (err) {
    console.warn('Audit log write error:', err.message);
  }
}

export async function createNotification({
  recipient_role,
  recipient_user_id = null,
  title,
  message,
  internal_bill_id = null,
  bill_id = null,
  type = 'info'
}) {
  try {
    await Notification.create({
      recipient_role,
      recipient_user_id,
      title,
      message,
      internal_bill_id,
      bill_id,
      type
    });
  } catch (err) {
    console.warn('Notification write error:', err.message);
  }
}

export default {
  logAuditEvent,
  createNotification
};
