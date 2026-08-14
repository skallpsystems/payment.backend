import db from '../db/db.js';

export const HOModel = {
  async getQueue() {
    const res = await db.query(`
      SELECT b.id as bill_id, b.id, b.internal_bill_id, b.invoice_number, b.invoice_date,
        b.invoice_amount, b.gst_amount, b.net_bill_amount, b.due_date, b.po_wo_number,
        b.bill_type, b.material_service_desc, b.eway_bill_number, b.status, b.created_at, b.updated_at,
        v.id as vendor_id, v.legal_name as vendor_name, v.legal_name as vendor_legal_name, v.trade_name as vendor_trade_name,
        v.vendor_code, v.pan, v.gstin, v.bank_name, v.bank_account_number, v.ifsc, v.bank_details_authorized, v.msme_status,
        br.name as branch_name, pr_j.name as project_name,
        u.name as created_by_name,
        pr.id as payment_request_id, pr.requested_amount, pr.priority
      FROM bills b
      JOIN vendors v ON b.vendor_id = v.id
      LEFT JOIN branches br ON b.branch_id = br.id
      LEFT JOIN projects pr_j ON b.project_id = pr_j.id
      LEFT JOIN users u ON b.created_by_user_id = u.id
      LEFT JOIN payment_requests pr ON pr.bill_id = b.id
      WHERE b.status IN ('bill_received', 'resubmitted', 'query_raised_by_ho', 'query_raised', 'ho_approved', 'payment_requested_to_ca', 'partially_paid', 'paid', 'fully_paid')
      ORDER BY b.id DESC
    `);
    return res.rows;
  },

  async raiseQuery({ bill_id, payment_request_id, query_reason_code, query_text, raised_by_user_id }) {
    const res = await db.query(
      `INSERT INTO ho_queries (
        bill_id, payment_request_id, query_reason_code, query_text, raised_by_user_id, status, raised_at
      ) VALUES ($1, $2, $3, $4, $5, 'open', NOW()) RETURNING *`,
      [bill_id, payment_request_id, query_reason_code, query_text, raised_by_user_id]
    );
    return res.rows[0];
  },

  async replyQuery(query_id, { reply_text, replied_by_user_id }) {
    const res = await db.query(
      `UPDATE ho_queries SET reply_text = $1, replied_by_user_id = $2, replied_at = NOW(), status = 'replied'
       WHERE id = $3 RETURNING *`,
      [reply_text, replied_by_user_id, query_id]
    );
    return res.rows[0];
  },

  async getQueriesByBill(bill_id) {
    const res = await db.query(`
      SELECT hq.*, u.name as raised_by_name, r_u.name as replied_by_name
      FROM ho_queries hq
      LEFT JOIN users u ON hq.raised_by_user_id = u.id
      LEFT JOIN users r_u ON hq.replied_by_user_id = r_u.id
      WHERE hq.bill_id = $1 ORDER BY hq.id DESC
    `, [bill_id]);
    return res.rows;
  }
};

export default HOModel;
