type Bucket = {
  fails: number;
  windowStartedAt: number;
  lockedUntil: number;
};

const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;
const MAX_FAILS = 5;

const buckets = new Map<string, Bucket>();

function normalizeKey(username: string, ip: string): string {
  return `${username.trim().toLowerCase()}|${ip.trim() || "?"}`;
}

function prune(now: number) {
  if (buckets.size < 500) return;
  for (const [key, bucket] of buckets) {
    if (bucket.lockedUntil < now && now - bucket.windowStartedAt > WINDOW_MS) {
      buckets.delete(key);
    }
  }
}

export function assertLoginAllowed(
  username: string,
  ip: string
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  prune(now);
  const key = normalizeKey(username, ip);
  const bucket = buckets.get(key);
  if (!bucket) return { ok: true };
  if (bucket.lockedUntil > now) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((bucket.lockedUntil - now) / 1000)) };
  }
  return { ok: true };
}

export function recordLoginFailure(username: string, ip: string): void {
  const now = Date.now();
  const key = normalizeKey(username, ip);
  const current = buckets.get(key);
  if (!current || now - current.windowStartedAt > WINDOW_MS) {
    buckets.set(key, { fails: 1, windowStartedAt: now, lockedUntil: 0 });
    return;
  }
  current.fails += 1;
  if (current.fails >= MAX_FAILS) {
    current.lockedUntil = now + LOCKOUT_MS;
  }
  buckets.set(key, current);
}

export function clearLoginFailures(username: string, ip: string): void {
  buckets.delete(normalizeKey(username, ip));
}
