export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72;

/** Returns an error message when the password fails policy, otherwise null. */
export function passwordPolicyError(plain: string): string | null {
  if (!plain) return "Password wajib diisi";
  if (plain.length < MIN_PASSWORD_LENGTH) {
    return `Password minimal ${MIN_PASSWORD_LENGTH} karakter`;
  }
  if (plain.length > MAX_PASSWORD_LENGTH) return "Password terlalu panjang";
  return null;
}
