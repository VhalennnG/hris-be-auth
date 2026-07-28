import { AppError } from '../utils/errors.js';

export default function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
  }

  // Handle unique constraint index check for user email (ux_users_email_lower)
  if (err.code === '23505' && err.message.includes('ux_users_email_lower')) {
    return res.status(409).json({
      status: 'error',
      error: {
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'Akun dengan email tersebut sudah terdaftar',
        details: null
      }
    });
  }

  console.error('Unhandled Error in Auth Service:', err);

  return res.status(500).json({
    status: 'error',
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan internal pada server auth',
      details: process.env.NODE_ENV === 'development' ? err.message : null
    }
  });
}
