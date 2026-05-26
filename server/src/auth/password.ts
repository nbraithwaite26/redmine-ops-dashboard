import bcrypt from 'bcryptjs';

/**
 * Single seam for password verification. Plaintext never leaves this file.
 */
export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  if (!hash || !plaintext) return false;
  try {
    return await bcrypt.compare(plaintext, hash);
  } catch {
    return false;
  }
}

export async function hashPassword(plaintext: string, rounds = 12): Promise<string> {
  return bcrypt.hash(plaintext, rounds);
}
