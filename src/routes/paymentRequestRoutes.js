import express from 'express';
import { getPaymentRequests, createPaymentRequest } from '../controllers/paymentRequestController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleGuard.js';

const router = express.Router();

router.get('/', authMiddleware, getPaymentRequests);
router.post('/', authMiddleware, authorizeRoles('purchase_officer', 'admin'), createPaymentRequest);

export default router;
