import express from 'express';
import {
  getVendors, getVendorById, getVendorSummary, createVendor, updateVendor,
  hoVerifyVendor, caApproveVendor, authorizeBankDetails
} from '../controllers/vendorController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleGuard.js';

const router = express.Router();

router.get('/', authMiddleware, getVendors);
router.get('/:id/summary', authMiddleware, getVendorSummary);
router.get('/:id', authMiddleware, getVendorById);
router.post('/', authMiddleware, authorizeRoles('purchase_officer', 'admin'), createVendor);
router.post('/:id/ho-verify', authMiddleware, authorizeRoles('ho_verifier', 'admin'), hoVerifyVendor);
router.patch('/:id/ho-verify', authMiddleware, authorizeRoles('ho_verifier', 'admin'), hoVerifyVendor);
router.post('/:id/ca-approve', authMiddleware, authorizeRoles('ca', 'admin'), caApproveVendor);
router.patch('/:id/ca-approve', authMiddleware, authorizeRoles('ca', 'admin'), caApproveVendor);
router.put('/:id', authMiddleware, authorizeRoles('purchase_officer', 'ca', 'admin'), updateVendor);
router.patch('/:id/authorize-bank', authMiddleware, authorizeRoles('admin'), authorizeBankDetails);

export default router;
