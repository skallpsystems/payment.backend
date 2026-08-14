import db from '../db/db.js';

export const CAModel = {
  async getQueue() {
    const res = await db.query(`
      SELECT b.id as bill_id, b.id, b.internal_bill_id, b.invoice_number, b.invoice_date,
        b.invoice_amount, b.gst_amount, b.net_bill_amount, b.balance_payable, b.total_paid_amount,
        b.po_wo_number, b.bill_type, b.material_service_desc, b.eway_bill_number, b.status, b.created_at, b.updated_at,
        v.id as vendor_id, v.legal_name as vendor_name, v.legal_name as vendor_legal_name, v.trade_name as vendor_trade_name,
        v.vendor_code, v.pan, v.gstin, v.bank_name, v.beneficiary_name, v.bank_account_number, v.ifsc, v.bank_details_authorized,
        br.name as branch_name, pr_j.name as project_name,
        u.name as requested_by_name,
        pr.id as payment_request_id, pr.verified_amount, pr.priority, pr.verification_notes
      FROM bills b
      JOIN vendors v ON b.vendor_id = v.id
      LEFT JOIN branches br ON b.branch_id = br.id
      LEFT JOIN projects pr_j ON b.project_id = pr_j.id
      LEFT JOIN users u ON b.created_by_user_id = u.id
      LEFT JOIN payment_requests pr ON pr.bill_id = b.id
      WHERE b.status IN ('ho_approved', 'verified_awaiting_payment', 'payment_requested_to_ca', 'partially_paid', 'paid', 'fully_paid')
      ORDER BY b.id DESC
    `);
    return res.rows;
  },

  async recordTransaction(t) {
    const res = await db.query(
      `INSERT INTO payment_transactions (
        bill_id, payment_request_id, payment_amount, payment_date, paying_bank_account,
        payment_mode, utr_reference_number, payment_remarks, proof_file_name, proof_file_path,
        paid_by_user_id, paid_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()) RETURNING *`,
      [
        t.bill_id, t.payment_request_id, t.payment_amount, t.payment_date, t.paying_bank_account,
        t.payment_mode, t.utr_reference_number, t.payment_remarks, t.proof_file_name, t.proof_file_path,
        t.paid_by_user_id
      ]
    );
    return res.rows[0];
  },

  async getTransactionsByBill(bill_id) {
    const res = await db.query(`
      SELECT pt.*, u.name as paid_by_name
      FROM payment_transactions pt
      LEFT JOIN users u ON pt.paid_by_user_id = u.id
      WHERE pt.bill_id = $1 ORDER BY pt.id DESC
    `, [bill_id]);
    return res.rows;
  }
};

export default CAModel;
