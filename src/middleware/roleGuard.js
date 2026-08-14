export function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized. Please login.' });
    }

    if (!allowedRoles.includes(req.user.role) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Your role (${req.user.role}) does not have permission to perform this action.`
      });
    }

    next();
  };
}

export default {
  authorizeRoles
};
