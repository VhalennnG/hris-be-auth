import { AppError } from '../utils/errors.js';

/**
 * Middleware to enforce that the caller has superadmin privileges.
 * It checks the trusted header X-User-Role forwarded by the orchestrator gateway.
 */
export function requireSuperadmin(req, res, next) {
  const role = req.headers['x-user-role'];

  if (role !== 'superadmin') {
    return next(new AppError('FORBIDDEN', 'Akses ditolak: Hanya superadmin yang memiliki akses ke modul ini', 403));
  }

  next();
}
