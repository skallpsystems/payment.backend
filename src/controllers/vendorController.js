import Vendor from '../models/vendorModel.js';
import Bill from '../models/billModel.js';
import Notification from '../models/notificationModel.js';
import { logAuditEvent } from '../middleware/auditMiddleware.js';

export const getVendors = async (req, res) => {
  try {
    const { search, category, active, status } = req.query;
    const vendors = await Vendor.findAll({ search, category, active, status });
    res.json({ success: true, count: vendors.length, vendors });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getVendorById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const vendor = await Vendor.findById(id);

    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found in Master repository.' });
    }

    const bills = await Bill.findAll({ vendor_id: id });

    res.json({
      success: true,
      vendor: {
        ...vendor,
        recent_bills: bills.slice(0, 10)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getVendorSummary = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid vendor ID.' });
    }

    const vendor = await Vendor.findById(id);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found in Master repository.' });
    }

    const bills = await Bill.findAll({ vendor_id: id });

    // Calculate aggregated KPI metrics
    const total_business_done = bills.reduce((sum, b) => sum + parseFloat(b.net_bill_amount || b.invoice_amount || 0), 0);
    const total_paid_till_date = bills.reduce((sum, b) => sum + parseFloat(b.total_paid_amount || 0), 0);
    const total_outstanding = bills.reduce((sum, b) => sum + Math.max(0, parseFloat(b.balance_payable !== undefined ? b.balance_payable : (parseFloat(b.net_bill_amount || 0) - parseFloat(b.total_paid_amount || 0)))), 0);

    res.json({
      success: true,
      vendor,
      bills,
      summary: {
        total_business_done,
        total_paid_till_date,
        total_outstanding,
        total_bills_count: bills.length
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createVendor = async (req, res) => {
  try {
    const {
      legal_name, trade_name, pan, gstin, msme_status, address,
      contact_person, mobile, email, bank_name, beneficiary_name,
      bank_account_number, ifsc, vendor_category
    } = req.body;

    if (!legal_name || !pan || !gstin || !bank_name || !bank_account_number || !ifsc) {
      return res.status(400).json({
        success: false,
        message: 'Mandatory fields missing: Legal Name, PAN, GSTIN, Bank Name, Account Number, and IFSC are required.'
      });
    }

    const existing = await Vendor.findByGstinOrPan(gstin, pan);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Duplicate Vendor detected! Vendor '${existing.legal_name}' already exists with GSTIN/PAN.`
      });
    }

    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const vendor_code = `VEN-${randomNum}`;

    const newVendor = await Vendor.create({
      vendor_code,
      legal_name: legal_name.trim(),
      trade_name: (trade_name || legal_name).trim(),
      pan: pan.trim().toUpperCase(),
      gstin: gstin.trim().toUpperCase(),
      msme_status: msme_status || 'not_registered',
      address: address || '',
      contact_person: contact_person || '',
      mobile: mobile || '',
      email: email || '',
      bank_name: bank_name.trim(),
      beneficiary_name: (beneficiary_name || legal_name).trim(),
      bank_account_number: bank_account_number.trim(),
      ifsc: ifsc.trim().toUpperCase(),
      vendor_category: vendor_category || 'Raw Material',
      status: 'pending_ho_verification',
      is_active: false,
      bank_details_authorized: false,
      created_by_user_id: req.user ? req.user.id : null
    });

    logAuditEvent(req, {
      action: 'VENDOR_CREATED',
      entity_type: 'vendor',
      entity_id: newVendor.id,
      metadata: { vendor_code, legal_name, gstin }
    });

    // Notify HO Verifiers
    try {
      await Notification.create({
        recipient_role: 'ho_verifier',
        type: 'vendor_created',
        title: 'New Vendor Registration Pending HO Verification',
        message: `New vendor '${newVendor.legal_name}' (${newVendor.vendor_code}) submitted by Purchase Officer. Pending HO Verification.`
      });
    } catch (e) {
      console.warn('Failed to dispatch notification:', e);
    }

    res.status(201).json({
      success: true,
      message: `Vendor '${newVendor.legal_name}' registered successfully! Pending HO Verification.`,
      vendor: newVendor
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const hoVerifyVendor = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { ho_verification_remarks } = req.body;

    if (!ho_verification_remarks || !ho_verification_remarks.trim()) {
      return res.status(400).json({ success: false, message: 'HO verification remarks are required.' });
    }

    const vendor = await Vendor.findById(id);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found.' });
    }

    const updated = await Vendor.hoVerify(id, {
      ho_verification_remarks: ho_verification_remarks.trim(),
      ho_verified_by: req.user ? req.user.id : null
    });

    logAuditEvent(req, {
      action: 'VENDOR_HO_VERIFIED',
      entity_type: 'vendor',
      entity_id: id,
      metadata: { vendor_code: vendor.vendor_code, legal_name: vendor.legal_name, remarks: ho_verification_remarks }
    });

    // Notify Payment Authority (CA)
    try {
      await Notification.create({
        recipient_role: 'ca',
        type: 'vendor_ho_verified',
        title: 'Vendor Verified by HO – Pending CA Approval',
        message: `Vendor '${vendor.legal_name}' (${vendor.vendor_code}) verified by HO with remarks: "${ho_verification_remarks}". Pending CA final approval.`
      });
    } catch (e) {
      console.warn('Failed to dispatch notification:', e);
    }

    res.json({
      success: true,
      message: `Vendor '${vendor.legal_name}' verified by HO! Forwarded to Payment Authority (CA) for final approval.`,
      vendor: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const caApproveVendor = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const vendor = await Vendor.findById(id);

    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found.' });
    }

    const updated = await Vendor.caApprove(id, {
      legal_name: req.body.legal_name || vendor.legal_name,
      trade_name: req.body.trade_name || vendor.trade_name,
      pan: (req.body.pan || vendor.pan).toUpperCase(),
      gstin: (req.body.gstin || vendor.gstin).toUpperCase(),
      msme_status: req.body.msme_status || vendor.msme_status,
      address: req.body.address || vendor.address,
      contact_person: req.body.contact_person || vendor.contact_person,
      mobile: req.body.mobile || vendor.mobile,
      email: req.body.email || vendor.email,
      bank_name: req.body.bank_name || vendor.bank_name,
      beneficiary_name: req.body.beneficiary_name || vendor.beneficiary_name,
      bank_account_number: req.body.bank_account_number || vendor.bank_account_number,
      ifsc: (req.body.ifsc || vendor.ifsc).toUpperCase(),
      vendor_category: req.body.vendor_category || vendor.vendor_category
    }, req.user ? req.user.id : null);

    logAuditEvent(req, {
      action: 'VENDOR_CA_APPROVED',
      entity_type: 'vendor',
      entity_id: id,
      metadata: { vendor_code: vendor.vendor_code, legal_name: updated.legal_name }
    });

    // Notify Purchase Officers & HO
    try {
      await Notification.create({
        recipient_role: 'purchase_officer',
        type: 'vendor_approved',
        title: 'Vendor Approved by Payment Authority',
        message: `Vendor '${updated.legal_name}' (${updated.vendor_code}) approved & activated by Payment Authority. Now available in Bill Creation dropdown!`
      });
    } catch (e) {
      console.warn('Failed to dispatch notification:', e);
    }

    res.json({
      success: true,
      message: `Vendor '${updated.legal_name}' approved and activated! Available for Bill Creation.`,
      vendor: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateVendor = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const vendor = await Vendor.findById(id);

    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found.' });
    }

    const updated = await Vendor.update(id, {
      legal_name: req.body.legal_name || vendor.legal_name,
      trade_name: req.body.trade_name || vendor.trade_name,
      pan: req.body.pan || vendor.pan,
      gstin: req.body.gstin || vendor.gstin,
      msme_status: req.body.msme_status || vendor.msme_status,
      address: req.body.address || vendor.address,
      contact_person: req.body.contact_person || vendor.contact_person,
      mobile: req.body.mobile || vendor.mobile,
      email: req.body.email || vendor.email,
      bank_name: req.body.bank_name || vendor.bank_name,
      beneficiary_name: req.body.beneficiary_name || vendor.beneficiary_name,
      bank_account_number: req.body.bank_account_number || vendor.bank_account_number,
      ifsc: req.body.ifsc || vendor.ifsc,
      vendor_category: req.body.vendor_category || vendor.vendor_category
    });

    logAuditEvent(req, {
      action: 'VENDOR_UPDATED',
      entity_type: 'vendor',
      entity_id: id,
      metadata: { vendor_code: vendor.vendor_code, legal_name: updated.legal_name }
    });

    res.json({ success: true, vendor: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const authorizeBankDetails = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const vendor = await Vendor.findById(id);

    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found.' });
    }

    const updated = await Vendor.authorizeBankDetails(id, req.user ? req.user.id : null);

    logAuditEvent(req, {
      action: 'VENDOR_BANK_AUTHORIZED',
      entity_type: 'vendor',
      entity_id: id,
      metadata: { vendor_code: vendor.vendor_code, bank_name: vendor.bank_name, account: vendor.bank_account_number }
    });

    res.json({ success: true, message: `Bank details for vendor '${vendor.legal_name}' authorized!`, vendor: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export default {
  getVendors,
  getVendorById,
  getVendorSummary,
  createVendor,
  hoVerifyVendor,
  caApproveVendor,
  updateVendor,
  authorizeBankDetails
};
