const jwt = require('jsonwebtoken');
const { unauthorized, forbidden } = require('../utils/response');

/**
 * Verifies Bearer token and attaches decoded payload to req.user.
 * Payload shape: { id, role, branchId, ownerId }
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return unauthorized(res);

  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return unauthorized(res, 'Invalid or expired token');
  }
}

/**
 * Factory: allow only the specified roles.
 * Platform roles:  'super_admin' | 'admin'
 * Shop roles:      'owner' | 'manager' | 'cashier'
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return forbidden(res);
    next();
  };
}

/**
 * Ensures the request's branchId matches the authenticated user's branch,
 * unless the user is an owner (can access all their branches).
 */
function requireBranchAccess(req, res, next) {
  const branchId = parseInt(req.params.branchId || req.body.branchId);
  const user = req.user;

  if (user.role === 'super_admin' || user.role === 'admin') return next();
  if (user.role === 'owner') return next(); // owner can access all their branches
  if (user.branchId === branchId) return next();

  return forbidden(res, 'Access to this branch is not allowed');
}

module.exports = { authenticate, authorize, requireBranchAccess };
