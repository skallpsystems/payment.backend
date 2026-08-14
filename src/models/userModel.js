import db from '../db/db.js';

export const User = {
  async findByEmail(email) {
    const res = await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email.trim()]);
    return res.rows[0] || null;
  },

  async findById(id) {
    const res = await db.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
    return res.rows[0] || null;
  },

  async findAll() {
    const res = await db.query(`
      SELECT u.id, u.name, u.email, u.role, u.mobile, u.is_active, u.branch_id, u.project_id, u.created_at,
             b.name as branch_name, b.code as branch_code, p.name as project_name, p.code as project_code
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
      LEFT JOIN projects p ON u.project_id = p.id
      ORDER BY u.id ASC
    `);
    return res.rows;
  },

  async create({ name, email, password_hash, role, branch_id, project_id, mobile, is_active = true }) {
    const res = await db.query(
      `INSERT INTO users (name, email, password_hash, role, branch_id, project_id, mobile, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING id, name, email, role, branch_id, project_id, mobile, is_active, created_at`,
      [name, email.toLowerCase(), password_hash, role, branch_id, project_id, mobile, is_active]
    );
    return res.rows[0];
  },

  async update(id, { name, email, password_hash, role, branch_id, project_id, mobile, is_active }) {
    const res = await db.query(
      `UPDATE users SET name=$1, email=$2, password_hash=$3, role=$4, branch_id=$5, project_id=$6, mobile=$7, is_active=$8, updated_at=NOW()
       WHERE id=$9 RETURNING id, name, email, role, branch_id, project_id, mobile, is_active, updated_at`,
      [name, email, password_hash, role, branch_id, project_id, mobile, is_active, id]
    );
    return res.rows[0];
  },

  async toggleStatus(id, newStatus) {
    const res = await db.query(
      `UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING id, is_active`,
      [newStatus, id]
    );
    return res.rows[0];
  }
};

export default User;
