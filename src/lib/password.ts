import bcrypt from "bcrypt";

export {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  passwordPolicyError,
} from "@/lib/password-policy";

const ROUNDS = 10;

export function isBcryptHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(value);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!stored || !plain) return false;
  if (!isBcryptHash(stored)) return false;
  return bcrypt.compare(plain, stored);
}
