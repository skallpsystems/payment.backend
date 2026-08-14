import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { getBills, getBillById, checkDuplicate, createBill } from '../controllers/billController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleGuard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const docsDir = path.join(__dirname, '../../uploads/documents');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, docsDir),
  filename: (req, file, cb) => cb(null, `Invoice_${Date.now()}_${path.basename(file.originalname)}`)
});
const uploadDocs = multer({ storage });

const router = express.Router();

router.get('/', authMiddleware, getBills);
router.get('/:id', authMiddleware, getBillById);
router.post('/check-duplicate', authMiddleware, checkDuplicate);
router.post('/', authMiddleware, authorizeRoles('purchase_officer', 'admin'), uploadDocs.array('documents'), createBill);

export default router;
