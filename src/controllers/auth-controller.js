import pool from '../config/db.js';
import { AppError } from '../utils/errors.js';
import { comparePassword } from '../services/password-service.js';
import { signToken } from '../services/token-service.js';

// POST /api/v1/auth/login
export async function login(req, res, next) {
  const { email, password } = req.body;

  try {
    // Find user, case-insensitive email search matching the index ux_users_email_lower
    const userRes = await pool.query(
      `SELECT user_id, email, password_hash, role, emp_id, is_active 
       FROM users 
       WHERE lower(email) = lower($1)`,
      [email]
    );

    if (userRes.rows.length === 0) {
      return next(new AppError('INVALID_CREDENTIALS', 'Email atau password salah', 401));
    }

    const user = userRes.rows[0];

    // Check account status
    if (!user.is_active) {
      return next(new AppError('ACCOUNT_INACTIVE', 'Akun berstatus tidak aktif', 403));
    }

    // Verify password hash
    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      return next(new AppError('INVALID_CREDENTIALS', 'Email atau password salah', 401));
    }

    // Generate JWT (RS256)
    const token = signToken(user);

    return res.status(200).json({
      status: 'success',
      data: {
        access_token: token,
        token_type: 'Bearer',
        expires_in: 14400, // 4 hours in seconds
        user: {
          user_id: user.user_id.toString(),
          emp_id: user.emp_id ? user.emp_id.toString() : null,
          role: user.role
        }
      }
    });
  } catch (error) {
    next(error);
  }
}
