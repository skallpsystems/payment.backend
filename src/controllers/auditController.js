import Audit from '../models/auditModel.js';

export const getAuditLogs = async (req, res) => {
  try {
    const { action, entity_type, entity_id, user_id } = req.query;
    const logs = await Audit.findAll({ action, entity_type, entity_id, user_id });
    res.json({ success: true, count: logs.length, audit_logs: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export default {
  getAuditLogs
};
