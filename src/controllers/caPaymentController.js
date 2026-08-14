import CAModel from '../models/caModel.js';
import Bill from '../models/billModel.js';
import Vendor from '../models/vendorModel.js';
import PaymentRequest from '../models/paymentRequestModel.js';
import { logAuditEvent, createNotification } from '../middleware/auditMiddleware.js';

export const getCAQueue = async (req, res) => {
  try {
    const queue = await CAModel.getQueue();

    const awaiting = queue.filter(b => b.status === 'ho_approved' || b.status === 'verified_awaiting_payment' || b.status === 'payment_requested_to_ca' || b.status === 'partially_paid');
    const completed = queue.filter(b => b.status === 'paid' || b.status === 'fully_paid');

    const totalVerifiedAmount = awaiting.reduce((sum, b) => sum + parseFloat(b.balance_payable || b.net_bill_amount || 0), 0);
    const highPriorityCount = awaiting.filter(b => b.priority === 'HIGH' || b.priority === 'URGENT').length;

    res.json({
      success: true,
      metrics: {
        awaiting_count: awaiting.length,
        high_priority_count: highPriorityCount,
        total_verified_amount: totalVerifiedAmount,
        completed_count: completed.length
      },
      awaiting_payment: awaiting,
      completed_payments: completed,
      queue
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getVendorSnapshot = async (req, res) => {
  try {
    const vendorId = parseInt(req.params.id || req.params.vendorId, 10);
    const snapshot = await Vendor.getSummary(vendorId);
    if (!snapshot || !snapshot.vendor) {
      return res.status(404).json({ success: false, message: 'Vendor record not found.' });
    }

    res.json({
      success: true,
      snapshot: {
        vendor: snapshot.vendor,
        metrics: snapshot.summary,
        bills: snapshot.bills,
        payment_history: snapshot.payment_history
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const processPayment = async (req, res) => {
  try {
    const {
      bill_id, payment_request_id, payment_amount, payment_date, paying_bank_account,
      payment_mode, utr_reference_number, payment_remarks
    } = req.body;

    const bId = bill_id ? parseInt(bill_id, 10) : (req.body.id ? parseInt(req.body.id, 10) : null);
    let reqId = payment_request_id ? parseInt(payment_request_id, 10) : null;
    if (isNaN(reqId)) reqId = null;

    let bill = null;
    let pr = null;

    if (reqId) {
      pr = await PaymentRequest.findById(reqId);
      if (pr) bill = await Bill.findById(pr.bill_id);
    }

    if (!bill && bId) {
      bill = await Bill.findById(bId);
      if (bill) {
        const prs = await PaymentRequest.findAll({ bill_id: bId });
        pr = prs[0] || null;
      }
    }

    if (!bill) {
      return res.status(404).json({ success: false, message: 'Associated bill record not found.' });
    }

    if (!payment_amount || !paying_bank_account || !payment_mode || !utr_reference_number) {
      return res.status(400).json({
        success: false,
        message: 'Mandatory payment fields missing: Payment Amount, Paying Bank Account, Payment Mode, and UTR Reference Number are required.'
      });
    }

    const paidAmt = parseFloat(payment_amount);
    if (isNaN(paidAmt) || paidAmt <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid payment amount specified.' });
    }

    const currentTotalPaid = parseFloat(bill.total_paid_amount || 0);
    const newTotalPaid = currentTotalPaid + paidAmt;
    const netBillAmt = parseFloat(bill.net_bill_amount || bill.invoice_amount || 0);
    const newBalance = Math.max(0, netBillAmt - newTotalPaid);

    let newStatus = 'paid';
    if (newBalance > 0.01) {
      newStatus = 'partially_paid';
    }

    let proof_file_name = null;
    let proof_file_path = null;

    if (req.file) {
      proof_file_name = req.file.originalname;
      proof_file_path = `/uploads/proofs/${req.file.filename}`;
    } else if (req.files && req.files.length > 0) {
      const f = req.files[0];
      proof_file_name = f.originalname;
      proof_file_path = `/uploads/proofs/${f.filename}`;
    }

    const transaction = await CAModel.recordTransaction({
      bill_id: bill.id,
      payment_request_id: pr ? pr.id : null,
      payment_amount: paidAmt,
      payment_date: payment_date || new Date().toISOString().split('T')[0],
      paying_bank_account,
      payment_mode,
      utr_reference_number: utr_reference_number.trim(),
      payment_remarks: payment_remarks || '',
      proof_file_name,
      proof_file_path,
      paid_by_user_id: req.user ? req.user.id : null
    });

    await Bill.updateStatus(bill.id, newStatus, newBalance, newTotalPaid);
    if (pr) {
      await PaymentRequest.updateStatus(pr.id, { status: newStatus });
    }

    logAuditEvent(req, {
      action: newStatus === 'paid' ? 'PAYMENT_PROCESSED_FULL' : 'PAYMENT_PROCESSED_PARTIAL',
      entity_type: 'payment',
      entity_id: transaction.id,
      internal_bill_id: bill.internal_bill_id,
      old_status: bill.status,
      new_status: newStatus,
      metadata: {
        bill_id: bill.id,
        internal_bill_id: bill.internal_bill_id,
        payment_amount: paidAmt,
        utr: utr_reference_number,
        payment_mode,
        paying_bank_account,
        remaining_balance: newBalance
      }
    });

    createNotification({
      recipient_role: 'purchase_officer',
      recipient_user_id: bill.created_by_user_id || (pr ? pr.requested_by_user_id : null),
      title: `Payment Released: ₹${paidAmt.toLocaleString('en-IN')} for ${bill.internal_bill_id}`,
      message: `CA released payment via ${payment_mode} (UTR: ${utr_reference_number}). Remaining balance: ₹${newBalance.toLocaleString('en-IN')}.`,
      internal_bill_id: bill.internal_bill_id,
      bill_id: bill.id,
      type: 'payment_made'
    });

    const updatedBill = await Bill.findById(bill.id);

    res.status(201).json({
      success: true,
      message: `Payment of ₹${paidAmt.toLocaleString('en-IN')} recorded successfully! UTR: ${utr_reference_number}`,
      transaction,
      bill: updatedBill || bill,
      bill_status: newStatus,
      remaining_balance: newBalance
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export default {
  getCAQueue,
  getVendorSnapshot,
  processPayment
};
