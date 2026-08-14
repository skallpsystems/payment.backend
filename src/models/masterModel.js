import db from '../db/db.js';

export const Master = {
  // Branches CRUD
  async getAllBranches() {
    const res = await db.query(`
      SELECT b.*, COUNT(p.id)::int as project_count
      FROM branches b
      LEFT JOIN projects p ON p.branch_id = b.id
      GROUP BY b.id
      ORDER BY b.id ASC
    `);
    return res.rows;
  },

  async getBranchById(id) {
    const res = await db.query('SELECT * FROM branches WHERE id = $1 LIMIT 1', [id]);
    return res.rows[0] || null;
  },

  async createBranch({ code, name, state = 'Chhattisgarh', is_active = true }) {
    const res = await db.query(
      `INSERT INTO branches (code, name, state, is_active, created_at)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
      [code.trim().toUpperCase(), name.trim(), state ? state.trim() : 'Chhattisgarh', is_active]
    );
    return res.rows[0];
  },

  async updateBranch(id, { code, name, state, is_active }) {
    const res = await db.query(
      `UPDATE branches
       SET code = $1, name = $2, state = $3, is_active = $4
       WHERE id = $5 RETURNING *`,
      [code.trim().toUpperCase(), name.trim(), state ? state.trim() : 'Chhattisgarh', is_active !== false, id]
    );
    return res.rows[0];
  },

  async deleteBranch(id) {
    const res = await db.query('DELETE FROM branches WHERE id = $1 RETURNING *', [id]);
    return res.rows[0];
  },

  // Projects CRUD
  async getAllProjects() {
    const res = await db.query(`
      SELECT p.*, b.name as branch_name, b.code as branch_code
      FROM projects p
      LEFT JOIN branches b ON p.branch_id = b.id
      ORDER BY p.id ASC
    `);
    return res.rows;
  },

  async getProjectById(id) {
    const res = await db.query('SELECT * FROM projects WHERE id = $1 LIMIT 1', [id]);
    return res.rows[0] || null;
  },

  async createProject({ code, name, branch_id, is_active = true }) {
    const res = await db.query(
      `INSERT INTO projects (code, name, branch_id, is_active, created_at)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
      [code.trim().toUpperCase(), name.trim(), branch_id ? parseInt(branch_id, 10) : null, is_active]
    );
    return res.rows[0];
  },

  async updateProject(id, { code, name, branch_id, is_active }) {
    const res = await db.query(
      `UPDATE projects
       SET code = $1, name = $2, branch_id = $3, is_active = $4
       WHERE id = $5 RETURNING *`,
      [code.trim().toUpperCase(), name.trim(), branch_id ? parseInt(branch_id, 10) : null, is_active !== false, id]
    );
    return res.rows[0];
  },

  async deleteProject(id) {
    const res = await db.query('DELETE FROM projects WHERE id = $1 RETURNING *', [id]);
    return res.rows[0];
  }
};

export default Master;
