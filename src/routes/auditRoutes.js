import express from 'express';
import { getAuditLogs } from '../controllers/auditController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleGuard.js';

const router = express.Router();

router.get('/logs', authMiddleware, authorizeRoles('admin', 'ho_verifier', 'ca'), getAuditLogs);

export default router;
