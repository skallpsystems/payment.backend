import jwt from 'jsonwebtoken';
import db from '../db/db.js';

export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required. Please login.' });
  }

  const token = authHeader.split(' ')[1];
  const jwtSecret = process.env.JWT_SECRET || 'skallp_payment_jwt_secret_key_2026_centralized_secure';

  try {
    const decoded = jwt.verify(token, jwtSecret);

    const userRes = await db.query('SELECT id, name, email, role, branch_id, project_id, is_active FROM users WHERE id = $1', [decoded.id]);
    const user = userRes.rows[0];

    if (!user || user.is_active === false) {
      return res.status(401).json({ success: false, message: 'User account not found or deactivated.' });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      branch_id: user.branch_id,
      project_id: user.project_id
    };

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Session expired or invalid token. Please log in again.' });
  }
}

export default authMiddleware;
