import db from '../db/db.js';

export const PaymentRequest = {
  async findAll({ status, priority }) {
    let sql = `
      SELECT pr.*,
        b.internal_bill_id, b.invoice_number, b.invoice_amount, b.net_bill_amount, b.balance_payable, b.bill_type, b.material_service_desc,
        v.legal_name as vendor_name, v.trade_name as vendor_trade_name, v.bank_name, v.bank_account_number, v.ifsc, v.bank_details_authorized,
        br.name as branch_name, p.name as project_name,
        u.name as requested_by_name, v_u.name as verified_by_name
      FROM payment_requests pr
      JOIN bills b ON pr.bill_id = b.id
      JOIN vendors v ON b.vendor_id = v.id
      LEFT JOIN branches br ON b.branch_id = br.id
      LEFT JOIN projects p ON b.project_id = p.id
      LEFT JOIN users u ON pr.requested_by_user_id = u.id
      LEFT JOIN users v_u ON pr.verified_by_user_id = v_u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      sql += ` AND pr.status = $${params.length}`;
    }

    if (priority) {
      params.push(priority);
      sql += ` AND pr.priority = $${params.length}`;
    }

    sql += ` ORDER BY pr.id DESC`;
    const res = await db.query(sql, params);
    return res.rows;
  },

  async findById(id) {
    const res = await db.query(`
      SELECT pr.*,
        b.internal_bill_id, b.invoice_number, b.invoice_amount, b.net_bill_amount, b.balance_payable, b.bill_type,
        v.legal_name as vendor_name, v.trade_name as vendor_trade_name, v.bank_name, v.bank_account_number, v.ifsc, v.bank_details_authorized
      FROM payment_requests pr
      JOIN bills b ON pr.bill_id = b.id
      JOIN vendors v ON b.vendor_id = v.id
      WHERE pr.id = $1 LIMIT 1
    `, [id]);
    return res.rows[0] || null;
  },

  async findByBillId(bill_id) {
    const res = await db.query('SELECT * FROM payment_requests WHERE bill_id = $1 ORDER BY id DESC', [bill_id]);
    return res.rows;
  },

  async create(pr) {
    const res = await db.query(
      `INSERT INTO payment_requests (
        bill_id, requested_amount, required_payment_date, priority, reason_remarks,
        status, requested_by_user_id, requested_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
      [pr.bill_id, pr.requested_amount, pr.required_payment_date, pr.priority || 'normal', pr.reason_remarks, pr.status || 'submitted', pr.requested_by_user_id]
    );
    return res.rows[0];
  },

  async updateStatus(id, { status, verified_amount = null, verified_by_user_id = null, verification_notes = null }) {
    const res = await db.query(
      `UPDATE payment_requests SET
        status = $1, verified_amount = COALESCE($2, verified_amount),
        verified_by_user_id = COALESCE($3, verified_by_user_id),
        verified_at = CASE WHEN $3 IS NOT NULL THEN NOW() ELSE verified_at END,
        verification_notes = COALESCE($4, verification_notes),
        updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [status, verified_amount, verified_by_user_id, verification_notes, id]
    );
    return res.rows[0];
  }
};

export default PaymentRequest;
