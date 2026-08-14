import express from 'express';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../controllers/notificationController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', authMiddleware, getNotifications);
router.patch('/:id/read', authMiddleware, markNotificationRead);
router.put('/:id/read', authMiddleware, markNotificationRead);
router.put('/read-all', authMiddleware, markAllNotificationsRead);

export default router;
