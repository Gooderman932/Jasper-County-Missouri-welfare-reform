/**
 * @jest-environment node
 *
 * Node environment is required because this module uses Node's built-in
 * `crypto` module, which is not available in the jsdom/React Native test env.
 */
import {
  generateRandomBytes,
  sha256,
  hmacSha256,
  hmacVerify,
  deriveKey,
  encryptAesGcm,
  decryptAesGcm,
  KEY_BYTES,
  IV_BYTES,
  TAG_BYTES,
  SALT_BYTES,
} from '../crypto';

const TEST_KEY = Buffer.alloc(KEY_BYTES, 0x42); // 32 × 0x42

describe('generateRandomBytes', () => {
  it('returns a Buffer of the requested length', () => {
    const buf = generateRandomBytes(16);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBe(16);
  });

  it('produces different values on successive calls', () => {
    expect(generateRandomBytes(16).toString('hex')).not.toBe(
      generateRandomBytes(16).toString('hex'),
    );
  });

  it('throws on non-positive length', () => {
    expect(() => generateRandomBytes(0)).toThrow(RangeError);
  });
});

describe('sha256', () => {
  it('returns a 64-char hex string', () => {
    const h = sha256('hello');
    expect(h).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(h)).toBe(true);
  });

  it('is deterministic', () => {
    expect(sha256('hello')).toBe(sha256('hello'));
  });

  it('differs for different inputs', () => {
    expect(sha256('hello')).not.toBe(sha256('world'));
  });

  it('accepts a Buffer', () => {
    expect(sha256(Buffer.from('hello'))).toBe(sha256('hello'));
  });
});

describe('hmacSha256 / hmacVerify', () => {
  const KEY = 'test-key';
  const DATA = 'test-data';

  it('returns a 64-char hex string', () => {
    const mac = hmacSha256(KEY, DATA);
    expect(mac).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(mac)).toBe(true);
  });

  it('is deterministic for the same key and data', () => {
    expect(hmacSha256(KEY, DATA)).toBe(hmacSha256(KEY, DATA));
  });

  it('differs with different key or data', () => {
    expect(hmacSha256('other-key', DATA)).not.toBe(hmacSha256(KEY, DATA));
    expect(hmacSha256(KEY, 'other-data')).not.toBe(hmacSha256(KEY, DATA));
  });

  it('hmacVerify returns true for correct MAC', () => {
    const mac = hmacSha256(KEY, DATA);
    expect(hmacVerify(KEY, DATA, mac)).toBe(true);
  });

  it('hmacVerify returns false for wrong MAC', () => {
    expect(hmacVerify(KEY, DATA, 'a'.repeat(64))).toBe(false);
  });

  it('hmacVerify returns false for wrong length', () => {
    expect(hmacVerify(KEY, DATA, 'deadbeef')).toBe(false);
  });
});

describe('deriveKey', () => {
  it('produces a Buffer of KEY_BYTES length', () => {
    const salt = generateRandomBytes(SALT_BYTES);
    const key = deriveKey('password', salt);
    expect(Buffer.isBuffer(key)).toBe(true);
    expect(key.length).toBe(KEY_BYTES);
  });

  it('is deterministic for the same password and salt', () => {
    const salt = generateRandomBytes(SALT_BYTES);
    expect(deriveKey('password', salt).toString('hex')).toBe(
      deriveKey('password', salt).toString('hex'),
    );
  });

  it('differs for different salts', () => {
    const salt1 = generateRandomBytes(SALT_BYTES);
    const salt2 = generateRandomBytes(SALT_BYTES);
    expect(deriveKey('password', salt1).toString('hex')).not.toBe(
      deriveKey('password', salt2).toString('hex'),
    );
  });
});

describe('encryptAesGcm / decryptAesGcm', () => {
  it('round-trips plaintext', () => {
    const plaintext = 'This is a confidential case note.';
    const blob = encryptAesGcm(plaintext, TEST_KEY);
    expect(decryptAesGcm(blob, TEST_KEY)).toBe(plaintext);
  });

  it('round-trips an empty string', () => {
    const blob = encryptAesGcm('', TEST_KEY);
    expect(decryptAesGcm(blob, TEST_KEY)).toBe('');
  });

  it('round-trips unicode / multi-byte characters', () => {
    const plaintext = '日本語テスト — "Kody" (K.G.) — §164.312';
    const blob = encryptAesGcm(plaintext, TEST_KEY);
    expect(decryptAesGcm(blob, TEST_KEY)).toBe(plaintext);
  });

  it('produces different ciphertext for successive calls (fresh IV)', () => {
    const blob1 = encryptAesGcm('same', TEST_KEY);
    const blob2 = encryptAesGcm('same', TEST_KEY);
    expect(blob1.iv).not.toBe(blob2.iv);
    expect(blob1.ciphertext).not.toBe(blob2.ciphertext);
  });

  it('blob fields are base64 strings', () => {
    const blob = encryptAesGcm('test', TEST_KEY);
    const isBase64 = (s: string) => /^[A-Za-z0-9+/]+=*$/.test(s);
    expect(isBase64(blob.iv)).toBe(true);
    expect(isBase64(blob.ciphertext)).toBe(true);
    expect(isBase64(blob.tag)).toBe(true);
  });

  it('IV length is IV_BYTES when decoded', () => {
    const blob = encryptAesGcm('test', TEST_KEY);
    expect(Buffer.from(blob.iv, 'base64').length).toBe(IV_BYTES);
  });

  it('auth tag length is TAG_BYTES when decoded', () => {
    const blob = encryptAesGcm('test', TEST_KEY);
    expect(Buffer.from(blob.tag, 'base64').length).toBe(TAG_BYTES);
  });

  it('throws on wrong key length for encryption', () => {
    expect(() => encryptAesGcm('test', Buffer.alloc(16))).toThrow(RangeError);
  });

  it('throws on wrong key length for decryption', () => {
    const blob = encryptAesGcm('test', TEST_KEY);
    expect(() => decryptAesGcm(blob, Buffer.alloc(16))).toThrow(RangeError);
  });

  it('throws when ciphertext is tampered', () => {
    const blob = encryptAesGcm('secret', TEST_KEY);
    // Flip a byte in the ciphertext
    const ct = Buffer.from(blob.ciphertext, 'base64');
    ct[0] ^= 0xff;
    const tampered = { ...blob, ciphertext: ct.toString('base64') };
    expect(() => decryptAesGcm(tampered, TEST_KEY)).toThrow();
  });

  it('throws when auth tag is tampered', () => {
    const blob = encryptAesGcm('secret', TEST_KEY);
    const tag = Buffer.from(blob.tag, 'base64');
    tag[0] ^= 0xff;
    const tampered = { ...blob, tag: tag.toString('base64') };
    expect(() => decryptAesGcm(tampered, TEST_KEY)).toThrow();
  });
});
