/**
 * App-level cryptographic helpers — NIST SP 800-57 / SP 800-38D aligned.
 *
 * Use this module when Appwrite's native at-rest encryption is unavailable
 * (see docs/COMPLIANCE.md §Encryption at rest). All operations use Node's
 * built-in `crypto` module; this module must only be imported in server-side
 * code (Appwrite Functions, Node scripts) — not in the React Native bundle.
 *
 * Algorithms:
 *   Symmetric encryption : AES-256-GCM (NIST SP 800-38D)
 *   Key derivation       : PBKDF2-HMAC-SHA256, 310,000 iterations (NIST SP 800-132)
 *   Hashing              : SHA-256
 *   Message integrity    : HMAC-SHA256
 */

import {
  randomBytes,
  createHash,
  createHmac,
  createCipheriv,
  createDecipheriv,
  pbkdf2,
  timingSafeEqual,
} from 'crypto';

const ALGORITHM = 'aes-256-gcm';
export const KEY_BYTES = 32;   // 256-bit key
export const IV_BYTES = 12;    // 96-bit IV (recommended for GCM)
export const TAG_BYTES = 16;   // 128-bit authentication tag
export const SALT_BYTES = 32;  // 256-bit salt for PBKDF2
// NIST SP 800-132 §5.3 recommends ≥10,000; OWASP recommends 310,000 for SHA-256
export const PBKDF2_ITERATIONS = 310_000;

// ---------------------------------------------------------------------------
// Random bytes
// ---------------------------------------------------------------------------

export function generateRandomBytes(length: number): Buffer {
  if (length < 1) throw new RangeError('length must be positive');
  return randomBytes(length);
}

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

export function sha256(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

// ---------------------------------------------------------------------------
// HMAC-SHA256
// ---------------------------------------------------------------------------

export function hmacSha256(key: string | Buffer, data: string | Buffer): string {
  return createHmac('sha256', key).update(data).digest('hex');
}

/**
 * Constant-time comparison for HMAC values. Prevents timing attacks when
 * comparing MACs derived from untrusted input.
 */
export function hmacVerify(key: string | Buffer, data: string | Buffer, expectedHex: string): boolean {
  const computed = Buffer.from(hmacSha256(key, data), 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  if (computed.length !== expected.length) return false;
  return timingSafeEqual(computed, expected);
}

// ---------------------------------------------------------------------------
// Key derivation
// ---------------------------------------------------------------------------

/**
 * Derives a 256-bit key from a password + salt using PBKDF2-HMAC-SHA256.
 * The salt should be a fresh random value generated with `generateRandomBytes(SALT_BYTES)`.
 *
 * This is async to avoid blocking the Node.js event loop. At 310,000 iterations
 * `pbkdf2Sync` would block for ~100ms+ on typical hardware — unacceptable in a
 * server handling concurrent requests.
 */
export function deriveKey(
  password: string,
  salt: Buffer,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    pbkdf2(password, salt, iterations, KEY_BYTES, 'sha256', (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

// ---------------------------------------------------------------------------
// AES-256-GCM authenticated encryption
// ---------------------------------------------------------------------------

export interface EncryptedBlob {
  iv: string;         // base64, 12 bytes
  ciphertext: string; // base64
  tag: string;        // base64, 16 bytes (GCM authentication tag)
}

/**
 * Encrypts `plaintext` with AES-256-GCM using the supplied `key`.
 * A fresh random IV is generated for every call; never reuse an IV.
 */
export function encryptAesGcm(plaintext: string, key: Buffer): EncryptedBlob {
  if (key.length !== KEY_BYTES) {
    throw new RangeError(`AES-256 key must be ${KEY_BYTES} bytes; got ${key.length}`);
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    ciphertext: encrypted.toString('base64'),
    tag: tag.toString('base64'),
  };
}

/**
 * Decrypts an `EncryptedBlob` produced by `encryptAesGcm`.
 * Throws if authentication tag verification fails (tampered ciphertext).
 */
export function decryptAesGcm(blob: EncryptedBlob, key: Buffer): string {
  if (key.length !== KEY_BYTES) {
    throw new RangeError(`AES-256 key must be ${KEY_BYTES} bytes; got ${key.length}`);
  }
  const iv = Buffer.from(blob.iv, 'base64');
  const ciphertext = Buffer.from(blob.ciphertext, 'base64');
  const tag = Buffer.from(blob.tag, 'base64');

  if (iv.length !== IV_BYTES) throw new RangeError(`IV must be ${IV_BYTES} bytes`);
  if (tag.length !== TAG_BYTES) throw new RangeError(`Auth tag must be ${TAG_BYTES} bytes`);

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}
