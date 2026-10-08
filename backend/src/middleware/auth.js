import jwt from 'jsonwebtoken';
import env from '../config/env.js';

export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required: Missing Bearer token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    const userId = Number(decoded.id || decoded.studentId || decoded.staffId);

    if (!userId || isNaN(userId)) {
      return res.status(401).json({ message: 'Invalid token payload: User ID missing' });
    }

    req.user = {
      id: userId,
      email: decoded.email,
      role: String(decoded.role || (decoded.studentId ? 'student' : 'staff')).toLowerCase(),
      name: decoded.name || 'User'
    };
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired authentication token' });
  }
};

export const optionalAuthenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    const userId = Number(decoded.id || decoded.studentId || decoded.staffId);
    if (userId && !isNaN(userId)) {
      req.user = {
        id: userId,
        email: decoded.email,
        role: String(decoded.role || (decoded.studentId ? 'student' : 'staff')).toLowerCase(),
        name: decoded.name || 'User'
      };
    }
  } catch (e) {
    // ignore optional token failure
  }
  return next();
};

export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = String(req.user.role || '').toLowerCase();
    const normalizedAllowed = allowedRoles.map((r) => String(r).toLowerCase());

    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({
        message: `Forbidden: role '${req.user.role}' is not authorized to access this resource`
      });
    }
    return next();
  };
};

export const requireAdmin = requireRole('admin');
export const requireStaff = requireRole('staff');
export const requireStudent = requireRole('student');
export const requireStaffOrAdmin = requireRole('staff', 'admin');
