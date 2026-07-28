import test from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import { hashPassword, comparePassword } from '../src/services/password-service.js';
import { signToken } from '../src/services/token-service.js';
import { getPublicKeyForTesting } from '../src/config/keys.js';

test('Password Hashing Service', async (t) => {
  await t.test('should successfully hash and verify password', async () => {
    const password = 'my-super-secret-password';
    const hash = await hashPassword(password);

    assert.notStrictEqual(password, hash);
    assert.strictEqual(hash.startsWith('$2b$'), true); // bcrypt indicator

    const match = await comparePassword(password, hash);
    assert.strictEqual(match, true);

    const noMatch = await comparePassword('wrong-password', hash);
    assert.strictEqual(noMatch, false);
  });
});

test('JWT Signing Service (RS256)', async (t) => {
  await t.test('should sign token with claims using RSA private key and verify using public key', async () => {
    const publicKey = getPublicKeyForTesting();
    if (!publicKey) {
      console.warn('Skipping JWT Service test because public key is missing for verification');
      return;
    }

    const user = {
      user_id: 1000005,
      role: 'admin',
      emp_id: 1000006
    };

    const token = signToken(user);
    assert.ok(token);

    // Verify signature using public key (RS256)
    const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });

    assert.strictEqual(decoded.sub, '1000005');
    assert.strictEqual(decoded.role, 'admin');
    assert.strictEqual(decoded.emp_id, 1000006);
    assert.ok(decoded.iat);
    assert.ok(decoded.exp);
  });
});
