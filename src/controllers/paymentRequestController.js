import PaymentRequest from '../models/paymentRequestModel.js';
import Bill from '../models/billModel.js';
import { logAuditEvent, createNotification } from '../middleware/auditMiddleware.js';

export const getPaymentRequests = async (req, res) => {
  try {
    const { status, priority } = req.query;
    const requests = await PaymentRequest.findAll({ status, priority });
    res.json({ success: true, count: requests.length, payment_requests: requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createPaymentRequest = async (req, res) => {
  try {
    const { bill_id, requested_amount, required_payment_date, priority, reason_remarks } = req.body;

    if (!bill_id || !requested_amount) {
      return res.status(400).json({ success: false, message: 'Bill ID and Requested Amount are required.' });
    }

    const bill = await Bill.findById(parseInt(bill_id, 10));
    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill record not found.' });
    }

    const reqAmt = parseFloat(requested_amount);
    if (reqAmt <= 0 || reqAmt > parseFloat(bill.balance_payable) + 0.01) {
      return res.status(400).json({
        success: false,
        message: `Invalid requested amount ₹${reqAmt}. Max payable balance is ₹${bill.balance_payable}.`
      });
    }

    // Check if bill was ALREADY verified & approved by HO
    const isHoAlreadyApproved = (
      bill.status === 'ho_approved' ||
      bill.status === 'verified_awaiting_payment' ||
      bill.status === 'payment_requested_to_ca'
    );

    // If HO already verified bill -> Go DIRECTLY to Payment Authority (CA)!
    const reqStatus = isHoAlreadyApproved ? 'verified' : 'submitted';
    const newBillStatus = isHoAlreadyApproved ? 'payment_requested_to_ca' : 'awaiting_ho_verification';

    const newReq = await PaymentRequest.create({
      bill_id: bill.id,
      requested_amount: reqAmt,
      required_payment_date: required_payment_date || null,
      priority: priority || 'normal',
      reason_remarks: reason_remarks || '',
      status: reqStatus,
      requested_by_user_id: req.user ? req.user.id : null
    });

    await Bill.updateStatus(bill.id, newBillStatus);

    logAuditEvent(req, {
      action: isHoAlreadyApproved ? 'PAYMENT_REQUEST_RAISED_DIRECT_TO_CA' : 'PAYMENT_REQUEST_RAISED_TO_HO',
      entity_type: 'payment_request',
      entity_id: newReq.id,
      internal_bill_id: bill.internal_bill_id,
      old_status: bill.status,
      new_status: newBillStatus,
      metadata: { requested_amount: reqAmt, priority, direct_to_ca: isHoAlreadyApproved }
    });

    if (isHoAlreadyApproved) {
      // Notify Payment Authority (CA) directly
      createNotification({
        recipient_role: 'ca',
        title: `Direct Payment Request for CA: ${bill.internal_bill_id}`,
        message: `Purchase Officer requested ₹${reqAmt.toLocaleString('en-IN')} for HO-Approved bill '${bill.internal_bill_id}'. Ready for disbursement & UTR release!`,
        internal_bill_id: bill.internal_bill_id,
        bill_id: bill.id,
        type: 'submitted'
      });
    } else {
      // Notify HO Verifier
      createNotification({
        recipient_role: 'ho_verifier',
        title: `New Payment Request: ${bill.internal_bill_id}`,
        message: `Payment request of ₹${reqAmt.toLocaleString('en-IN')} raised for ${bill.trade_name || bill.legal_name}. Priority: ${(priority || 'normal').toUpperCase()}.`,
        internal_bill_id: bill.internal_bill_id,
        bill_id: bill.id,
        type: 'submitted'
      });
    }

    res.status(201).json({
      success: true,
      message: isHoAlreadyApproved
        ? `Payment request of ₹${reqAmt.toLocaleString('en-IN')} sent DIRECTLY to Payment Authority (CA) for disbursement!`
        : `Payment request submitted to HO for verification.`,
      payment_request: newReq,
      bill_status: newBillStatus
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export default {
  getPaymentRequests,
  createPaymentRequest
};
