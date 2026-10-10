import { parseLocal } from "@/lib/calc";
import type { Shift } from "@/lib/types";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

export function todayISO(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function defaultShift(now = new Date()): Shift {
  const hour = now.getHours();
  return hour >= 18 || hour < 6 ? "NS" : "DS";
}

export function sheetTitle(date: string, shift: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return `${date} ${shift}`;
  const month = MONTHS[Number(match[2]) - 1] || match[2];
  return `${match[3]} ${month} ${match[1]} ${shift}`;
}

export function formatStamp(value: string): string {
  const time = parseLocal(value);
  if (time == null) return "—";
  const date = new Date(time);
  const day = String(date.getDate()).padStart(2, "0");
  const month = MONTHS[date.getMonth()];
  const year = String(date.getFullYear()).slice(2);
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} ${hour}:${minute}`;
}

function groupThousands(value: number, fractionDigits: number, trimFraction = false): string {
  const negative = value < 0;
  const rounded = Math.round(Math.abs(value) * 100) / 100;
  const [whole, fraction = ""] = rounded.toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const digits = fraction.slice(0, fractionDigits);
  const shown = trimFraction ? digits.replace(/0+$/, "") : digits;
  const sign = negative ? "-" : "";
  return shown ? `${sign}${grouped}.${shown}` : `${sign}${grouped}`;
}

export function formatHours(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return groupThousands(value, 2);
}

export function formatQuotaDisplay(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return groupThousands(value, 2, true);
}

export function formatHmDisplay(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "—";
  const normalized = trimmed.replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return trimmed;
  const number = Number(normalized);
  if (!Number.isFinite(number)) return trimmed;
  const fraction = normalized.split(".")[1]?.slice(0, 2).length ?? 0;
  return groupThousands(number, fraction, true);
}

export function formatDt(label: string, total: number | null): string {
  if (label === "N/Y Ready") return "N/Y Ready";
  if (label === "—") return "—";
  return formatHours(total);
}

export function formatDateTimeDMY(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(value.trim());
  if (!match) return "";
  return `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]}`;
}

export function parseDateTimeDMY(value: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59) return null;
  const date = new Date(year, month - 1, day, hour, minute);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}
