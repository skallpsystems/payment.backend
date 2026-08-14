import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { getCAQueue, getVendorSnapshot, processPayment } from '../controllers/caPaymentController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleGuard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const proofsDir = path.join(__dirname, '../../uploads/proofs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, proofsDir),
  filename: (req, file, cb) => cb(null, `Proof_${Date.now()}_${path.basename(file.originalname)}`)
});
const uploadProof = multer({ storage });

const router = express.Router();

router.get('/queue', authMiddleware, getCAQueue);
router.get('/vendor-snapshot/:id', authMiddleware, getVendorSnapshot);
router.get('/vendor-snapshot/:vendorId', authMiddleware, getVendorSnapshot);

// Allow any proof file field name (proof_file, payment_proof, etc.) to prevent Multer field errors
router.post('/pay', authMiddleware, authorizeRoles('ca', 'admin'), uploadProof.any(), processPayment);

export default router;
