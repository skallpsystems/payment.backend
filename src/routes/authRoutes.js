import express from 'express';
import { login, getMe, listUsers, createUser, updateUser, toggleUserStatus } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { authorizeRoles } from '../middleware/roleGuard.js';

const router = express.Router();

router.post('/login', login);
router.get('/me', authMiddleware, getMe);
router.get('/users', authMiddleware, authorizeRoles('admin'), listUsers);
router.post('/users', authMiddleware, authorizeRoles('admin'), createUser);
router.put('/users/:id', authMiddleware, authorizeRoles('admin'), updateUser);
router.patch('/users/:id/toggle-status', authMiddleware, authorizeRoles('admin'), toggleUserStatus);

export default router;
