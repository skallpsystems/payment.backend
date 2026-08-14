import db from '../db/db.js';

export async function calculateVendorFinancialSnapshot(vendorId, currentBillId = null) {
  const numVendorId = parseInt(vendorId, 10);

  const billsRes = await db.query(
    `SELECT id, bill_type, balance_payable, total_paid_amount, status FROM bills WHERE vendor_id = $1 AND status NOT IN ('cancelled', 'rejected')`,
    [numVendorId]
  );
  const vendorBills = billsRes.rows;

  let totalOutstanding = 0;
  let previousAdvances = 0;
  let currentBillOutstanding = 0;

  vendorBills.forEach(b => {
    const bal = parseFloat(b.balance_payable) || 0;
    totalOutstanding += bal;

    if (b.bill_type === 'proforma_invoice' || b.bill_type === 'advance_request') {
      previousAdvances += (parseFloat(b.total_paid_amount) || 0);
    }

    if (currentBillId && b.id == currentBillId) {
      currentBillOutstanding = bal;
    }
  });

  const txRes = await db.query(`
    SELECT COALESCE(SUM(pt.payment_amount), 0) as payments_last_30_days
    FROM payment_transactions pt
    JOIN bills b ON pt.bill_id = b.id
    WHERE b.vendor_id = $1 AND pt.payment_date >= NOW() - INTERVAL '30 days'
  `, [numVendorId]);

  const paymentsLast30Days = parseFloat(txRes.rows[0].payments_last_30_days || 0);

  return {
    vendor_id: numVendorId,
    total_outstanding: totalOutstanding,
    current_bill_outstanding: currentBillOutstanding,
    previous_advances: previousAdvances,
    payments_last_30_days: paymentsLast30Days,
    active_bills_count: vendorBills.length
  };
}

export default {
  calculateVendorFinancialSnapshot
};
