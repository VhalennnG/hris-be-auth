import jwt from 'jsonwebtoken';
import { getPrivateKey } from '../config/keys.js';

/**
 * Signs a JWT token asymmetrically using RS256 algorithm.
 * Expiry is configured to 4 hours as per PRD 9.2 recommendations.
 * 
 * @param {object} user - User object containing user_id, role, and emp_id
 * @returns {string} The signed JWT token
 */
export function signToken(user) {
  const privateKey = getPrivateKey();

  const payload = {
    sub: user.user_id.toString(),
    role: user.role,
    emp_id: user.emp_id ? parseInt(user.emp_id, 10) : null
  };

  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    expiresIn: '4h' // Expiry sedang (1-4 jam), stateless token
  });
}
