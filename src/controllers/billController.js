import Bill from '../models/billModel.js';
import Vendor from '../models/vendorModel.js';
import Master from '../models/masterModel.js';
import HOModel from '../models/hoModel.js';
import CAModel from '../models/caModel.js';
import PaymentRequest from '../models/paymentRequestModel.js';
import Audit from '../models/auditModel.js';
import { logAuditEvent, createNotification } from '../middleware/auditMiddleware.js';

export const getBills = async (req, res) => {
  try {
    const { branch_id, project_id, status, vendor_id, search } = req.query;
    const bills = await Bill.findAll({ branch_id, project_id, status, vendor_id, search });
    res.json({ success: true, count: bills.length, bills });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getBillById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const bill = await Bill.findById(id);

    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill record not found.' });
    }

    const documents = await Bill.getDocuments(id);
    const queries = await HOModel.getQueriesByBill(id);
    const transactions = await CAModel.getTransactionsByBill(id);
    const payment_requests = await PaymentRequest.findByBillId(id);
    const audit_trail = await Audit.findAll({ internal_bill_id: bill.internal_bill_id, entity_id: id });

    res.json({
      success: true,
      bill: {
        ...bill,
        documents,
        queries,
        transactions,
        payment_requests,
        audit_trail
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const checkDuplicate = async (req, res) => {
  try {
    const { vendor_id, invoice_number } = req.body;
    if (!vendor_id || !invoice_number) {
      return res.status(400).json({ success: false, message: 'Vendor ID and Invoice Number required.' });
    }

    const dup = await Bill.findDuplicate(vendor_id, invoice_number);
    if (dup) {
      return res.json({
        is_duplicate: true,
        message: `Duplicate Invoice Detected! Invoice #${invoice_number} already exists for this vendor (Internal Bill ID: ${dup.internal_bill_id}, Date: ${dup.invoice_date}).`,
        existing_bill: dup
      });
    }

    res.json({ is_duplicate: false });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createBill = async (req, res) => {
  try {
    if (req.user && req.user.role !== 'purchase_officer' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Only Purchase Officers can create and register new bills.'
      });
    }

    const {
      branch_id, project_id, vendor_id, bill_type, invoice_number,
      invoice_date, invoice_amount, gst_amount, net_bill_amount, eway_bill_number,
      po_wo_number, material_service_desc, due_date, bill_category, remarks,
      override_duplicate, duplicate_reason
    } = req.body;

    const invAmt = parseFloat(invoice_amount || 0);
    const gstAmt = parseFloat(gst_amount || 0);
    const netAmt = parseFloat(net_bill_amount || (invAmt + gstAmt) || 0);

    if (!branch_id || !vendor_id || !invoice_number || invAmt <= 0 || netAmt <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Mandatory fields missing: Branch, Vendor, Invoice Number, Invoice Amount, and Net Bill Amount are required.'
      });
    }

    // Check Duplicate
    const dup = await Bill.findDuplicate(vendor_id, invoice_number);
    if (dup && !override_duplicate) {
      return res.status(400).json({
        success: false,
        is_duplicate: true,
        message: `Duplicate Invoice Detected! Invoice #${invoice_number} already registered under ${dup.internal_bill_id}.`
      });
    }

    const branches = await Master.getAllBranches();
    const branch = branches.find(b => b.id === parseInt(branch_id, 10));
    const bCode = branch ? branch.code : 'GEN';
    const randId = Math.floor(100000 + Math.random() * 900000);
    const internal_bill_id = `${bCode}/26-27/${randId}`;

    const newBill = await Bill.create({
      internal_bill_id,
      branch_id: parseInt(branch_id, 10),
      project_id: project_id ? parseInt(project_id, 10) : null,
      vendor_id: parseInt(vendor_id, 10),
      bill_type: bill_type || 'tax_invoice',
      invoice_number: invoice_number.trim(),
      invoice_date: invoice_date || new Date().toISOString().split('T')[0],
      invoice_amount: invAmt,
      gst_amount: gstAmt,
      net_bill_amount: netAmt,
      eway_bill_number: eway_bill_number ? eway_bill_number.trim() : null,
      po_wo_number: po_wo_number ? po_wo_number.trim() : null,
      material_service_desc: material_service_desc ? material_service_desc.trim() : '',
      due_date: due_date || null,
      bill_category: bill_category || 'Raw Material',
      remarks: remarks || '',
      status: 'bill_received',
      total_paid_amount: 0,
      balance_payable: netAmt,
      is_duplicate_override: !!override_duplicate,
      duplicate_override_reason: duplicate_reason || null,
      created_by_user_id: req.user ? req.user.id : null
    });

    // Save attached document records if present
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await Bill.addDocument({
          bill_id: newBill.id,
          document_type: 'Invoice Copy',
          file_name: file.originalname,
          file_path: `/uploads/documents/${file.filename}`,
          file_size: file.size,
          mime_type: file.mimetype,
          uploaded_by_user_id: req.user ? req.user.id : null,
          notes: 'Uploaded during bill creation'
        });
      }
    }

    logAuditEvent(req, {
      action: 'BILL_UPLOADED',
      entity_type: 'bill',
      entity_id: newBill.id,
      internal_bill_id,
      new_status: 'bill_received',
      metadata: { invoice_number, net_bill_amount: netAmt }
    });

    createNotification({
      recipient_role: 'ho_verifier',
      title: `New Bill Uploaded: ${internal_bill_id}`,
      message: `Purchase Officer uploaded bill #${invoice_number} for ₹${netAmt.toLocaleString('en-IN')}. Pending HO document verification.`,
      internal_bill_id,
      bill_id: newBill.id,
      type: 'submitted'
    });

    res.status(201).json({ success: true, bill: newBill });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export default {
  getBills,
  getBillById,
  checkDuplicate,
  createBill
};
