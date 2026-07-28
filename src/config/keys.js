import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

let privateKey = null;
let publicKey = null;

export function getPrivateKey() {
  if (privateKey) return privateKey;

  const keyPath = process.env.JWT_PRIVATE_KEY_PATH || 'keys/private_key.pem';
  const absolutePath = path.isAbsolute(keyPath)
    ? keyPath
    : path.resolve(process.cwd(), keyPath);

  try {
    privateKey = fs.readFileSync(absolutePath, 'utf8');
    return privateKey;
  } catch (error) {
    console.error(`Failed to read private key from ${absolutePath}:`, error.message);
    throw new Error('JWT Private Key configuration error.');
  }
}

export function getPublicKeyForTesting() {
  if (publicKey) return publicKey;

  const keyPath = 'keys/public_key.pem';
  const absolutePath = path.resolve(process.cwd(), keyPath);

  try {
    publicKey = fs.readFileSync(absolutePath, 'utf8');
    return publicKey;
  } catch (error) {
    console.warn(`Warning: Could not read public key (only needed for testing):`, error.message);
    return null;
  }
}
