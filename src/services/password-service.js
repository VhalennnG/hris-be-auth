import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

/**
 * Hashes a plaintext password using bcrypt.
 * 
 * @param {string} plaintextPassword 
 * @returns {Promise<string>} The hashed password
 */
export async function hashPassword(plaintextPassword) {
  return bcrypt.hash(plaintextPassword, SALT_ROUNDS);
}

/**
 * Compares a plaintext password against a hashed password.
 * 
 * @param {string} plaintextPassword 
 * @param {string} hashedPassword 
 * @returns {Promise<boolean>} True if match, false otherwise
 */
export async function comparePassword(plaintextPassword, hashedPassword) {
  return bcrypt.compare(plaintextPassword, hashedPassword);
}
