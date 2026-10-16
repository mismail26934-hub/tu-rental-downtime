const WEAK_SECRETS = new Set([
  "",
  "change-me",
  "changeme",
  "secret",
  "password",
  "nextauth",
  "auth_secret",
  "authsecret",
]);

export function readAuthSecret(): string {
  return (process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "").trim();
}

export function isWeakAuthSecret(secret = readAuthSecret()): boolean {
  if (!secret || secret.length < 32) return true;
  return WEAK_SECRETS.has(secret.toLowerCase());
}

/** Fail hard in production; warn in development. */
export function assertAuthSecret(): void {
  const secret = readAuthSecret();
  if (!isWeakAuthSecret(secret)) return;
  const message =
    "AUTH_SECRET harus kuat (minimal 32 karakter, bukan nilai default seperti change-me). Generate: openssl rand -base64 32";
  if (process.env.NODE_ENV === "production") {
    throw new Error(message);
  }
  console.warn(`[tu-rental] ${message}`);
}
