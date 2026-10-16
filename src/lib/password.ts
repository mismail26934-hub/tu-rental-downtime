import bcrypt from "bcrypt";

const ROUNDS = 10;

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72;

export function isBcryptHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(value);
}

/** Returns an error message when the password fails policy, otherwise null. */
export function passwordPolicyError(plain: string): string | null {
  if (!plain) return "Password wajib diisi";
  if (plain.length < MIN_PASSWORD_LENGTH) {
    return `Password minimal ${MIN_PASSWORD_LENGTH} karakter`;
  }
  if (plain.length > MAX_PASSWORD_LENGTH) return "Password terlalu panjang";
  return null;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!stored || !plain) return false;
  if (!isBcryptHash(stored)) return false;
  return bcrypt.compare(plain, stored);
}
