import "server-only";
import argon2 from "argon2";

/**
 * Argon2id password hashing following OWASP recommendations.
 * Parameters: 64 MiB memory, 3 iterations, parallelism 4.
 */
const ARGON2_OPTIONS: argon2.HashOptions & { raw: false } = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
  raw: false,
};

/**
 * Hash a plaintext password with Argon2id.
 * Returns an encoded string containing algorithm, params, salt and hash.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  if (plaintext.length < 12 || plaintext.length > 128) {
    throw new Error("Password must be between 12 and 128 characters");
  }
  return argon2.hash(plaintext, ARGON2_OPTIONS);
}

/**
 * Verify a plaintext password against an Argon2id hash.
 * Returns true if the password matches, false otherwise.
 * Never throws on wrong password — only on malformed hashes or internal errors.
 */
export async function verifyPassword(
  plaintext: string,
  hash: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    return false;
  }
}

/**
 * Check if the hash needs rehashing because parameters have changed.
 */
export function needsRehash(hash: string): boolean {
  return argon2.needsRehash(hash, ARGON2_OPTIONS);
}
