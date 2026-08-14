import express from 'express';
import {
  getMasters, createBranch, updateBranch, deleteBranch,
  createProject, updateProject, deleteProject
} from '../controllers/masterController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleGuard.js';

const router = express.Router();

router.get('/', authMiddleware, getMasters);

// Branches CRUD (Admin Only)
router.post('/branches', authMiddleware, authorizeRoles('admin'), createBranch);
router.put('/branches/:id', authMiddleware, authorizeRoles('admin'), updateBranch);
router.delete('/branches/:id', authMiddleware, authorizeRoles('admin'), deleteBranch);

// Projects CRUD (Admin Only)
router.post('/projects', authMiddleware, authorizeRoles('admin'), createProject);
router.put('/projects/:id', authMiddleware, authorizeRoles('admin'), updateProject);
router.delete('/projects/:id', authMiddleware, authorizeRoles('admin'), deleteProject);

export default router;
