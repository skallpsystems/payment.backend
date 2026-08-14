import db from '../db/db.js';

export const Bill = {
  async findAll({ branch_id, project_id, status, vendor_id, search }) {
    let sql = `
      SELECT b.*,
        v.legal_name as vendor_name, v.trade_name, v.legal_name, v.vendor_code, v.pan, v.pan as vendor_pan,
        v.gstin, v.bank_name, v.bank_name as vendor_bank_name,
        v.bank_account_number, v.bank_account_number as vendor_account_number,
        v.ifsc, v.ifsc as vendor_ifsc, v.bank_details_authorized,
        br.name as branch_name, br.code as branch_code,
        pr.name as project_name, pr.code as project_code,
        u.name as created_by_name
      FROM bills b
      LEFT JOIN vendors v ON b.vendor_id = v.id
      LEFT JOIN branches br ON b.branch_id = br.id
      LEFT JOIN projects pr ON b.project_id = pr.id
      LEFT JOIN users u ON b.created_by_user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (branch_id) {
      params.push(branch_id);
      sql += ` AND b.branch_id = $${params.length}`;
    }

    if (project_id) {
      params.push(project_id);
      sql += ` AND b.project_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      sql += ` AND b.status = $${params.length}`;
    }

    if (vendor_id) {
      params.push(vendor_id);
      sql += ` AND b.vendor_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      sql += ` AND (LOWER(b.internal_bill_id) LIKE $${params.length} OR LOWER(b.invoice_number) LIKE $${params.length} OR LOWER(v.trade_name) LIKE $${params.length} OR LOWER(v.legal_name) LIKE $${params.length})`;
    }

    sql += ` ORDER BY b.id DESC`;
    const res = await db.query(sql, params);
    return res.rows;
  },

  async findById(id) {
    const res = await db.query(`
      SELECT b.*,
        v.legal_name as vendor_name, v.trade_name, v.legal_name, v.vendor_code, v.pan, v.pan as vendor_pan,
        v.gstin, v.bank_name, v.bank_name as vendor_bank_name,
        v.bank_account_number, v.bank_account_number as vendor_account_number,
        v.ifsc, v.ifsc as vendor_ifsc, v.bank_details_authorized,
        br.name as branch_name, br.code as branch_code,
        pr.name as project_name, pr.code as project_code,
        u.name as created_by_name
      FROM bills b
      LEFT JOIN vendors v ON b.vendor_id = v.id
      LEFT JOIN branches br ON b.branch_id = br.id
      LEFT JOIN projects pr ON b.project_id = pr.id
      LEFT JOIN users u ON b.created_by_user_id = u.id
      WHERE b.id = $1 LIMIT 1
    `, [id]);
    return res.rows[0] || null;
  },

  async findDuplicate(vendor_id, invoice_number) {
    const res = await db.query(
      `SELECT * FROM bills WHERE vendor_id = $1 AND UPPER(invoice_number) = UPPER($2) AND status != 'cancelled' LIMIT 1`,
      [vendor_id, invoice_number.trim()]
    );
    return res.rows[0] || null;
  },

  async create(b) {
    const res = await db.query(
      `INSERT INTO bills (
        internal_bill_id, branch_id, project_id, vendor_id, bill_type,
        invoice_number, invoice_date, invoice_amount, gst_amount, net_bill_amount,
        eway_bill_number, po_wo_number, material_service_desc, due_date, bill_category,
        remarks, status, total_paid_amount, balance_payable, is_duplicate_override,
        duplicate_override_reason, created_by_user_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, NOW(), NOW())
      RETURNING *`,
      [
        b.internal_bill_id, b.branch_id, b.project_id, b.vendor_id, b.bill_type,
        b.invoice_number, b.invoice_date, b.invoice_amount, b.gst_amount, b.net_bill_amount,
        b.eway_bill_number, b.po_wo_number, b.material_service_desc, b.due_date, b.bill_category,
        b.remarks, b.status || 'bill_received', b.total_paid_amount || 0, b.balance_payable,
        b.is_duplicate_override || false, b.duplicate_override_reason || null, b.created_by_user_id
      ]
    );
    return res.rows[0];
  },

  async updateStatus(id, status, balance_payable = null, total_paid_amount = null) {
    let sql = 'UPDATE bills SET status = $1, updated_at = NOW()';
    const params = [status];

    if (balance_payable !== null) {
      params.push(balance_payable);
      sql += `, balance_payable = $${params.length}`;
    }

    if (total_paid_amount !== null) {
      params.push(total_paid_amount);
      sql += `, total_paid_amount = $${params.length}`;
    }

    params.push(id);
    sql += ` WHERE id = $${params.length} RETURNING *`;

    const res = await db.query(sql, params);
    return res.rows[0];
  },

  async addDocument(doc) {
    const res = await db.query(
      `INSERT INTO bill_documents (
        bill_id, document_type, file_name, file_path, file_size, mime_type, uploaded_by_user_id, notes, uploaded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING *`,
      [
        doc.bill_id, doc.document_type, doc.file_name, doc.file_path,
        doc.file_size, doc.mime_type, doc.uploaded_by_user_id, doc.notes
      ]
    );
    return res.rows[0];
  },

  async getDocuments(bill_id) {
    const res = await db.query(`
      SELECT bd.*, u.name as uploaded_by_name
      FROM bill_documents bd
      LEFT JOIN users u ON bd.uploaded_by_user_id = u.id
      WHERE bd.bill_id = $1 ORDER BY bd.id DESC
    `, [bill_id]);
    return res.rows;
  }
};

export default Bill;
