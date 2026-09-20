import { verifyToken } from '../utils/security.js';
import HttpError from '../exceptions/http-error.js';

const protect = (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    next(new HttpError('Authentication required', 401, 'AUTHENTICATION_REQUIRED'));
    return;
  }

  try {
    req.user = verifyToken(token, 'access');
    next();
  } catch {
    next(new HttpError('Invalid or expired token', 401, 'INVALID_ACCESS_TOKEN'));
  }
};
const allow =
  (...roles) =>
  (req, _res, next) =>
    roles.includes(req.user.role)
      ? next()
      : next(new HttpError('Access denied', 403, 'ACCESS_DENIED'));
export { protect, allow };
