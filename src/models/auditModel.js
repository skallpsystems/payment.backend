import db from '../db/db.js';

export const Audit = {
  async log({ user_id, user_name, user_role, action, entity_type, entity_id, internal_bill_id, old_status, new_status, metadata, ip_address }) {
    const res = await db.query(
      `INSERT INTO audit_logs (
        user_id, user_name, user_role, action, entity_type, entity_id,
        internal_bill_id, old_status, new_status, metadata, ip_address, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()) RETURNING *`,
      [user_id, user_name, user_role, action, entity_type, entity_id, internal_bill_id, old_status, new_status, JSON.stringify(metadata), ip_address]
    );
    return res.rows[0];
  },

  async findAll({ action, entity_type, entity_id, user_id, internal_bill_id, limit = 100 }) {
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];

    if (internal_bill_id && entity_id) {
      params.push(internal_bill_id);
      params.push(parseInt(entity_id, 10));
      sql += ` AND (internal_bill_id = $1 OR metadata->>'internal_bill_id' = $1 OR (entity_type = 'bill' AND entity_id = $2) OR metadata->>'bill_id' = $2::text)`;
    } else if (internal_bill_id) {
      params.push(internal_bill_id);
      sql += ` AND (internal_bill_id = $1 OR metadata->>'internal_bill_id' = $1)`;
    } else if (entity_id) {
      params.push(parseInt(entity_id, 10));
      sql += ` AND (entity_id = $1 OR metadata->>'bill_id' = $1::text)`;
    }

    if (action) {
      params.push(action);
      sql += ` AND action = $${params.length}`;
    }

    if (user_id) {
      params.push(user_id);
      sql += ` AND user_id = $${params.length}`;
    }

    const limitVal = parseInt(limit, 10) || 100;
    params.push(limitVal);
    sql += ` ORDER BY id ASC LIMIT $${params.length}`;

    const res = await db.query(sql, params);
    return res.rows;
  }
};

export default Audit;
