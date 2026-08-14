import Master from '../models/masterModel.js';
import { logAuditEvent } from '../middleware/auditMiddleware.js';

export const getMasters = async (req, res) => {
  try {
    const branches = await Master.getAllBranches();
    const projects = await Master.getAllProjects();

    res.json({
      success: true,
      branches: branches || [],
      projects: projects || [],
      bill_types: [
        { id: 'tax_invoice', label: 'Tax Invoice', requiredDocs: ['Invoice Copy', 'Purchase Order', 'Delivery Challan', 'GRN / Weighment Slip'] },
        { id: 'proforma_invoice', label: 'Proforma Invoice', requiredDocs: ['Proforma Invoice', 'Purchase Order', 'Delivery Challan', 'GRN/Material Reciept'] },
        { id: 'advance_request', label: 'Advance Request', requiredDocs: ['Proforma Invoice', 'Purchase Order', 'Advance Approval'] },
        { id: 'ra_bill', label: 'RA Bill (Contractor / Subcontractor)', requiredDocs: ['Invoice', 'Certified RA Bill', 'Work Order', 'Measurement Quality Certification', 'Relevant Deductions'] },
        { id: 'reimbursement_expense', label: 'Expense / Reimbursement', requiredDocs: ['Original Cash/GST Bill', 'Expense Approval Slip'] },
        { id: 'other', label: 'Other Statutory / Utility Bill', requiredDocs: ['Bill / Demand Notice', 'Supporting Approval'] }
      ],
      vendor_categories: [
        'Raw Material',
        'Consumables',
        'Contractor / Civil',
        'Transport / Logistics',
        'Machinery & Spares',
        'Professional Services',
        'General Utilities'
      ],
      payment_modes: ['NEFT', 'RTGS', 'IMPS', 'Cheque', 'Other'],
      query_reasons: [
        { code: 'po_missing', label: 'PO / Work Order Not Attached' },
        { code: 'challan_missing', label: 'Delivery Challan / Weighbridge Stamped Slip Missing' },
        { code: 'amount_mismatch', label: 'Invoice Amount Mismatch with PO / Rate Card' },
        { code: 'vendor_mismatch', label: 'Incorrect Vendor Selected / Bank Details Discrepancy' },
        { code: 'measurement_sheet_required', label: 'Measurement / Quantity Certification Sheet Missing' },
        { code: 'grn_missing', label: 'GRN / Material Receipt Note Not Certified' },
        { code: 'tax_calculation_error', label: 'GST / TDS Calculation Error in Bill' },
        { code: 'other', label: 'Other Document / Clarification Required' }
      ]
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createBranch = async (req, res) => {
  try {
    const { code, name, state, is_active } = req.body;
    if (!code || !name) return res.status(400).json({ success: false, message: 'Branch Code and Name are required.' });

    const newBranch = await Master.createBranch({ code, name, state, is_active });

    logAuditEvent(req, {
      action: 'BRANCH_CREATED',
      entity_type: 'branch',
      entity_id: newBranch.id,
      metadata: { code, name, state }
    });

    res.status(201).json({ success: true, message: `Branch '${newBranch.name}' created successfully!`, branch: newBranch });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateBranch = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { code, name, state, is_active } = req.body;
    if (!code || !name) return res.status(400).json({ success: false, message: 'Branch Code and Name are required.' });

    const updated = await Master.updateBranch(id, { code, name, state, is_active });

    logAuditEvent(req, {
      action: 'BRANCH_UPDATED',
      entity_type: 'branch',
      entity_id: updated.id,
      metadata: { code, name, state, is_active }
    });

    res.json({ success: true, message: `Branch '${updated.name}' updated successfully!`, branch: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteBranch = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const deleted = await Master.deleteBranch(id);

    logAuditEvent(req, {
      action: 'BRANCH_DELETED',
      entity_type: 'branch',
      entity_id: id,
      metadata: { id }
    });

    res.json({ success: true, message: 'Branch deleted successfully.', branch: deleted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createProject = async (req, res) => {
  try {
    const { code, name, branch_id, is_active } = req.body;
    if (!code || !name) return res.status(400).json({ success: false, message: 'Project Code and Name are required.' });

    const newProj = await Master.createProject({
      code,
      name,
      branch_id: branch_id ? parseInt(branch_id, 10) : null,
      is_active
    });

    logAuditEvent(req, {
      action: 'PROJECT_CREATED',
      entity_type: 'project',
      entity_id: newProj.id,
      metadata: { code, name, branch_id }
    });

    res.status(201).json({ success: true, message: `Project '${newProj.name}' created successfully!`, project: newProj });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateProject = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { code, name, branch_id, is_active } = req.body;
    if (!code || !name) return res.status(400).json({ success: false, message: 'Project Code and Name are required.' });

    const updated = await Master.updateProject(id, { code, name, branch_id, is_active });

    logAuditEvent(req, {
      action: 'PROJECT_UPDATED',
      entity_type: 'project',
      entity_id: updated.id,
      metadata: { code, name, branch_id, is_active }
    });

    res.json({ success: true, message: `Project '${updated.name}' updated successfully!`, project: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteProject = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const deleted = await Master.deleteProject(id);

    logAuditEvent(req, {
      action: 'PROJECT_DELETED',
      entity_type: 'project',
      entity_id: id,
      metadata: { id }
    });

    res.json({ success: true, message: 'Project deleted successfully.', project: deleted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export default {
  getMasters,
  createBranch,
  updateBranch,
  deleteBranch,
  createProject,
  updateProject,
  deleteProject
};
