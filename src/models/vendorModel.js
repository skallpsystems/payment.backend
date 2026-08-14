import db from '../db/db.js';

export const Vendor = {
  async findAll({ search, category, active, status }) {
    let sql = `
      SELECT v.*,
        u_creator.name as created_by_user_name,
        u_ho.name as ho_verified_by_user_name,
        u_ca.name as ca_approved_by_user_name,
        (SELECT COALESCE(SUM(balance_payable), 0) FROM bills WHERE vendor_id = v.id AND status != 'cancelled') as total_outstanding
      FROM vendors v
      LEFT JOIN users u_creator ON v.created_by_user_id = u_creator.id
      LEFT JOIN users u_ho ON v.ho_verified_by = u_ho.id
      LEFT JOIN users u_ca ON v.ca_approved_by = u_ca.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      sql += ` AND (LOWER(v.legal_name) LIKE $${params.length} OR LOWER(v.trade_name) LIKE $${params.length} OR LOWER(v.vendor_code) LIKE $${params.length} OR LOWER(v.pan) LIKE $${params.length} OR LOWER(v.gstin) LIKE $${params.length})`;
    }

    if (category) {
      params.push(category);
      sql += ` AND v.vendor_category = $${params.length}`;
    }

    if (active !== undefined) {
      params.push(active === 'true');
      sql += ` AND v.is_active = $${params.length}`;
    }

    if (status) {
      params.push(status);
      sql += ` AND v.status = $${params.length}`;
    }

    sql += ` ORDER BY v.id DESC`;
    const res = await db.query(sql, params);
    return res.rows;
  },

  async findById(id) {
    const res = await db.query(`
      SELECT v.*,
        u_creator.name as created_by_user_name,
        u_ho.name as ho_verified_by_user_name,
        u_ca.name as ca_approved_by_user_name
      FROM vendors v
      LEFT JOIN users u_creator ON v.created_by_user_id = u_creator.id
      LEFT JOIN users u_ho ON v.ho_verified_by = u_ho.id
      LEFT JOIN users u_ca ON v.ca_approved_by = u_ca.id
      WHERE v.id = $1 LIMIT 1
    `, [id]);
    return res.rows[0] || null;
  },

  async getSummary(id) {
    const vendor = await this.findById(id);
    if (!vendor) return null;

    const billsRes = await db.query(
      `SELECT b.*, br.name as branch_name, p.name as project_name
       FROM bills b
       LEFT JOIN branches br ON b.branch_id = br.id
       LEFT JOIN projects p ON b.project_id = p.id
       WHERE b.vendor_id = $1 ORDER BY b.id DESC`,
      [id]
    );

    const paymentsRes = await db.query(
      `SELECT pt.*, b.internal_bill_id, b.invoice_number, u.name as paid_by_name
       FROM payment_transactions pt
       JOIN bills b ON pt.bill_id = b.id
       LEFT JOIN users u ON pt.paid_by_user_id = u.id
       WHERE b.vendor_id = $1 ORDER BY pt.id DESC`,
      [id]
    );

    const metricsRes = await db.query(
      `SELECT
        COUNT(*)::int as total_bills_count,
        COALESCE(SUM(net_bill_amount), 0) as total_billed_amount,
        COALESCE(SUM(total_paid_amount), 0) as total_paid_amount,
        COALESCE(SUM(balance_payable), 0) as balance_outstanding
       FROM bills WHERE vendor_id = $1 AND status != 'cancelled'`,
      [id]
    );

    return {
      vendor,
      bills: billsRes.rows,
      payment_history: paymentsRes.rows,
      summary: metricsRes.rows[0] || {
        total_bills_count: 0,
        total_billed_amount: 0,
        total_paid_amount: 0,
        balance_outstanding: 0
      }
    };
  },

  async findByGstinOrPan(gstin, pan) {
    const res = await db.query('SELECT * FROM vendors WHERE UPPER(gstin) = UPPER($1) OR UPPER(pan) = UPPER($2) LIMIT 1', [gstin, pan]);
    return res.rows[0] || null;
  },

  async create(v) {
    const res = await db.query(
      `INSERT INTO vendors (
        vendor_code, legal_name, trade_name, pan, gstin, msme_status, address,
        contact_person, mobile, email, bank_name, beneficiary_name, bank_account_number,
        ifsc, vendor_category, status, is_active, bank_details_authorized, created_by_user_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW())
      RETURNING *`,
      [
        v.vendor_code, v.legal_name, v.trade_name, v.pan, v.gstin, v.msme_status, v.address,
        v.contact_person, v.mobile, v.email, v.bank_name, v.beneficiary_name, v.bank_account_number,
        v.ifsc, v.vendor_category, v.status || 'pending_ho_verification', v.is_active ?? false, v.bank_details_authorized ?? false, v.created_by_user_id || null
      ]
    );
    return res.rows[0];
  },

  async hoVerify(id, { ho_verification_remarks, ho_verified_by }) {
    const res = await db.query(
      `UPDATE vendors SET
        status = 'pending_ca_approval',
        ho_verification_remarks = $1,
        ho_verified_by = $2,
        ho_verified_at = NOW(),
        updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [ho_verification_remarks, ho_verified_by, id]
    );
    return res.rows[0];
  },

  async caApprove(id, v, userId) {
    const res = await db.query(
      `UPDATE vendors SET
        legal_name=$1, trade_name=$2, pan=$3, gstin=$4, msme_status=$5, address=$6,
        contact_person=$7, mobile=$8, email=$9, bank_name=$10, beneficiary_name=$11,
        bank_account_number=$12, ifsc=$13, vendor_category=$14, status='approved',
        is_active=true, bank_details_authorized=true, ca_approved_by=$15, ca_approved_at=NOW(), updated_at=NOW()
       WHERE id=$16 RETURNING *`,
      [
        v.legal_name, v.trade_name, v.pan, v.gstin, v.msme_status, v.address,
        v.contact_person, v.mobile, v.email, v.bank_name, v.beneficiary_name,
        v.bank_account_number, v.ifsc, v.vendor_category, userId, id
      ]
    );
    return res.rows[0];
  },

  async update(id, v) {
    const res = await db.query(
      `UPDATE vendors SET
        legal_name=$1, trade_name=$2, pan=$3, gstin=$4, msme_status=$5, address=$6,
        contact_person=$7, mobile=$8, email=$9, bank_name=$10, beneficiary_name=$11,
        bank_account_number=$12, ifsc=$13, vendor_category=$14, updated_at=NOW()
       WHERE id=$15 RETURNING *`,
      [
        v.legal_name, v.trade_name, v.pan, v.gstin, v.msme_status, v.address,
        v.contact_person, v.mobile, v.email, v.bank_name, v.beneficiary_name,
        v.bank_account_number, v.ifsc, v.vendor_category, id
      ]
    );
    return res.rows[0];
  },

  async authorizeBankDetails(id, userId) {
    const res = await db.query(
      `UPDATE vendors SET bank_details_authorized = true, bank_authorized_by = $1, bank_authorized_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *`,
      [userId, id]
    );
    return res.rows[0];
  }
};

export default Vendor;
