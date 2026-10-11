import { hoursBetween } from "@/lib/calc";
import { todayISO } from "@/lib/format";

export type PeriodKey = "daily" | "wtd" | "mtd" | "hytd1" | "hytd2" | "ytd";

export const PERIODS: PeriodKey[] = ["daily", "wtd", "mtd", "hytd1", "hytd2", "ytd"];

export type PeriodWindow = { start: string; end: string };

export type SummaryEvent = {
  unit: string;
  sheetDate: string;
  waiting_labour_at: string;
  repair_started_at: string;
  rd30_at: string;
};

export type SummarySourceUnit = {
  id: string;
  model: string;
  quota_hrs: number | null;
  unit: string;
  group: string;
};

export type SummarySourceGroup = {
  id: string;
  group: string;
  quota_hrs: number;
};

export type SummaryRow = {
  id: string;
  label: string;
  quota_hrs: number | null;
  unit: string;
  daily: number;
  wtd: number;
  mtd: number;
  hytd1: number;
  hytd2: number;
  ytd: number;
  overDaily: boolean;
  open: boolean;
};

export type SummaryReport = {
  asOf: string;
  years: number[];
  openUnits: number;
  units: SummaryRow[];
  groups: SummaryRow[];
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function emptyTotals(): Record<PeriodKey, number> {
  return { daily: 0, wtd: 0, mtd: 0, hytd1: 0, hytd2: 0, ytd: 0 };
}

function unitKey(value: string): string {
  return value.trim().toLowerCase();
}

export function summaryHours(
  input: Pick<SummaryEvent, "waiting_labour_at" | "repair_started_at" | "rd30_at">,
  now: Date
): number | null {
  if (!input.repair_started_at.trim()) return null;
  const waiting = hoursBetween(input.waiting_labour_at, input.repair_started_at);
  const repair = input.rd30_at.trim()
    ? hoursBetween(input.repair_started_at, input.rd30_at)
    : hoursBetween(input.repair_started_at, now);
  if (waiting == null && repair == null) return null;
  return (waiting ?? 0) + (repair ?? 0);
}

export function isOpenDowntime(
  input: Pick<SummaryEvent, "repair_started_at" | "rd30_at">
): boolean {
  return input.repair_started_at.trim().length > 0 && input.rd30_at.trim().length === 0;
}

/** Tahun berjalan memakai waktu sekarang. Tahun lain dihitung sampai 31 Desember tahun itu. */
export function summaryAsOf(year: number, now = new Date()): Date {
  if (year === now.getFullYear()) return now;
  return new Date(year, 11, 31, 23, 59, 59);
}

export function periodWindows(now = new Date()): Record<PeriodKey, PeriodWindow> {
  const today = todayISO(now);
  const year = today.slice(0, 4);
  const month = today.slice(0, 7);
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return {
    daily: { start: today, end: today },
    wtd: { start: todayISO(monday), end: today },
    mtd: { start: `${month}-01`, end: today },
    hytd1: { start: `${year}-01-01`, end: `${year}-06-30` },
    hytd2: { start: `${year}-07-01`, end: `${year}-12-31` },
    ytd: { start: `${year}-01-01`, end: today },
  };
}

function inWindow(day: string, window: PeriodWindow): boolean {
  return day >= window.start && day <= window.end;
}

function startOfDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function daysInclusive(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

/** Hari pengali quota. WTD = hari berjalan sejak Senin (Sabtu = 6), MTD = tanggal hari ini, HYTD dan YTD = hari dalam jendela sampai hari ini. */
export function periodQuotaDays(period: PeriodKey, now = new Date()): number {
  const today = startOfDay(now);
  const year = today.getFullYear();
  if (period === "daily") return 1;
  if (period === "wtd") {
    const weekday = today.getDay();
    return weekday === 0 ? 7 : weekday;
  }
  if (period === "mtd") return today.getDate();
  if (period === "hytd1") {
    const start = new Date(year, 0, 1);
    const cap = new Date(year, 5, 30);
    if (today < start) return 0;
    return daysInclusive(start, today < cap ? today : cap);
  }
  if (period === "hytd2") {
    const start = new Date(year, 6, 1);
    if (today < start) return 0;
    const cap = new Date(year, 11, 31);
    return daysInclusive(start, today < cap ? today : cap);
  }
  return daysInclusive(new Date(year, 0, 1), today);
}

export function periodQuota(base: number | null, period: PeriodKey, now = new Date()): number | null {
  if (base == null) return null;
  return Math.round(base * periodQuotaDays(period, now) * 100) / 100;
}

function toRow(
  id: string,
  label: string,
  quota: number | null,
  unit: string,
  totals: Record<PeriodKey, number>,
  open: boolean
): SummaryRow {
  return {
    id,
    label,
    quota_hrs: quota,
    unit,
    daily: totals.daily,
    wtd: totals.wtd,
    mtd: totals.mtd,
    hytd1: totals.hytd1,
    hytd2: totals.hytd2,
    ytd: totals.ytd,
    overDaily: quota != null && totals.daily > quota,
    open,
  };
}

export function buildSummary(input: {
  now?: Date;
  years?: number[];
  events: SummaryEvent[];
  units: SummarySourceUnit[];
  groups: SummarySourceGroup[];
}): SummaryReport {
  const now = input.now ?? new Date();
  const windows = periodWindows(now);
  const master = new Map(input.units.map((unit) => [unitKey(unit.unit), unit]));
  const totals = new Map<string, Record<PeriodKey, number>>();
  const labels = new Map<string, string>();
  const open = new Set<string>();

  function bucket(code: string): string {
    const known = master.get(unitKey(code));
    return known ? unitKey(known.unit) : unitKey(code);
  }

  function ensure(key: string, label: string) {
    if (!totals.has(key)) totals.set(key, emptyTotals());
    if (!labels.has(key)) labels.set(key, label);
  }

  for (const event of input.events) {
    const day = event.waiting_labour_at.trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    if (!PERIODS.some((period) => inWindow(day, windows[period]))) continue;
    const key = bucket(event.unit);
    const known = master.get(key);
    ensure(key, known?.unit || event.unit.trim() || "—");
    if (isOpenDowntime(event)) open.add(key);
    const hours = summaryHours(event, now);
    if (hours == null) continue;
    const rounded = round2(hours);
    const row = totals.get(key);
    if (!row) continue;
    for (const period of PERIODS) {
      if (inWindow(day, windows[period])) row[period] = round2(row[period] + rounded);
    }
  }

  const listed = new Set(totals.keys());
  const unitRows: SummaryRow[] = input.units
    .filter((unit) => listed.has(unitKey(unit.unit)))
    .map((unit) =>
      toRow(
        unit.id,
        unit.model,
        unit.quota_hrs,
        unit.unit,
        totals.get(unitKey(unit.unit)) || emptyTotals(),
        open.has(unitKey(unit.unit))
      )
    );

  const orphans = [...listed]
    .filter((key) => !master.has(key))
    .sort((a, b) => (labels.get(a) || "").localeCompare(labels.get(b) || ""))
    .map((key) => toRow(`orphan:${key}`, "—", null, labels.get(key) || "—", totals.get(key) || emptyTotals(), open.has(key)));

  const groupRows = input.groups.flatMap((group) => {
    const members = input.units
      .filter((unit) => unit.group.trim() && unitKey(unit.group) === unitKey(group.group) && listed.has(unitKey(unit.unit)))
      .map((unit) => unit.unit)
      .sort((a, b) => a.localeCompare(b));
    if (members.length === 0) return [];
    const sum = emptyTotals();
    for (const member of members) {
      const row = totals.get(unitKey(member));
      if (!row) continue;
      for (const period of PERIODS) sum[period] = round2(sum[period] + row[period]);
    }
    return [
      toRow(
        group.id,
        group.group,
        group.quota_hrs,
        members.map((member) => (open.has(unitKey(member)) ? `${member}*` : member)).join(", "),
        sum,
        members.some((member) => open.has(unitKey(member)))
      ),
    ];
  });

  return {
    asOf: todayISO(now),
    years: input.years ?? [],
    openUnits: open.size,
    units: [...unitRows, ...orphans],
    groups: groupRows,
  };
}
