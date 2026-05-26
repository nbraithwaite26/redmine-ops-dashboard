#!/usr/bin/env node
/**
 * Generates a bcrypt hash for ADMIN_PASSWORD_HASH.
 *
 *   node server/scripts/hash-password.mjs '<your password>'
 *
 * Paste the printed value into .env.local. Never commit real hashes.
 */
import bcrypt from 'bcryptjs';

const password = process.argv[2];
if (!password) {
  console.error('Usage: node server/scripts/hash-password.mjs "<password>"');
  process.exit(2);
}

const rounds = 12;
const hash = await bcrypt.hash(password, rounds);
console.log(hash);
