import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { getHOQueue, verifyPaymentRequest, raiseHOQuery, replyHOQuery } from '../controllers/hoVerificationController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleGuard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const docsDir = path.join(__dirname, '../../uploads/documents');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, docsDir),
  filename: (req, file, cb) => cb(null, `QueryDoc_${Date.now()}_${path.basename(file.originalname)}`)
});
const uploadDocs = multer({ storage });

const router = express.Router();

router.get('/queue', authMiddleware, getHOQueue);

// Flexible HO verification & query endpoints
router.post('/verify', authMiddleware, authorizeRoles('ho_verifier', 'admin'), verifyPaymentRequest);
router.patch('/requests/:id/verify', authMiddleware, authorizeRoles('ho_verifier', 'admin'), verifyPaymentRequest);

router.post('/raise-query', authMiddleware, authorizeRoles('ho_verifier', 'admin'), raiseHOQuery);
router.post('/requests/:id/query', authMiddleware, authorizeRoles('ho_verifier', 'admin'), raiseHOQuery);

router.post('/reply-query', authMiddleware, uploadDocs.array('documents'), replyHOQuery);
router.post('/queries/:queryId/reply', authMiddleware, uploadDocs.array('documents'), replyHOQuery);

export default router;
