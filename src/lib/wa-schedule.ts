const MIN_INTERVAL = 30;
const MAX_INTERVAL = 24 * 60;

export function clampInterval(value: number): number {
  if (!Number.isFinite(value)) return 60;
  return Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, Math.round(value)));
}

export function parseClock(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function normalizeClock(value: string): string | null {
  const minutes = parseClock(value);
  if (minutes == null) return null;
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export function formatLocalDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function parseLocalDateTime(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function inActiveWindow(date: Date, from: string, until: string): boolean {
  const start = parseClock(from);
  const end = parseClock(until);
  if (start == null || end == null || start === end) return true;
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (start < end) return minutes >= start && minutes <= end;
  return minutes >= start || minutes <= end;
}

/** Next send after `now`, stepped from `anchor`, and only inside the active window. */
export function nextFutureSlot(anchor: Date, now: Date, intervalMinutes: number, from: string, until: string): Date {
  const step = clampInterval(intervalMinutes) * 60_000;
  let cursor = new Date(anchor.getTime());
  if (cursor.getTime() <= now.getTime()) {
    const steps = Math.floor((now.getTime() - cursor.getTime()) / step) + 1;
    cursor = new Date(cursor.getTime() + steps * step);
  }
  const limit = Math.ceil((48 * 60) / clampInterval(intervalMinutes));
  for (let index = 0; index < limit; index += 1) {
    if (inActiveWindow(cursor, from, until)) return cursor;
    cursor = new Date(cursor.getTime() + step);
  }
  return nextWindowOpen(now, from);
}

function nextWindowOpen(now: Date, from: string): Date {
  const start = parseClock(from) ?? 6 * 60;
  const result = new Date(now);
  result.setSeconds(0, 0);
  result.setHours(Math.floor(start / 60), start % 60, 0, 0);
  if (result.getTime() <= now.getTime()) result.setDate(result.getDate() + 1);
  return result;
}

export function isStale(due: Date, now: Date, intervalMinutes: number): boolean {
  return now.getTime() - due.getTime() >= clampInterval(intervalMinutes) * 60_000;
}
