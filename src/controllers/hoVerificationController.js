import HOModel from '../models/hoModel.js';
import Bill from '../models/billModel.js';
import PaymentRequest from '../models/paymentRequestModel.js';
import db from '../db/db.js';
import { logAuditEvent, createNotification } from '../middleware/auditMiddleware.js';

export const getHOQueue = async (req, res) => {
  try {
    const queue = await HOModel.getQueue();

    const pending = queue.filter(b => b.status === 'bill_received' || b.status === 'resubmitted');
    const queries = queue.filter(b => b.status === 'query_raised_by_ho' || b.status === 'query_raised');
    const verified = queue.filter(b => b.status === 'ho_approved' || b.status === 'payment_requested_to_ca' || b.status === 'partially_paid' || b.status === 'paid' || b.status === 'fully_paid');

    res.json({
      success: true,
      counts: {
        pending: pending.length,
        queries: queries.length,
        verified: verified.length,
        total: queue.length
      },
      pending_verification: pending,
      queries_raised: queries,
      verified_bills: verified,
      queue
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const verifyPaymentRequest = async (req, res) => {
  try {
    const { bill_id, payment_request_id, verified_amount, verification_notes } = req.body;
    const reqId = req.params.id ? parseInt(req.params.id, 10) : (payment_request_id ? parseInt(payment_request_id, 10) : null);
    const bId = bill_id ? parseInt(bill_id, 10) : null;

    let pr = null;
    let bill = null;

    if (reqId) {
      pr = await PaymentRequest.findById(reqId);
      if (pr) bill = await Bill.findById(pr.bill_id);
    } else if (bId) {
      bill = await Bill.findById(bId);
      if (bill) {
        const prs = await PaymentRequest.findAll({ bill_id: bId });
        pr = prs[0] || null;
      }
    }

    if (!bill && !pr) {
      return res.status(404).json({ success: false, message: 'Bill or Payment request not found.' });
    }

    const targetBillId = bill ? bill.id : pr.bill_id;
    const targetBill = bill || (await Bill.findById(targetBillId));
    const verAmt = verified_amount ? parseFloat(verified_amount) : (pr ? parseFloat(pr.requested_amount) : parseFloat(targetBill.net_bill_amount || 0));

    let updatedPR = null;
    if (pr) {
      updatedPR = await PaymentRequest.updateStatus(pr.id, {
        status: 'verified',
        verified_amount: verAmt,
        verified_by_user_id: req.user ? req.user.id : null,
        verification_notes: verification_notes || 'Verified by Head Office'
      });
    }

    await Bill.updateStatus(targetBillId, 'ho_approved');

    logAuditEvent(req, {
      action: 'HO_VERIFIED',
      entity_type: 'bill',
      entity_id: targetBillId,
      internal_bill_id: targetBill ? targetBill.internal_bill_id : null,
      old_status: targetBill ? targetBill.status : null,
      new_status: 'ho_approved',
      metadata: { verified_amount: verAmt, notes: verification_notes }
    });

    createNotification({
      recipient_role: 'ca',
      title: `Bill Verified & Approved by HO: ${targetBill ? targetBill.internal_bill_id : targetBillId}`,
      message: `HO Verifier approved bill for payment release to CA. Amount: ₹${verAmt.toLocaleString('en-IN')}.`,
      internal_bill_id: targetBill ? targetBill.internal_bill_id : null,
      bill_id: targetBillId,
      type: 'verified'
    });

    res.json({ success: true, message: 'Bill verified successfully by HO!', payment_request: updatedPR, bill: targetBill });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const raiseHOQuery = async (req, res) => {
  try {
    const { bill_id, payment_request_id, query_reason_code, query_text } = req.body;
    const reqId = req.params.id ? parseInt(req.params.id, 10) : (payment_request_id ? parseInt(payment_request_id, 10) : null);
    const bId = bill_id ? parseInt(bill_id, 10) : null;

    let pr = null;
    let bill = null;

    if (reqId) {
      pr = await PaymentRequest.findById(reqId);
      if (pr) bill = await Bill.findById(pr.bill_id);
    } else if (bId) {
      bill = await Bill.findById(bId);
      if (bill) {
        const prs = await PaymentRequest.findAll({ bill_id: bId });
        pr = prs[0] || null;
      }
    }

    if (!bill && !pr) {
      return res.status(404).json({ success: false, message: 'Bill or Payment request not found.' });
    }

    const qText = query_text || req.body.query_details || req.body.remarks || 'HO Query raised';

    const newQuery = await HOModel.raiseQuery({
      bill_id: bill ? bill.id : pr.bill_id,
      payment_request_id: pr ? pr.id : null,
      query_reason_code: query_reason_code || req.body.query_category || 'other',
      query_text: qText,
      raised_by_user_id: req.user ? req.user.id : null
    });

    if (pr) {
      await PaymentRequest.updateStatus(pr.id, { status: 'query_raised' });
    }
    await Bill.updateStatus(bill ? bill.id : pr.bill_id, 'query_raised_by_ho');

    logAuditEvent(req, {
      action: 'QUERY_RAISED',
      entity_type: 'query',
      entity_id: newQuery.id,
      internal_bill_id: bill ? bill.internal_bill_id : (pr ? pr.internal_bill_id : null),
      old_status: bill ? bill.status : (pr ? pr.status : null),
      new_status: 'query_raised_by_ho',
      metadata: { reason_code: query_reason_code, query: qText }
    });

    createNotification({
      recipient_role: 'purchase_officer',
      recipient_user_id: bill ? bill.created_by_user_id : (pr ? pr.requested_by_user_id : null),
      title: `Query Raised on Bill ${bill ? bill.internal_bill_id : ''}`,
      message: `HO Verifier raised query: "${qText}". Please review and reply.`,
      internal_bill_id: bill ? bill.internal_bill_id : null,
      bill_id: bill ? bill.id : pr.bill_id,
      type: 'query_raised'
    });

    res.status(201).json({ success: true, message: 'Query raised successfully!', query: newQuery, bill });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const replyHOQuery = async (req, res) => {
  try {
    let queryId = req.params.queryId
      ? parseInt(req.params.queryId, 10)
      : parseInt(req.body.query_id || req.body.id || req.body.queryId, 10);

    const billId = req.body.bill_id ? parseInt(req.body.bill_id, 10) : null;
    const replyText = req.body.reply_text || req.body.response_text || req.body.remarks;

    // Auto lookup open query for bill if queryId missing
    if ((!queryId || isNaN(queryId)) && billId) {
      const openQueries = await HOModel.getQueriesByBill(billId);
      const openQ = openQueries.find(q => q.status === 'open') || openQueries[0];
      if (openQ) {
        queryId = openQ.id;
      }
    }

    if (!queryId || isNaN(queryId)) {
      return res.status(400).json({ success: false, message: 'Query ID is required.' });
    }

    if (!replyText || !replyText.trim()) {
      return res.status(400).json({ success: false, message: 'Reply text is required.' });
    }

    const updatedQuery = await HOModel.replyQuery(queryId, {
      reply_text: replyText.trim(),
      replied_by_user_id: req.user ? req.user.id : null
    });

    // Save attached clarification files if present
    if (req.files && req.files.length > 0 && billId) {
      for (const file of req.files) {
        await db.query(
          `INSERT INTO bill_documents (
            bill_id, document_type, file_name, file_path, file_size, mime_type, uploaded_by_user_id, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            billId,
            'Query Clarification Document',
            file.originalname,
            `/uploads/documents/${file.filename}`,
            file.size,
            file.mimetype,
            req.user ? req.user.id : null,
            `Uploaded for Query Reply #${queryId}`
          ]
        );
      }
    }

    // Reset bill status back to 'bill_received' for HO re-verification
    const targetBId = billId || (updatedQuery ? updatedQuery.bill_id : null);
    if (targetBId) {
      await Bill.updateStatus(targetBId, 'bill_received');
    }

    logAuditEvent(req, {
      action: 'QUERY_REPLIED',
      entity_type: 'query',
      entity_id: queryId,
      metadata: { reply: replyText, file_count: req.files ? req.files.length : 0 }
    });

    createNotification({
      recipient_role: 'ho_verifier',
      title: `Query Response Submitted`,
      message: `Branch officer replied to query on bill: "${replyText.substring(0, 80)}...". Bill ready for re-verification.`,
      bill_id: targetBId,
      type: 'query_replied'
    });

    res.json({ success: true, message: 'Query reply submitted & bill resubmitted to HO!', query: updatedQuery });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export default {
  getHOQueue,
  verifyPaymentRequest,
  raiseHOQuery,
  replyHOQuery
};
