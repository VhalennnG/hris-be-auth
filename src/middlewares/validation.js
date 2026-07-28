import { AppError } from '../utils/errors.js';

export function validateLogin(req, res, next) {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError('VALIDATION_ERROR', 'Email dan password tidak boleh kosong', 400));
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return next(new AppError('VALIDATION_ERROR', 'Format email tidak valid', 400));
  }

  next();
}

export function validateCreateUser(req, res, next) {
  const { email, password, role, emp_id } = req.body;

  if (!email || !password || !role) {
    return next(new AppError('VALIDATION_ERROR', 'Email, password, dan role tidak boleh kosong', 400));
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return next(new AppError('VALIDATION_ERROR', 'Format email tidak valid', 400));
  }

  if (password.length < 6) {
    return next(new AppError('VALIDATION_ERROR', 'Password minimal harus 6 karakter', 400));
  }

  const validRoles = ['superadmin', 'admin', 'employee'];
  if (!validRoles.includes(role)) {
    return next(new AppError('VALIDATION_ERROR', 'Role tidak valid. Harus superadmin, admin, atau employee', 400));
  }

  // emp_id is optional ONLY for superadmin, required for admin and employee
  if (role !== 'superadmin' && !emp_id) {
    return next(new AppError('VALIDATION_ERROR', 'emp_id wajib diisi untuk role admin dan employee', 400));
  }

  next();
}

export function validateUpdateRole(req, res, next) {
  const { role } = req.body;

  if (!role) {
    return next(new AppError('VALIDATION_ERROR', 'Role tidak boleh kosong', 400));
  }

  const validRoles = ['superadmin', 'admin', 'employee'];
  if (!validRoles.includes(role)) {
    return next(new AppError('VALIDATION_ERROR', 'Role tidak valid. Harus superadmin, admin, atau employee', 400));
  }

  next();
}

export function validateResetPassword(req, res, next) {
  const { password } = req.body;

  if (!password) {
    return next(new AppError('VALIDATION_ERROR', 'Password baru tidak boleh kosong', 400));
  }

  if (password.length < 6) {
    return next(new AppError('VALIDATION_ERROR', 'Password minimal harus 6 karakter', 400));
  }

  next();
}
