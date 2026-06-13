/**
 * AES-256-GCM symmetric encryption helpers.
 *
 * Key material comes from the ENCRYPTION_KEY environment variable.
 * ENCRYPTION_KEY must be a 64-character hex string (32 bytes).
 *
 * Wire format: <12-byte IV> | <16-byte auth tag> | <ciphertext>
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV — recommended for GCM
const TAG_LENGTH = 16; // 128-bit authentication tag

function getEncryptionKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
        "Generate one with: openssl rand -hex 32",
    );
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): Buffer {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Layout: IV (12) | tag (16) | ciphertext (n)
  return Buffer.concat([iv, tag, encrypted]);
}

export function decrypt(data: Buffer): string {
  const key = getEncryptionKey();

  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);

  return decipher.update(ciphertext) + decipher.final("utf8");
}
