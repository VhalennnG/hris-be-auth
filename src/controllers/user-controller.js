import pool from '../config/db.js';
import { AppError } from '../utils/errors.js';
import { hashPassword } from '../services/password-service.js';
import { verifyEmployeeInCore } from '../services/core-service.js';

// POST /api/v1/auth/users
export async function createUser(req, res, next) {
  const { email, password, role, emp_id } = req.body;

  try {
    const empIdNum = emp_id ? parseInt(emp_id, 10) : null;

    // 1. Verify emp_id exists in core (for non-superadmin users)
    if (role !== 'superadmin' && empIdNum) {
      const isEmployeeValid = await verifyEmployeeInCore(empIdNum);
      if (!isEmployeeValid) {
        return next(new AppError(
          'VALIDATION_ERROR', 
          `Karyawan dengan emp_id ${empIdNum} tidak ditemukan atau tidak aktif di Core Service`, 
          400
        ));
      }
    }

    // 2. Hash password
    const passwordHash = await hashPassword(password);

    // 3. Save user to database
    const insertRes = await pool.query(
      `INSERT INTO users (email, password_hash, role, emp_id)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, email, role, emp_id, is_active`,
      [email, passwordHash, role, empIdNum]
    );

    const user = insertRes.rows[0];

    return res.status(201).json({
      status: 'success',
      data: {
        user_id: user.user_id.toString(),
        email: user.email,
        role: user.role,
        emp_id: user.emp_id ? user.emp_id.toString() : null,
        is_active: user.is_active
      }
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/v1/auth/users/:user_id/role
export async function updateUserRole(req, res, next) {
  const { user_id } = req.params;
  const { role } = req.body;
  const userIdNum = parseInt(user_id, 10);

  if (isNaN(userIdNum)) {
    return next(new AppError('VALIDATION_ERROR', 'Format user_id tidak valid', 400));
  }

  try {
    const updateRes = await pool.query(
      `UPDATE users 
       SET role = $1, updated_at = now() 
       WHERE user_id = $2
       RETURNING user_id, email, role, emp_id, is_active`,
      [role, userIdNum]
    );

    if (updateRes.rows.length === 0) {
      return next(new AppError('USER_NOT_FOUND', 'User tidak ditemukan', 404));
    }

    const user = updateRes.rows[0];

    return res.status(200).json({
      status: 'success',
      data: {
        user_id: user.user_id.toString(),
        email: user.email,
        role: user.role,
        emp_id: user.emp_id ? user.emp_id.toString() : null,
        is_active: user.is_active
      }
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/v1/auth/users/:user_id/reset-password
export async function resetPassword(req, res, next) {
  const { user_id } = req.params;
  const { password } = req.body;
  const userIdNum = parseInt(user_id, 10);

  if (isNaN(userIdNum)) {
    return next(new AppError('VALIDATION_ERROR', 'Format user_id tidak valid', 400));
  }

  try {
    const passwordHash = await hashPassword(password);

    const updateRes = await pool.query(
      `UPDATE users 
       SET password_hash = $1, updated_at = now() 
       WHERE user_id = $2
       RETURNING user_id`,
      [passwordHash, userIdNum]
    );

    if (updateRes.rows.length === 0) {
      return next(new AppError('USER_NOT_FOUND', 'User tidak ditemukan', 404));
    }

    return res.status(200).json({
      status: 'success',
      data: {
        message: 'Password berhasil di-reset'
      }
    });
  } catch (error) {
    next(error);
  }
}
