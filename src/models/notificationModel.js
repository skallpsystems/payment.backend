import db from '../db/db.js';

export const Notification = {
  async create({ recipient_role, user_role, recipient_user_id, title, message, internal_bill_id, bill_id, type = 'info' }) {
    const role = recipient_role || user_role || null;
    const res = await db.query(
      `INSERT INTO notifications (
        recipient_role, recipient_user_id, title, message, internal_bill_id, bill_id, type, is_read, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, false, NOW()) RETURNING *`,
      [role, recipient_user_id || null, title, message, internal_bill_id || null, bill_id || null, type]
    );
    return res.rows[0];
  },

  async findForUser(role, userId) {
    if (role === 'admin') {
      const res = await db.query(
        `SELECT * FROM notifications ORDER BY id DESC LIMIT 100`
      );
      return res.rows;
    } else {
      const res = await db.query(
        `SELECT * FROM notifications 
         WHERE recipient_role = $1 OR recipient_user_id = $2 OR (recipient_role IS NULL AND recipient_user_id IS NULL)
         ORDER BY id DESC LIMIT 100`,
        [role, userId]
      );
      return res.rows;
    }
  },

  async markAsRead(id) {
    const res = await db.query('UPDATE notifications SET is_read = true WHERE id = $1 RETURNING *', [id]);
    return res.rows[0];
  },

  async markAllAsRead(role, userId) {
    if (role === 'admin') {
      const res = await db.query('UPDATE notifications SET is_read = true WHERE is_read = false RETURNING *');
      return res.rows;
    } else {
      const res = await db.query(
        'UPDATE notifications SET is_read = true WHERE (recipient_role = $1 OR recipient_user_id = $2) AND is_read = false RETURNING *',
        [role, userId]
      );
      return res.rows;
    }
  }
};

export default Notification;
