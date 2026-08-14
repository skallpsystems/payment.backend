import db from '../db/db.js';

export const getDashboardSummary = async (req, res) => {
  try {
    const { branch_id } = req.query;

    let bFilter = '';
    const params = [];
    if (branch_id) {
      params.push(parseInt(branch_id, 10));
      bFilter = ` AND branch_id = $${params.length}`;
    }

    const billsRes = await db.query(`SELECT status, net_bill_amount, balance_payable, total_paid_amount FROM bills WHERE 1=1 ${bFilter}`, params);
    const bills = billsRes.rows;

    let totalBills = bills.length;
    let totalLiability = 0;
    let totalOutstanding = 0;
    let totalPaid = 0;

    let billReceivedCount = 0;
    let hoApprovedCount = 0;
    let paymentRequestedCount = 0;
    let queryRaisedCount = 0;
    let partiallyPaidCount = 0;
    let paidCount = 0;

    bills.forEach(b => {
      const netAmt = parseFloat(b.net_bill_amount || 0);
      const balAmt = parseFloat(b.balance_payable || 0);
      const paidAmt = parseFloat(b.total_paid_amount || 0);

      totalLiability += netAmt;
      totalOutstanding += balAmt;
      totalPaid += paidAmt;

      if (b.status === 'bill_received' || b.status === 'resubmitted') billReceivedCount++;
      if (b.status === 'ho_approved' || b.status === 'verified_awaiting_payment') hoApprovedCount++;
      if (b.status === 'payment_requested_to_ca') paymentRequestedCount++;
      if (b.status === 'query_raised_by_ho' || b.status === 'query_raised') queryRaisedCount++;
      if (b.status === 'partially_paid') partiallyPaidCount++;
      if (b.status === 'paid' || b.status === 'fully_paid') paidCount++;
    });

    const vendorsRes = await db.query('SELECT COUNT(*) FROM vendors WHERE is_active = true');
    const totalActiveVendors = parseInt(vendorsRes.rows[0].count, 10);

    const recentAuditRes = await db.query('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 5');

    const metrics = {
      total_bills: totalBills,
      bill_received: billReceivedCount,
      ho_approved: hoApprovedCount,
      payment_requested: paymentRequestedCount,
      query_raised: queryRaisedCount,
      partially_paid: partiallyPaidCount,
      paid: paidCount,
      total_liability: totalLiability,
      total_outstanding: totalOutstanding,
      total_paid: totalPaid,
      total_active_vendors: totalActiveVendors
    };

    res.json({
      success: true,
      summary: metrics,
      metrics,
      recent_activity: recentAuditRes.rows
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export default {
  getDashboardSummary
};
