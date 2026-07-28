import { Router } from 'express';
import { requireSuperadmin } from '../middlewares/trusted-role-check.js';
import {
  validateLogin,
  validateCreateUser,
  validateUpdateRole,
  validateResetPassword
} from '../middlewares/validation.js';
import { login } from '../controllers/auth-controller.js';
import {
  createUser,
  updateUserRole,
  resetPassword
} from '../controllers/user-controller.js';

const router = Router();

// Public login endpoint
router.post('/login', validateLogin, login);

// Admin / Superadmin user management routes
router.post('/users', requireSuperadmin, validateCreateUser, createUser);
router.patch('/users/:user_id/role', requireSuperadmin, validateUpdateRole, updateUserRole);
router.post('/users/:user_id/reset-password', requireSuperadmin, validateResetPassword, resetPassword);

export default router;
